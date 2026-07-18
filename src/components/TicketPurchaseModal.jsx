import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, Loader2, Check, Copy, AlertCircle, ChevronRight, Wallet, Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { eventsApi } from '../services/api';
import { payWithWebLN } from '../services/lightningService';
import { useWallet } from '../hooks/useWallet';

const PREIMAGE_RE = /^[0-9a-fA-F]{64}$/;

/**
 * In-app Lightning ticket purchase modal.
 *
 * The server creates a PENDING ticket backed by a bolt11 invoice from the
 * host's Lightning address (non-custodial — sats go straight to the host).
 * Payment paths:
 *   1. Connected wallet (NWC/Coinos via useWallet) — preimage claims instantly
 *   2. WebLN (browser extension) — preimage claims instantly
 *   3. QR / copy / lightning: deep link — settlement confirmed by polling
 *      the ticket (server runs LUD-21 verify against the host's provider)
 *
 * When the host's provider lacks LUD-21 verify (ticket.verifySupported is
 * false) path 3 can never be confirmed, so it is hidden along with the Coinos
 * button (Coinos pays server-side and returns no preimage) — only
 * preimage-producing payers (NWC / WebLN) are offered, and a failed claim is
 * surfaced with a retry instead of relying on the poll.
 *
 * @param {boolean}  props.open
 * @param {function} props.onClose
 * @param {{id: string, title?: string, priceSats?: number}} props.event
 * @param {function} [props.onPurchased] — called once with the PAID ticket
 */
const TicketPurchaseModal = ({ open, onClose, event, onPurchased }) => {
    const { connected: walletConnected, walletType, payInvoice: walletPayInvoice } = useWallet();
    const [phase, setPhase] = useState('creating'); // creating | pending | paid | expired | error
    const [ticket, setTicket] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [walletError, setWalletError] = useState('');
    const [walletPaying, setWalletPaying] = useState(false);
    const [copied, setCopied] = useState(false);
    const [claimRetryPreimage, setClaimRetryPreimage] = useState(null); // preimage whose claim POST failed (retryable)
    const purchasedNotifiedRef = useRef(false);
    const pollBusyRef = useRef(false);
    const hasWebln = typeof window !== 'undefined' && !!window.webln;

    const markPaid = useCallback((paidTicket) => {
        setTicket(paidTicket);
        setPhase('paid');
        if (!purchasedNotifiedRef.current) {
            purchasedNotifiedRef.current = true;
            if (onPurchased) onPurchased(paidTicket);
        }
    }, [onPurchased]);

    const createTicket = useCallback(async () => {
        if (!event?.id) return;
        setPhase('creating');
        setErrorMsg('');
        setWalletError('');
        setCopied(false);
        setClaimRetryPreimage(null);
        setTicket(null);
        try {
            const res = await eventsApi.buyTicket(event.id);
            const t = res?.ticket || res;
            if (!t?.bolt11) throw new Error('The server did not return an invoice');
            setTicket(t);
            if (t.status === 'PAID') markPaid(t);
            else if (t.status === 'EXPIRED') setPhase('expired');
            else setPhase('pending');
        } catch (err) {
            setErrorMsg(err?.message || 'Failed to create the ticket invoice.');
            setPhase('error');
        }
    }, [event?.id, markPaid]);

    // Request an invoice once per open session. Guarded by a ref so parent
    // re-renders (which change the createTicket identity via onPurchased)
    // cannot restart the flow while the modal is showing.
    const openedRef = useRef(false);
    useEffect(() => {
        if (!open) {
            openedRef.current = false;
            return;
        }
        if (openedRef.current) return;
        openedRef.current = true;
        purchasedNotifiedRef.current = false;
        createTicket();
    }, [open, createTicket]);

    // Poll the ticket every ~3s while PENDING — the server runs LUD-21 verify
    // on each poll, so external-wallet payers get confirmed automatically.
    useEffect(() => {
        if (!open || phase !== 'pending' || !ticket?.id) return undefined;
        const interval = setInterval(async () => {
            if (pollBusyRef.current) return;
            pollBusyRef.current = true;
            try {
                const res = await eventsApi.getTicket(event.id, ticket.id);
                const t = res?.ticket || res;
                if (t?.status === 'PAID') markPaid(t);
                else if (t?.status === 'EXPIRED') { setTicket(t); setPhase('expired'); }
            } catch { /* transient — keep polling */ }
            finally { pollBusyRef.current = false; }
        }, 3000);
        return () => clearInterval(interval);
    }, [open, phase, ticket?.id, event?.id, markPaid]);

    // Idempotent body scroll lock — skip if another modal already locked it.
    useEffect(() => {
        if (!open) return undefined;
        if (document.body.style.position === 'fixed') return undefined;
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            window.scrollTo(0, scrollY);
        };
    }, [open]);

    // ESC closes (not mid wallet payment)
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape' && !walletPaying) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, walletPaying, onClose]);

    if (!open) return null;

    // Whether the server can confirm settlement on its own (LUD-21 verify).
    // Without it, claiming with a preimage is the ONLY way this ticket can
    // become PAID — payment paths that produce no preimage must be hidden.
    const verifySupported = !ticket || ticket.verifySupported !== false;

    const claimWithPreimage = async (preimage) => {
        try {
            const res = await eventsApi.claimTicket(event.id, ticket.id, preimage);
            const t = res?.ticket || res;
            if (t?.status === 'PAID') {
                setClaimRetryPreimage(null);
                markPaid(t);
                return true;
            }
        } catch {
            // Claim failed — handled below
        }
        if (!verifySupported) {
            // No LUD-21 verify: the poll can never confirm settlement, so a
            // swallowed claim failure would strand a paid buyer. Keep the
            // preimage and surface a retry.
            setClaimRetryPreimage(preimage);
            setWalletError('Payment sent, but confirming your ticket failed. Tap "Retry confirmation" — do not pay again.');
        }
        // With verify support, the LUD-21 poll still confirms settlement.
        return false;
    };

    const handleRetryClaim = async () => {
        if (!claimRetryPreimage || walletPaying) return;
        setWalletPaying(true);
        setWalletError('');
        try {
            await claimWithPreimage(claimRetryPreimage);
        } finally {
            setWalletPaying(false);
        }
    };

    const handleWalletPay = async () => {
        if (!ticket?.bolt11 || walletPaying) return;
        setWalletPaying(true);
        setWalletError('');
        try {
            const result = await walletPayInvoice(ticket.bolt11);
            const preimage = typeof result?.preimage === 'string' && PREIMAGE_RE.test(result.preimage)
                ? result.preimage
                : null;
            if (preimage) {
                await claimWithPreimage(preimage);
            } else if (!verifySupported) {
                // Wallet reported success without a preimage and the server
                // cannot verify settlement on its own — say so instead of
                // spinning on "Waiting for payment" forever.
                setWalletError('The wallet did not return a payment preimage, so the ticket could not be confirmed. Contact the host before paying again.');
            }
            // No preimage (e.g. Coinos pays server-side) — polling confirms it
        } catch (err) {
            setWalletError(err?.message || (verifySupported
                ? 'Wallet payment failed — you can still pay via the QR code below.'
                : 'Wallet payment failed. Please try again.'));
        } finally {
            setWalletPaying(false);
        }
    };

    const handleWebLNPay = async () => {
        if (!ticket?.bolt11 || walletPaying) return;
        setWalletPaying(true);
        setWalletError('');
        try {
            const result = await payWithWebLN(ticket.bolt11);
            if (result.success) {
                if (typeof result.preimage === 'string' && PREIMAGE_RE.test(result.preimage)) {
                    await claimWithPreimage(result.preimage);
                } else if (!verifySupported) {
                    setWalletError('The wallet did not return a payment preimage, so the ticket could not be confirmed. Contact the host before paying again.');
                }
                // Otherwise polling confirms it
            } else {
                setWalletError(result.error || (verifySupported
                    ? 'WebLN payment failed — you can still pay via the QR code below.'
                    : 'WebLN payment failed. Please try again.'));
            }
        } catch (err) {
            setWalletError(err?.message || (verifySupported
                ? 'WebLN payment failed — you can still pay via the QR code below.'
                : 'WebLN payment failed. Please try again.'));
        } finally {
            setWalletPaying(false);
        }
    };

    const copyInvoice = () => {
        if (!ticket?.bolt11) return;
        navigator.clipboard.writeText(ticket.bolt11);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const amountSats = ticket?.amountSats ?? event?.priceSats ?? 0;

    return createPortal(
        <div
            className="tp-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && !walletPaying) onClose();
            }}
        >
            <div className="tp-card" role="dialog" aria-modal="true">
                <div className="tp-header">
                    <h3 className="tp-title">
                        <Ticket size={18} style={{ color: '#f7931a' }} />
                        Buy Ticket
                    </h3>
                    <button className="tp-close" aria-label="Close" disabled={walletPaying} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="tp-body">
                    {phase === 'creating' && (
                        <div className="tp-center">
                            <Loader2 size={28} className="tp-spin" />
                            <p className="tp-status-text">Requesting an invoice from the host&apos;s Lightning address…</p>
                        </div>
                    )}

                    {phase === 'pending' && ticket && (
                        <>
                            <div className="tp-amount-block">
                                {event?.title && <span className="tp-event-title">{event.title}</span>}
                                <span className="tp-amount">
                                    <Zap size={20} style={{ color: '#f7931a' }} />
                                    {Number(amountSats).toLocaleString()} sats
                                </span>
                            </div>

                            {walletConnected && (verifySupported || walletType !== 'coinos') && (
                                <button className="tp-wallet-btn" onClick={handleWalletPay} disabled={walletPaying}>
                                    {walletPaying ? <Loader2 size={16} className="tp-spin-inline" /> : <Wallet size={16} />}
                                    {walletPaying
                                        ? 'Paying…'
                                        : `Pay with ${walletType === 'coinos' ? 'Coinos wallet' : 'connected wallet'}`}
                                </button>
                            )}

                            {hasWebln && (
                                <button className="tp-webln-btn" onClick={handleWebLNPay} disabled={walletPaying}>
                                    <Zap size={15} /> Pay with WebLN
                                </button>
                            )}

                            {walletError && (
                                <p className="tp-error-inline"><AlertCircle size={14} /> {walletError}</p>
                            )}

                            {claimRetryPreimage && (
                                <button className="tp-wallet-btn" onClick={handleRetryClaim} disabled={walletPaying}>
                                    {walletPaying ? <Loader2 size={16} className="tp-spin-inline" /> : <Check size={16} />}
                                    Retry confirmation
                                </button>
                            )}

                            {verifySupported ? (
                                <>
                                    <p className="tp-status-text">Scan or copy the invoice to pay</p>
                                    <div className="tp-qr-wrapper">
                                        <QRCodeSVG
                                            value={`lightning:${ticket.bolt11}`}
                                            size={200}
                                            level="M"
                                            marginSize={2}
                                            bgColor="#ffffff"
                                            fgColor="#000000"
                                        />
                                    </div>
                                    <div className="tp-invoice-box">
                                        <code className="tp-invoice-text">{ticket.bolt11}</code>
                                    </div>
                                    <div className="tp-invoice-actions">
                                        <button className="tp-copy-btn" onClick={copyInvoice}>
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                            {copied ? 'Copied!' : 'Copy Invoice'}
                                        </button>
                                        <a href={`lightning:${ticket.bolt11}`} className="tp-open-wallet">
                                            Open in Wallet <ChevronRight size={14} />
                                        </a>
                                    </div>

                                    <p className="tp-waiting">
                                        <Loader2 size={13} className="tp-spin-inline" /> Waiting for payment — your ticket confirms automatically.
                                    </p>
                                </>
                            ) : (
                                /* No LUD-21 verify: paying from an outside wallet app
                                   (QR / copied invoice) could never be confirmed and
                                   would invite a double payment — hide those paths. */
                                <p className="tp-verify-note">
                                    <AlertCircle size={14} />
                                    {(walletConnected && walletType !== 'coinos') || hasWebln
                                        ? "This host's Lightning provider can't confirm payments made from outside wallet apps — use the wallet button above so your ticket is confirmed instantly."
                                        : "This host's Lightning provider can't confirm payments made from outside wallet apps. Connect a wallet via NWC (Wallet settings) or use a WebLN browser extension to buy this ticket in-app."}
                                </p>
                            )}
                        </>
                    )}

                    {phase === 'paid' && ticket && (
                        <div className="tp-center">
                            <div className="tp-success-icon">
                                <Check size={30} />
                            </div>
                            <p className="tp-success-title">You&apos;re going!</p>
                            <p className="tp-status-text">
                                Ticket confirmed{event?.title ? ` for "${event.title}"` : ''} — {Number(amountSats).toLocaleString()} sats paid to the host.
                            </p>
                            <div className="tp-qr-wrapper">
                                <QRCodeSVG
                                    value={ticket.id}
                                    size={180}
                                    level="M"
                                    marginSize={2}
                                    bgColor="#ffffff"
                                    fgColor="#000000"
                                />
                            </div>
                            <p className="tp-ticket-id">Ticket #{ticket.id}</p>
                            <p className="tp-status-text">Show this QR code at the door for check-in.</p>
                            <button className="tp-done-btn" onClick={onClose}>Done</button>
                        </div>
                    )}

                    {phase === 'expired' && (
                        <div className="tp-center">
                            <AlertCircle size={28} style={{ color: '#f59e0b' }} />
                            <p className="tp-status-text">The invoice expired before it was paid.</p>
                            <button className="tp-wallet-btn" onClick={createTicket}>
                                <Zap size={16} /> Generate new invoice
                            </button>
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="tp-center">
                            <AlertCircle size={28} style={{ color: '#ef4444' }} />
                            <p className="tp-status-text" style={{ color: '#ef4444' }}>{errorMsg}</p>
                            <button className="tp-wallet-btn" onClick={createTicket}>Try Again</button>
                            <button className="tp-cancel-btn" onClick={onClose}>Close</button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .tp-overlay {
                    position: fixed;
                    inset: 0;
                    /* Above MobileBottomNav's 10000 so the fixed bottom nav
                       never occludes the sheet or steals taps. */
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                }

                .tp-card {
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    width: 92vw;
                    max-width: 420px;
                    max-height: 90vh; /* fallback for pre-dvh browsers */
                    max-height: calc(100dvh - 2rem);
                    display: flex;
                    flex-direction: column;
                    box-shadow: var(--shadow-lg);
                    overflow: hidden;
                }

                .tp-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid var(--color-gray-200);
                    flex-shrink: 0;
                }

                .tp-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                }

                .tp-close {
                    display: flex;
                    padding: 4px;
                    border: none;
                    background: none;
                    color: var(--color-gray-500);
                    cursor: pointer;
                }

                .tp-close:hover:not(:disabled) { color: var(--color-gray-900); }
                .tp-close:disabled { opacity: 0.5; cursor: default; }

                .tp-body {
                    padding: 1.25rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.85rem;
                }

                .tp-center {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1.5rem 0;
                }

                .tp-spin {
                    animation: tp-spin 1s linear infinite;
                    color: #f7931a;
                }

                .tp-spin-inline {
                    animation: tp-spin 1s linear infinite;
                    flex-shrink: 0;
                }

                @keyframes tp-spin {
                    to { transform: rotate(360deg); }
                }

                .tp-amount-block {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.25rem;
                }

                .tp-event-title {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--color-gray-500);
                    text-align: center;
                }

                .tp-amount {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: var(--color-gray-900);
                }

                .tp-wallet-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.8rem;
                    border: none;
                    border-radius: var(--radius-md);
                    background: linear-gradient(135deg, #f7931a 0%, #e2820b 100%);
                    color: white;
                    font-size: 0.95rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: opacity 0.15s;
                }

                .tp-wallet-btn:hover:not(:disabled) { opacity: 0.92; }
                .tp-wallet-btn:disabled { opacity: 0.6; cursor: wait; }

                .tp-webln-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    width: 100%;
                    padding: 0.65rem;
                    border: 1.5px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    color: var(--color-gray-700);
                    font-size: 0.88rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: border-color 0.15s;
                }

                .tp-webln-btn:hover:not(:disabled) { border-color: #f7931a; }
                .tp-webln-btn:disabled { opacity: 0.6; cursor: wait; }

                .tp-error-inline {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.35rem;
                    margin: 0;
                    font-size: 0.82rem;
                    color: var(--color-error, #ef4444);
                }

                .tp-verify-note {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.4rem;
                    margin: 0;
                    padding: 0.6rem 0.75rem;
                    border-radius: 8px;
                    background: rgba(245, 158, 11, 0.12);
                    color: #b45309;
                    font-size: 0.82rem;
                }

                .tp-verify-note svg {
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .tp-status-text {
                    color: var(--color-gray-600);
                    font-size: 0.88rem;
                    text-align: center;
                    margin: 0;
                }

                .tp-qr-wrapper {
                    display: flex;
                    justify-content: center;
                    padding: 0.75rem;
                    background: white;
                    border-radius: 12px;
                    border: 1px solid var(--color-gray-200);
                    align-self: center;
                }

                .tp-invoice-box {
                    background: var(--color-gray-100);
                    border-radius: 8px;
                    padding: 0.5rem 0.75rem;
                    max-height: 64px;
                    overflow: hidden;
                }

                .tp-invoice-text {
                    font-size: 0.68rem;
                    color: var(--color-gray-500);
                    word-break: break-all;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .tp-invoice-actions {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                }

                .tp-copy-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.45rem 0.9rem;
                    border: 1.5px solid var(--color-gray-200);
                    border-radius: var(--radius-full);
                    background: var(--color-surface);
                    color: var(--color-gray-700);
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                }

                .tp-copy-btn:hover { border-color: var(--color-primary); }

                .tp-open-wallet {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--color-primary);
                    text-decoration: none;
                }

                .tp-open-wallet:hover { text-decoration: underline; }

                .tp-waiting {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    margin: 0;
                    font-size: 0.78rem;
                    color: var(--color-gray-500);
                }

                .tp-success-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: var(--color-green-tint, #dcfce7);
                    color: var(--color-success, #16a34a);
                }

                .tp-success-title {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: var(--color-gray-900);
                }

                .tp-ticket-id {
                    margin: 0;
                    font-family: monospace;
                    font-size: 0.72rem;
                    color: var(--color-gray-400);
                    word-break: break-all;
                    text-align: center;
                }

                .tp-done-btn {
                    width: 100%;
                    padding: 0.75rem;
                    border: none;
                    border-radius: var(--radius-md);
                    background: var(--color-primary);
                    color: white;
                    font-size: 0.92rem;
                    font-weight: 600;
                    cursor: pointer;
                }

                .tp-done-btn:hover { opacity: 0.9; }

                .tp-cancel-btn {
                    background: none;
                    border: none;
                    color: var(--color-gray-500);
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                }

                .tp-cancel-btn:hover { color: var(--color-gray-900); }

                @media (max-width: 768px) {
                    .tp-overlay {
                        align-items: flex-end;
                    }

                    .tp-card {
                        width: 100%;
                        max-width: none;
                        max-height: 92vh; /* fallback for pre-dvh browsers */
                        max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 0.5rem);
                        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
                    }

                    .tp-body {
                        padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
                    }
                }
            `}</style>
        </div>,
        document.body,
    );
};

export default TicketPurchaseModal;

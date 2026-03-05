/**
 * ZapModal — Lightning zap payment modal.
 *
 * Supports two payment flows:
 *  1. QR code — user scans a BOLT-11 invoice with their mobile wallet
 *  2. NWC auto-pay — one-click payment via connected Nostr Wallet Connect
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - bolt11: string | null — the BOLT-11 invoice to pay
 *  - recipientName: string — display name of the recipient
 *  - amountSats: number | null — amount in sats (for display)
 *  - onPaymentComplete: () => void — called after successful payment
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, Copy, Check, Wallet, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { useWallet } from '../hooks/useWallet';

const ZapModal = ({ isOpen, onClose, bolt11, recipientName, amountSats, onPaymentComplete }) => {
    const { connected: walletConnected, payInvoice, loading: walletLoading, error: walletError } = useWallet();
    const [qrDataUrl, setQrDataUrl] = useState(null);
    const [copied, setCopied] = useState(false);
    const [payState, setPayState] = useState('idle'); // idle | paying | success | error
    const [payError, setPayError] = useState(null);
    const canvasRef = useRef(null);

    // Generate QR code when bolt11 changes
    useEffect(() => {
        if (!bolt11) {
            setQrDataUrl(null);
            return;
        }
        QRCode.toDataURL(bolt11.toUpperCase(), {
            width: 280,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
        })
            .then(setQrDataUrl)
            .catch(() => setQrDataUrl(null));
    }, [bolt11]);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setPayState('idle');
            setPayError(null);
            setCopied(false);
        }
    }, [isOpen]);

    const handleCopy = async () => {
        if (!bolt11) return;
        try {
            await navigator.clipboard.writeText(bolt11);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = bolt11;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleWalletPay = async () => {
        if (!bolt11) return;
        setPayState('paying');
        setPayError(null);
        try {
            await payInvoice(bolt11);
            setPayState('success');
            setTimeout(() => {
                onPaymentComplete?.();
            }, 1500);
        } catch (err) {
            setPayState('error');
            setPayError(err.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="zap-modal-overlay" onClick={onClose}>
            <div className="zap-modal" onClick={(e) => e.stopPropagation()}>
                <button className="zap-modal-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="zap-modal-header">
                    <div className="zap-modal-icon">
                        <Zap size={24} />
                    </div>
                    <h3>
                        {payState === 'success'
                            ? 'Zap Sent!'
                            : `Zap ${recipientName || 'User'}`}
                    </h3>
                    {amountSats && payState !== 'success' && (
                        <p className="zap-amount">{amountSats.toLocaleString()} sats</p>
                    )}
                </div>

                <div className="zap-modal-body">
                    {/* Success state */}
                    {payState === 'success' && (
                        <div className="zap-success">
                            <CheckCircle size={48} />
                            <p>Payment successful!</p>
                        </div>
                    )}

                    {/* Paying state */}
                    {payState === 'paying' && (
                        <div className="zap-paying">
                            <Loader size={32} className="spin" />
                            <p>Paying with wallet...</p>
                        </div>
                    )}

                    {/* Error state */}
                    {payState === 'error' && (
                        <div className="zap-error-state">
                            <AlertCircle size={32} />
                            <p>{payError || walletError || 'Payment failed'}</p>
                            <button className="btn btn-primary btn-sm" onClick={handleWalletPay}>
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Idle state — show wallet pay or QR */}
                    {payState === 'idle' && bolt11 && (
                        <>
                            {walletConnected ? (
                                <div className="zap-wallet-pay">
                                    <button
                                        className="btn btn-primary wallet-pay-btn"
                                        onClick={handleWalletPay}
                                        disabled={walletLoading}
                                    >
                                        <Wallet size={18} />
                                        Pay with wallet
                                    </button>
                                    <p className="zap-alt-text">or scan QR code below</p>
                                </div>
                            ) : null}

                            <div className="zap-qr-section">
                                {qrDataUrl ? (
                                    <img
                                        src={qrDataUrl}
                                        alt="Lightning invoice QR code"
                                        className="zap-qr"
                                    />
                                ) : (
                                    <div className="zap-qr-placeholder">
                                        <Loader size={24} className="spin" />
                                    </div>
                                )}
                            </div>

                            <button className="copy-invoice-btn" onClick={handleCopy}>
                                {copied ? (
                                    <>
                                        <Check size={14} />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} />
                                        Copy invoice
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {/* No invoice yet */}
                    {payState === 'idle' && !bolt11 && (
                        <div className="zap-loading">
                            <Loader size={24} className="spin" />
                            <p>Generating invoice...</p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .zap-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    animation: fadeIn 0.15s ease;
                }

                .zap-modal {
                    background: white;
                    border-radius: var(--radius-lg, 12px);
                    width: 90%;
                    max-width: 380px;
                    position: relative;
                    animation: slideUp 0.2s ease;
                    overflow: hidden;
                }

                .zap-modal-close {
                    position: absolute;
                    top: 0.75rem;
                    right: 0.75rem;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--color-gray-400);
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                }
                .zap-modal-close:hover {
                    color: var(--color-gray-600);
                    background: var(--color-gray-100);
                }

                .zap-modal-header {
                    text-align: center;
                    padding: 1.5rem 1.5rem 0.75rem;
                }

                .zap-modal-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: #fef3c7;
                    color: #f59e0b;
                    margin-bottom: 0.5rem;
                }

                .zap-modal-header h3 {
                    font-size: 1.1rem;
                    margin: 0;
                }

                .zap-amount {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #f59e0b;
                    margin-top: 0.25rem;
                }

                .zap-modal-body {
                    padding: 0.75rem 1.5rem 1.5rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                }

                /* Wallet pay button */
                .zap-wallet-pay {
                    width: 100%;
                    text-align: center;
                }

                .wallet-pay-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    font-size: 1rem;
                    width: 100%;
                    justify-content: center;
                }

                .zap-alt-text {
                    font-size: 0.8rem;
                    color: var(--color-gray-400);
                    margin-top: 0.75rem;
                }

                /* QR Code */
                .zap-qr-section {
                    display: flex;
                    justify-content: center;
                }

                .zap-qr {
                    width: 220px;
                    height: 220px;
                    border-radius: 8px;
                }

                .zap-qr-placeholder {
                    width: 220px;
                    height: 220px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-gray-50);
                    border-radius: 8px;
                }

                .copy-invoice-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    background: none;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--radius-md, 6px);
                    padding: 0.5rem 1rem;
                    font-size: 0.85rem;
                    cursor: pointer;
                    color: var(--color-gray-600);
                }
                .copy-invoice-btn:hover {
                    background: var(--color-gray-50);
                }

                /* Status states */
                .zap-success {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 2rem 0;
                    color: #22c55e;
                }
                .zap-success p {
                    color: var(--color-gray-700);
                    font-weight: 600;
                }

                .zap-paying {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 2rem 0;
                    color: var(--color-gray-500);
                }

                .zap-error-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1.5rem 0;
                    color: #ef4444;
                }
                .zap-error-state p {
                    color: var(--color-gray-600);
                    font-size: 0.9rem;
                    text-align: center;
                }

                .zap-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 2rem 0;
                    color: var(--color-gray-500);
                }

                /* Animations */
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                :global(.spin) {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ZapModal;

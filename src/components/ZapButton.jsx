import { useState } from 'react';
import { Zap } from 'lucide-react';
import ZapModal from './ZapModal';

/**
 * Reusable zap button that opens a ZapModal for Lightning payments.
 *
 * @param {Object} props
 * @param {Array<{pubkey: string, name: string, avatar?: string}>} props.recipients - Nostr hex pubkeys of zap recipients
 * @param {string} [props.eventId] - Nostr event ID being zapped (for zap receipts)
 * @param {'sm'|'md'} [props.size='md'] - Button size variant
 * @param {'default'|'bitcoin'} [props.variant='default'] - Visual style variant
 * @param {string} [props.className] - Additional CSS class
 * @param {string} [props.label] - Custom label (default: "Zap" for md, icon-only for sm)
 */
const ZapButton = ({ recipients = [], eventId, size = 'md', variant = 'default', className = '', label }) => {
    const [showModal, setShowModal] = useState(false);

    // Don't render if no recipients have pubkeys
    const validRecipients = recipients.filter(r => r.pubkey);
    if (validRecipients.length === 0) return null;

    const iconSize = size === 'sm' ? 18 : 20;
    const displayLabel = label ?? (size === 'sm' ? null : 'Zap');

    return (
        <>
            <button
                className={`zap-btn zap-btn-${size} zap-btn-${variant} ${className}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(true); }}
                title="Send a Lightning zap"
            >
                <Zap size={iconSize} />
                {displayLabel && <span>{displayLabel}</span>}
            </button>

            {showModal && (
                <ZapModal
                    recipients={validRecipients}
                    eventId={eventId}
                    onClose={() => setShowModal(false)}
                />
            )}

            <style jsx>{`
                .zap-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    border: 1.5px solid var(--color-gray-200, #e2e8f0);
                    background: transparent;
                    color: var(--color-gray-600, #475569);
                    cursor: pointer;
                    font-family: var(--font-sans, 'Inter', sans-serif);
                    font-weight: 500;
                    transition: all 0.2s ease;
                    border-radius: 8px;
                    white-space: nowrap;
                }

                .zap-btn:hover {
                    color: #f7931a;
                    border-color: #f7931a;
                    background: rgba(247, 147, 26, 0.06);
                }

                .zap-btn-md {
                    padding: 0.5rem 1rem;
                    font-size: 0.875rem;
                    height: 38px;
                }

                .zap-btn-bitcoin.zap-btn-md {
                    background-color: #f7931a;
                    color: white;
                    border: none;
                    height: 42px;
                    padding: 0 24px;
                    font-weight: 600;
                }

                .zap-btn-bitcoin.zap-btn-md:hover {
                    background-color: #e88a18;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 5px rgba(247, 147, 26, 0.2);
                }

                .zap-btn-sm {
                    padding: 0.35rem 0.5rem;
                    font-size: 0.8rem;
                    height: 36px;
                    min-width: 36px;
                    justify-content: center;
                }

                .zap-btn-bitcoin.zap-btn-sm {
                    background-color: #f7931a;
                    color: white;
                    border: none;
                    height: 42px;
                    width: 42px;
                    border-radius: 8px;
                    font-weight: 600;
                }

                .zap-btn-bitcoin.zap-btn-sm:hover {
                    background-color: #e88a18;
                    transform: translateY(-1px);
                }
            `}</style>
        </>
    );
};

export default ZapButton;

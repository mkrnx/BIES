/**
 * WalletConnect — Settings component for NIP-47 Nostr Wallet Connect.
 *
 * Allows users to paste an NWC URI, test the connection, view balance, and disconnect.
 */

import React, { useState } from 'react';
import { Wallet, Unplug, Zap, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';

const WalletConnect = () => {
    const { connected, balance, loading, error, connect, disconnect, refreshBalance } = useWallet();
    const [uri, setUri] = useState('');
    const [localError, setLocalError] = useState(null);

    const handleConnect = async () => {
        setLocalError(null);
        if (!uri.trim()) {
            setLocalError('Please paste an NWC connection string');
            return;
        }
        try {
            await connect(uri.trim());
            setUri(''); // Clear input on success
        } catch (err) {
            setLocalError(err.message);
        }
    };

    const handleDisconnect = () => {
        disconnect();
        setLocalError(null);
    };

    const formatBalance = (msats) => {
        if (msats == null) return null;
        const sats = Math.floor(msats / 1000);
        return sats.toLocaleString();
    };

    const displayError = localError || error;

    return (
        <div className="wallet-connect">
            {connected ? (
                <div className="wallet-connected">
                    <div className="wallet-status">
                        <div className="wallet-status-icon">
                            <CheckCircle size={20} />
                        </div>
                        <div className="wallet-status-info">
                            <p className="wallet-status-label">Wallet Connected</p>
                            {balance != null && (
                                <p className="wallet-balance">
                                    <Zap size={14} />
                                    {formatBalance(balance)} sats
                                    <button
                                        className="refresh-btn"
                                        onClick={refreshBalance}
                                        title="Refresh balance"
                                    >
                                        <RefreshCw size={12} />
                                    </button>
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        className="btn btn-outline btn-sm wallet-disconnect-btn"
                        onClick={handleDisconnect}
                    >
                        <Unplug size={16} />
                        Disconnect
                    </button>
                </div>
            ) : (
                <div className="wallet-setup">
                    <p className="wallet-instructions">
                        Connect your Lightning wallet using Nostr Wallet Connect (NWC).
                        Paste your connection string from Alby, Mutiny, or any NWC-compatible wallet.
                    </p>
                    <div className="wallet-input-row">
                        <input
                            type="password"
                            className="wallet-input"
                            placeholder="nostr+walletconnect://..."
                            value={uri}
                            onChange={(e) => setUri(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                            disabled={loading}
                        />
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={handleConnect}
                            disabled={loading}
                        >
                            {loading ? 'Connecting...' : 'Connect'}
                        </button>
                    </div>
                    {displayError && (
                        <div className="wallet-error">
                            <AlertCircle size={14} />
                            {displayError}
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .wallet-connect {
                    width: 100%;
                }

                .wallet-connected {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                }

                .wallet-status {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .wallet-status-icon {
                    color: #22c55e;
                    display: flex;
                    align-items: center;
                }

                .wallet-status-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .wallet-status-label {
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .wallet-balance {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    font-size: 0.85rem;
                    color: var(--color-gray-600);
                }

                .wallet-balance :global(svg:first-child) {
                    color: #f59e0b;
                }

                .refresh-btn {
                    background: none;
                    border: none;
                    color: var(--color-gray-400);
                    cursor: pointer;
                    padding: 2px;
                    display: flex;
                    align-items: center;
                    border-radius: 4px;
                }
                .refresh-btn:hover {
                    color: var(--color-gray-600);
                    background: var(--color-gray-100);
                }

                .wallet-disconnect-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    color: var(--color-gray-500);
                    white-space: nowrap;
                }

                .wallet-instructions {
                    font-size: 0.85rem;
                    color: var(--color-gray-500);
                    margin-bottom: 0.75rem;
                    line-height: 1.5;
                }

                .wallet-input-row {
                    display: flex;
                    gap: 0.5rem;
                }

                .wallet-input {
                    flex: 1;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    font-size: 0.85rem;
                    font-family: monospace;
                }
                .wallet-input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 59, 130, 246), 0.15);
                }

                .wallet-error {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    margin-top: 0.5rem;
                    font-size: 0.8rem;
                    color: #ef4444;
                }
            `}</style>
        </div>
    );
};

export default WalletConnect;

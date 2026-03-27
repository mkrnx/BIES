/**
 * WalletConnect — Settings component for wallet management.
 *
 * Supports two wallet types:
 *  1. NWC (NIP-47 Nostr Wallet Connect) — paste URI from Alby, Mutiny, etc.
 *  2. Coinos — connect existing account or view auto-provisioned wallet.
 */

import React, { useState } from 'react';
import { Wallet, Unplug, Zap, RefreshCw, CheckCircle, AlertCircle, User } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { COINOS_ENABLED } from '../config/featureFlags';

const WalletConnect = () => {
    const {
        connected, walletType, balance, loading, error,
        connect, connectCoinos, disconnect, refreshBalance,
    } = useWallet();
    const [uri, setUri] = useState('');
    const [localError, setLocalError] = useState(null);
    const [mode, setMode] = useState('nwc'); // 'nwc' | 'coinos'
    const [coinosUser, setCoinosUser] = useState('');
    const [coinosPass, setCoinosPass] = useState('');

    const handleConnectNwc = async () => {
        setLocalError(null);
        if (!uri.trim()) {
            setLocalError('Please paste an NWC connection string');
            return;
        }
        try {
            await connect(uri.trim());
            setUri('');
        } catch (err) {
            setLocalError(err.message);
        }
    };

    const handleConnectCoinos = async () => {
        setLocalError(null);
        if (!coinosUser.trim() || !coinosPass) {
            setLocalError('Username and password are required');
            return;
        }
        try {
            await connectCoinos(coinosUser.trim(), coinosPass);
            setCoinosUser('');
            setCoinosPass('');
        } catch (err) {
            setLocalError(err.message);
        }
    };

    const handleDisconnect = async () => {
        await disconnect();
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
                            <p className="wallet-status-label">
                                {walletType === 'coinos' ? 'Coinos Wallet' : 'Wallet Connected'}
                            </p>
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
                    {COINOS_ENABLED && (
                        <div className="wallet-mode-tabs">
                            <button
                                className={`wallet-tab ${mode === 'nwc' ? 'active' : ''}`}
                                onClick={() => { setMode('nwc'); setLocalError(null); }}
                            >
                                <Wallet size={14} /> NWC
                            </button>
                            <button
                                className={`wallet-tab ${mode === 'coinos' ? 'active' : ''}`}
                                onClick={() => { setMode('coinos'); setLocalError(null); }}
                            >
                                <Zap size={14} /> Coinos
                            </button>
                        </div>
                    )}

                    {mode === 'nwc' ? (
                        <>
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
                                    onKeyDown={(e) => e.key === 'Enter' && handleConnectNwc()}
                                    disabled={loading}
                                />
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleConnectNwc}
                                    disabled={loading}
                                >
                                    {loading ? 'Connecting...' : 'Connect'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="wallet-instructions">
                                Connect your existing Coinos account to send and receive Lightning payments.
                            </p>
                            <div className="wallet-coinos-form">
                                <input
                                    type="text"
                                    className="wallet-input"
                                    placeholder="Coinos username"
                                    value={coinosUser}
                                    onChange={(e) => setCoinosUser(e.target.value)}
                                    disabled={loading}
                                />
                                <input
                                    type="password"
                                    className="wallet-input"
                                    placeholder="Password"
                                    value={coinosPass}
                                    onChange={(e) => setCoinosPass(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleConnectCoinos()}
                                    disabled={loading}
                                />
                                <button
                                    className="btn btn-primary btn-sm wallet-coinos-btn"
                                    onClick={handleConnectCoinos}
                                    disabled={loading}
                                >
                                    {loading ? 'Connecting...' : 'Connect Coinos'}
                                </button>
                            </div>
                        </>
                    )}

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

                .wallet-mode-tabs {
                    display: flex;
                    gap: 0.25rem;
                    margin-bottom: 0.75rem;
                    background: var(--color-gray-100);
                    border-radius: 8px;
                    padding: 3px;
                }

                .wallet-tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    padding: 0.4rem 0.75rem;
                    border: none;
                    border-radius: 6px;
                    background: transparent;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--color-gray-500);
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .wallet-tab.active {
                    background: var(--color-surface);
                    color: var(--color-gray-900);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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

                .wallet-coinos-form {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .wallet-coinos-btn {
                    align-self: flex-end;
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

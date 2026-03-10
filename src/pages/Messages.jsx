import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Send, MoreVertical, Lock, MessageCircle, Loader2, AlertTriangle, X, Users } from 'lucide-react';
import { useNostrDMs } from '../hooks/useNostr';
import { nostrService } from '../services/nostrService';
import { searchApi } from '../services/api';
import { nip19 } from 'nostr-tools';

const Messages = () => {
    const {
        messages,
        conversations,
        profiles,
        loading,
        error,
        connect,
        publicKey,
        sendMessage,
    } = useNostrDMs();

    const [activeChatPubkey, setActiveChatPubkey] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [newChatInput, setNewChatInput] = useState('');
    const [showNewChat, setShowNewChat] = useState(false);
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const chatEndRef = useRef(null);
    const searchTimerRef = useRef(null);

    // Auto-connect on mount
    useEffect(() => {
        if (!publicKey && !loading) {
            connect();
        }
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeChatPubkey, messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !activeChatPubkey || sending) return;

        setSending(true);
        try {
            await sendMessage(activeChatPubkey, newMessage.trim());
            setNewMessage('');
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setSending(false);
        }
    };

    // Search users by name (BIES + Nostr) with debounce
    const handleUserSearch = useCallback((query) => {
        setNewChatInput(query);

        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        // If it looks like an npub or hex pubkey, don't search by name
        if (!query.trim() || query.trim().length < 2 || query.startsWith('npub') || /^[0-9a-f]{10,}$/i.test(query)) {
            setUserSearchResults([]);
            setSearchingUsers(false);
            return;
        }

        setSearchingUsers(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const [biesRes, nostrResults] = await Promise.allSettled([
                    searchApi.search(query, 'profiles', 1, 8),
                    nostrService.searchProfiles(query, 8),
                ]);

                const results = [];
                const seen = new Set();

                // Add BIES profiles first
                if (biesRes.status === 'fulfilled' && biesRes.value?.profiles) {
                    for (const p of biesRes.value.profiles) {
                        if (p.user?.nostrPubkey && !seen.has(p.user.nostrPubkey)) {
                            seen.add(p.user.nostrPubkey);
                            results.push({
                                pubkey: p.user.nostrPubkey,
                                name: p.name || '',
                                avatar: p.avatar || '',
                                source: 'BIES',
                            });
                        }
                    }
                }

                // Add Nostr profiles (dedup by pubkey)
                if (nostrResults.status === 'fulfilled') {
                    for (const p of nostrResults.value) {
                        if (p.pubkey && !seen.has(p.pubkey)) {
                            seen.add(p.pubkey);
                            results.push({
                                pubkey: p.pubkey,
                                name: p.display_name || p.name || '',
                                avatar: p.picture || '',
                                source: 'Nostr',
                                nip05: p.nip05 || '',
                            });
                        }
                    }
                }

                setUserSearchResults(results);
            } catch (err) {
                console.error('User search failed:', err);
            } finally {
                setSearchingUsers(false);
            }
        }, 300);
    }, []);

    const handleSelectUser = (pubkey) => {
        setActiveChatPubkey(pubkey);
        setShowNewChat(false);
        setNewChatInput('');
        setUserSearchResults([]);
    };

    const handleStartNewChat = () => {
        let input = newChatInput.trim();
        if (!input) return;

        // Try as npub or hex pubkey
        let pubkey = input;
        try {
            if (input.startsWith('npub')) {
                pubkey = nip19.decode(input).data;
            }
        } catch {
            return;
        }

        // Validate hex pubkey format (64 hex chars)
        if (/^[0-9a-f]{64}$/i.test(pubkey)) {
            handleSelectUser(pubkey);
        }
    };

    const getDisplayName = (pubkey) => {
        const profile = profiles[pubkey];
        if (profile?.name) return profile.name;
        if (profile?.display_name) return profile.display_name;
        try {
            return nip19.npubEncode(pubkey).substring(0, 16) + '...';
        } catch {
            return pubkey.substring(0, 12) + '...';
        }
    };

    const getAvatar = (pubkey) => {
        const profile = profiles[pubkey];
        return profile?.picture || null;
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now - date;

        if (diff < 86400000) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 604800000) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Sort conversations by last message time
    const sortedConversations = Object.entries(conversations)
        .map(([pubkey, msgs]) => ({
            pubkey,
            messages: msgs,
            lastMessage: msgs[msgs.length - 1],
        }))
        .filter(c => {
            if (!searchQuery) return true;
            const name = getDisplayName(c.pubkey).toLowerCase();
            return name.includes(searchQuery.toLowerCase());
        })
        .sort((a, b) => (b.lastMessage?.created_at || 0) - (a.lastMessage?.created_at || 0));

    const activeMessages = activeChatPubkey ? (conversations[activeChatPubkey] || []) : [];

    // Not connected state
    if (!publicKey && !loading) {
        return (
            <div className="container py-8 h-screen-minus-nav">
                <div className="connect-container">
                    <div className="connect-card">
                        <Lock size={48} className="mb-4 text-primary" />
                        <h2>Connect to Nostr</h2>
                        <p className="text-gray-500 mb-6 text-center">
                            To view and send encrypted private messages, connect with a Nostr extension (like Alby or nos2x).
                        </p>
                        {error && (
                            <div className="error-banner mb-4">
                                <AlertTriangle size={16} /> {error}
                            </div>
                        )}
                        <button className="btn btn-primary" onClick={connect} disabled={loading}>
                            {loading ? 'Connecting...' : 'Connect Extension'}
                        </button>
                    </div>
                </div>
                <style jsx>{`${sharedStyles}`}</style>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container py-8 h-screen-minus-nav">
                <div className="connect-container">
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    <p className="text-gray-500" style={{ marginTop: '1rem' }}>Connecting to Nostr relays...</p>
                </div>
                <style jsx>{`${sharedStyles}`}</style>
            </div>
        );
    }

    return (
        <div className="container py-8 h-screen-minus-nav">
            <div className="messages-layout">
                {/* Sidebar List */}
                <div className="messages-sidebar">
                    <div className="sidebar-header">
                        <h2>Messages</h2>
                        <button className="icon-btn" onClick={() => setShowNewChat(true)} title="New conversation">
                            <MessageCircle size={20} />
                        </button>
                    </div>

                    {showNewChat && (
                        <div className="new-chat-panel">
                            <div className="new-chat-header">
                                <Users size={16} />
                                <span>New conversation</span>
                                <button className="icon-btn" onClick={() => { setShowNewChat(false); setNewChatInput(''); setUserSearchResults([]); }} style={{ marginLeft: 'auto' }}>
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="new-chat-box">
                                <input
                                    type="text"
                                    placeholder="Search by name, npub, or pubkey..."
                                    value={newChatInput}
                                    onChange={e => handleUserSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleStartNewChat()}
                                    autoFocus
                                />
                            </div>
                            {searchingUsers && (
                                <div className="search-status">
                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Searching...</span>
                                </div>
                            )}
                            {userSearchResults.length > 0 && (
                                <div className="user-search-results">
                                    {userSearchResults.map(user => (
                                        <div
                                            key={user.pubkey}
                                            className="user-result-item"
                                            onClick={() => handleSelectUser(user.pubkey)}
                                        >
                                            <div className="chat-avatar small">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : (
                                                    (user.name || '??').substring(0, 2).toUpperCase()
                                                )}
                                            </div>
                                            <div className="user-result-info">
                                                <span className="user-result-name">{user.name || nip19.npubEncode(user.pubkey).substring(0, 16) + '...'}</span>
                                                {user.nip05 && <span className="user-result-nip05">{user.nip05}</span>}
                                            </div>
                                            <span className={`source-badge ${user.source.toLowerCase()}`}>{user.source}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!searchingUsers && newChatInput.trim().length >= 2 && userSearchResults.length === 0 && !newChatInput.startsWith('npub') && !/^[0-9a-f]{10,}$/i.test(newChatInput) && (
                                <div className="search-status" style={{ color: 'var(--color-gray-400)' }}>
                                    No users found
                                </div>
                            )}
                        </div>
                    )}

                    <div className="search-box">
                        <Search size={16} className="text-gray-400" />
                        <input type="text" placeholder="Search chats..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>

                    <div className="conversation-list">
                        {sortedConversations.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-gray-400)', fontSize: '0.9rem' }}>
                                {Object.keys(conversations).length === 0 ? 'No messages yet' : 'No matches'}
                            </div>
                        ) : (
                            sortedConversations.map(({ pubkey, lastMessage }) => {
                                const avatar = getAvatar(pubkey);
                                return (
                                    <div
                                        key={pubkey}
                                        className={`chat-item ${activeChatPubkey === pubkey ? 'active' : ''}`}
                                        onClick={() => setActiveChatPubkey(pubkey)}
                                    >
                                        <div className="chat-avatar">
                                            {avatar ? (
                                                <img src={avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                getDisplayName(pubkey).substring(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div className="chat-info">
                                            <div className="flex justify-between">
                                                <span className="chat-name">{getDisplayName(pubkey)}</span>
                                                <span className="chat-time">{formatTime(lastMessage.created_at)}</span>
                                            </div>
                                            <p className="chat-preview">
                                                {lastMessage.isSender ? 'You: ' : ''}
                                                {lastMessage.content.substring(0, 50)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="chat-area">
                    {activeChatPubkey ? (
                        <>
                            <div className="chat-header">
                                <div className="flex items-center gap-3">
                                    <div className="chat-avatar small">
                                        {getAvatar(activeChatPubkey) ? (
                                            <img src={getAvatar(activeChatPubkey)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            getDisplayName(activeChatPubkey).substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <h3>{getDisplayName(activeChatPubkey)}</h3>
                                        <span className="nip17-badge">NIP-17 Encrypted</span>
                                    </div>
                                </div>
                                <div className="header-actions">
                                    <button className="icon-btn"><MoreVertical size={20} /></button>
                                </div>
                            </div>

                            <div className="active-chat-content">
                                {activeMessages.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'var(--color-gray-400)', margin: 'auto' }}>
                                        <Lock size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                        <p>Start an encrypted conversation</p>
                                    </div>
                                ) : (
                                    activeMessages.map(msg => (
                                        <div key={msg.id} className={`msg ${msg.isSender ? 'sent' : 'received'}`}>
                                            <p>{msg.content}</p>
                                            <span className="msg-time">{formatTime(msg.created_at)}</span>
                                        </div>
                                    ))
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="chat-input-area">
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    disabled={sending}
                                />
                                <button className="btn btn-primary send-btn" onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                                    {sending ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <MessageCircle size={48} className="mb-4 opacity-50" />
                            <p>Select a conversation to start messaging</p>
                            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                                All messages are end-to-end encrypted with NIP-17
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`${sharedStyles}`}</style>
        </div>
    );
};

const sharedStyles = `
    .h-screen-minus-nav { height: calc(100vh - 100px); }

    .connect-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
    }
    .connect-card {
        background: var(--color-surface);
        padding: 3rem;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-lg);
        display: flex;
        flex-direction: column;
        align-items: center;
        max-width: 500px;
        border: 1px solid var(--color-gray-200);
    }

    .error-banner {
        background: var(--color-red-tint);
        color: #EF4444;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
    }

    .messages-layout { display: flex; height: 100%; border: 1px solid var(--color-gray-200); border-radius: var(--radius-lg); overflow: hidden; background: var(--color-surface); }

    .messages-sidebar { width: 320px; border-right: 1px solid var(--color-gray-200); display: flex; flex-direction: column; }
    .sidebar-header { padding: 1rem; border-bottom: 1px solid var(--color-gray-100); display: flex; justify-content: space-between; align-items: center; }

    .new-chat-panel { border-bottom: 1px solid var(--color-gray-200); background: var(--color-gray-50); }
    .new-chat-header { padding: 0.5rem 0.75rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 600; color: var(--color-gray-600); }
    .new-chat-box { padding: 0.5rem 0.75rem; display: flex; gap: 0.5rem; }
    .new-chat-box input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--color-gray-300); border-radius: var(--radius-full); font-size: 0.85rem; outline: none; }
    .new-chat-box input:focus { border-color: var(--color-primary); }

    .search-status { padding: 0.5rem 0.75rem; font-size: 0.8rem; color: var(--color-gray-500); display: flex; align-items: center; gap: 0.5rem; }

    .user-search-results { max-height: 240px; overflow-y: auto; }
    .user-result-item { padding: 0.5rem 0.75rem; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: background 0.15s; }
    .user-result-item:hover { background: var(--color-gray-100); }
    .user-result-info { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
    .user-result-name { font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-result-nip05 { font-size: 0.7rem; color: var(--color-gray-400); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .source-badge { font-size: 0.65rem; padding: 1px 6px; border-radius: 99px; font-weight: 600; flex-shrink: 0; }
    .source-badge.bies { background: var(--color-blue-tint); color: #1E40AF; }
    .source-badge.nostr { background: #F3E8FF; color: #7C3AED; }

    .btn-sm { padding: 0.5rem 0.75rem; font-size: 0.8rem; border-radius: var(--radius-md); border: none; cursor: pointer; font-weight: 600; }

    .search-box { margin: 1rem; padding: 0.5rem 1rem; background: var(--color-gray-100); border-radius: var(--radius-full); display: flex; align-items: center; gap: 0.5rem; }
    .search-box input { background: transparent; border: none; outline: none; font-size: 0.9rem; flex: 1; }

    .conversation-list { flex: 1; overflow-y: auto; }
    .chat-item { padding: 1rem; display: flex; gap: 1rem; cursor: pointer; border-bottom: 1px solid var(--color-gray-50); transition: background 0.2s; position: relative; }
    .chat-item:hover { background: var(--color-gray-50); }
    .chat-item.active { background: var(--color-gray-100); border-left: 3px solid var(--color-primary); }

    .chat-avatar { width: 40px; height: 40px; background: var(--color-gray-200); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--color-gray-600); flex-shrink: 0; overflow: hidden; }
    .chat-avatar.small { width: 32px; height: 32px; font-size: 0.8rem; }

    .chat-info { flex: 1; overflow: hidden; }
    .chat-name { font-weight: 600; font-size: 0.95rem; }
    .chat-time { font-size: 0.75rem; color: var(--color-gray-400); }
    .chat-preview { font-size: 0.85rem; color: var(--color-gray-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .unread-badge { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: var(--color-primary); color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 99px; }

    .nip17-badge { font-size: 0.7rem; background: var(--color-green-tint); color: #166534; padding: 1px 6px; border-radius: 99px; }

    .chat-area { flex: 1; display: flex; flex-direction: column; background: var(--color-gray-50); }
    .chat-header { padding: 1rem; background: var(--color-surface); border-bottom: 1px solid var(--color-gray-200); display: flex; justify-content: space-between; align-items: center; }

    .active-chat-content { flex: 1; padding: 2rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }

    .msg { max-width: 60%; padding: 0.75rem 1rem; border-radius: 12px; position: relative; }
    .msg.received { background: var(--color-surface); border: 1px solid var(--color-gray-200); align-self: flex-start; border-bottom-left-radius: 2px; }
    .msg.sent { background: var(--color-primary); color: white; align-self: flex-end; border-bottom-right-radius: 2px; }

    .msg-time { font-size: 0.7rem; opacity: 0.7; margin-top: 4px; display: block; text-align: right; }

    .chat-input-area { padding: 1rem; background: var(--color-surface); border-top: 1px solid var(--color-gray-200); display: flex; gap: 1rem; }
    .chat-input-area input { flex: 1; padding: 0.75rem 1rem; border: 1px solid var(--color-gray-300); border-radius: var(--radius-full); outline: none; }
    .chat-input-area input:disabled { opacity: 0.5; }
    .send-btn { border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; padding: 0; }

    .icon-btn { padding: 8px; border-radius: 50%; color: var(--color-gray-500); border: none; background: none; cursor: pointer; }
    .icon-btn:hover { background: var(--color-gray-100); }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .gap-3 { gap: 0.75rem; }
    .text-primary { color: var(--color-primary); }
    .btn { border: none; cursor: pointer; font-weight: 600; }
    .btn-primary { background: var(--color-primary); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: var(--radius-full); cursor: pointer; font-weight: 600; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }

    @media (max-width: 768px) {
        .messages-sidebar { width: 100%; }
        .chat-area { display: none; }
        .messages-layout:has(.chat-item.active) .messages-sidebar { display: none; }
        .messages-layout:has(.chat-item.active) .chat-area { display: flex; }
    }
`;

export default Messages;

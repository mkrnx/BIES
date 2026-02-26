import React, { useState, useEffect } from 'react';
import { Search, Send, MoreVertical, Phone, Video, Lock, MessageCircle } from 'lucide-react';
// import { useNostrDMs } from '../hooks/useNostr'; // Disabled for Demo

const Messages = () => {
    // Disabled useNostrDMs hook for demo purposes
    /*
    const {
        messages,
        loading,
        connect,
        publicKey,
        sendMessage,
        decryptMessage
    } = useNostrDMs();
    */

    // Demo State
    const publicKey = "mock-pubkey"; // Pretend we are connected
    const [activeChatPubkey, setActiveChatPubkey] = useState(null);
    const [newMessage, setNewMessage] = useState('');

    // Mock Conversations Data
    const mockConversations = {
        "Alice (Investor)": [
            { id: 1, text: "Hi! I saw your project 'Volcano Energy Solutions'. It looks interesting.", sender: "their", time: "10:30 AM" },
            { id: 2, text: "Thanks Alice! We are currently looking for seed funding.", sender: "mine", time: "10:32 AM" },
            { id: 3, text: "Can you send me your pitch deck?", sender: "their", time: "10:35 AM" }
        ],
        "Bob (Builder)": [
            { id: 1, text: "Hey, are you going to the Bitcoin Beach Party?", sender: "mine", time: "Yesterday" },
            { id: 2, text: "Yes! See you there.", sender: "their", time: "Yesterday" }
        ],
        "Charlie (Dev)": [
            { id: 1, text: "The new API endpoints are ready.", sender: "their", time: "Mon" }
        ]
    };

    const handleSendMessage = () => {
        if (!newMessage.trim() || !activeChatPubkey) return;

        // In a real app we would send to relay. Here we just update local state mock.
        // For this simple demo, we won't persist new messages to the mock object strictly unless desired, 
        // but let's just clear the input to simulate sending.
        // To make it feel real, we could append to a local state copy of conversations.

        alert(`[Demo] Message sent to ${activeChatPubkey}: ${newMessage}`);
        setNewMessage('');
    };

    return (
        <div className="container py-8 h-screen-minus-nav">
            {/* Bypass Connect Screen for Demo */}
            {false ? (
                <div className="connect-container">
                    <div className="connect-card">
                        <Lock size={48} className="mb-4 text-primary" />
                        <h2>Connect to Nostr</h2>
                        <p className="text-gray-500 mb-6 text-center">
                            To view and send encrypted private messages, you need to connect with a Nostr extension (like Alby or nos2x).
                        </p>
                        <button className="btn btn-primary" disabled>
                            Connect Wallet / Extension
                        </button>
                    </div>
                </div>
            ) : (
                <div className="messages-layout">
                    {/* Sidebar List */}
                    <div className="messages-sidebar">
                        <div className="sidebar-header">
                            <h2>Messages</h2>
                            <button className="icon-btn"><MoreVertical size={20} /></button>
                        </div>
                        <div className="search-box">
                            <Search size={16} className="text-gray-400" />
                            <input type="text" placeholder="Search chats..." />
                        </div>
                        <div className="conversation-list">
                            {Object.entries(mockConversations).map(([name, msgs]) => {
                                const lastMsg = msgs[msgs.length - 1];
                                return (
                                    <div
                                        key={name}
                                        className={`chat-item ${activeChatPubkey === name ? 'active' : ''}`}
                                        onClick={() => setActiveChatPubkey(name)}
                                    >
                                        <div className="chat-avatar">{name.substring(0, 2).toUpperCase()}</div>
                                        <div className="chat-info">
                                            <div className="flex justify-between">
                                                <span className="chat-name">{name}</span>
                                                <span className="chat-time">{lastMsg.time}</span>
                                            </div>
                                            <p className="chat-preview">{lastMsg.text}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="chat-area">
                        {activeChatPubkey ? (
                            <>
                                <div className="chat-header">
                                    <div className="flex items-center gap-3">
                                        <div className="chat-avatar small">{activeChatPubkey.substring(0, 2).toUpperCase()}</div>
                                        <h3>{activeChatPubkey}</h3>
                                    </div>
                                    <div className="header-actions">
                                        <button className="icon-btn"><Phone size={20} /></button>
                                        <button className="icon-btn"><Video size={20} /></button>
                                        <button className="icon-btn"><MoreVertical size={20} /></button>
                                    </div>
                                </div>

                                <div className="active-chat-content">
                                    {mockConversations[activeChatPubkey]?.map(msg => (
                                        <div key={msg.id} className={`msg ${msg.sender === 'mine' ? 'sent' : 'received'}`}>
                                            <p>{msg.text}</p>
                                            <span className="msg-time">{msg.time}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="chat-input-area">
                                    <input
                                        type="text"
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button className="btn btn-primary send-btn" onClick={handleSendMessage}>
                                        <Send size={18} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <MessageCircle size={48} className="mb-4 opacity-50" />
                                <p>Select a conversation to start messaging</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                .h-screen-minus-nav { height: calc(100vh - 100px); }
                
                .connect-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100%;
                }
                .connect-card {
                    background: white;
                    padding: 3rem;
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-lg);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    max-width: 500px;
                    border: 1px solid var(--color-gray-200);
                }

                .messages-layout { display: flex; height: 100%; bg: white; border: 1px solid var(--color-gray-200); border-radius: var(--radius-lg); overflow: hidden; background: white; }
                
                .messages-sidebar { width: 320px; border-right: 1px solid var(--color-gray-200); display: flex; flex-direction: column; }
                .sidebar-header { padding: 1rem; border-bottom: 1px solid var(--color-gray-100); display: flex; justify-content: space-between; align-items: center; }
                
                .search-box { margin: 1rem; padding: 0.5rem 1rem; background: var(--color-gray-100); border-radius: var(--radius-full); display: flex; align-items: center; gap: 0.5rem; }
                .search-box input { background: transparent; border: none; outline: none; font-size: 0.9rem; flex: 1; }

                .conversation-list { flex: 1; overflow-y: auto; }
                .chat-item { padding: 1rem; display: flex; gap: 1rem; cursor: pointer; border-bottom: 1px solid var(--color-gray-50); transition: background 0.2s; position: relative; }
                .chat-item:hover { background: var(--color-gray-50); }
                .chat-item.active { background: #EDF5FF; border-left: 3px solid var(--color-primary); }

                .chat-avatar { width: 40px; height: 40px; background: var(--color-gray-200); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--color-gray-600); flex-shrink: 0; }
                .chat-avatar.small { width: 32px; height: 32px; font-size: 0.8rem; }
                
                .chat-info { flex: 1; overflow: hidden; }
                .chat-name { font-weight: 600; font-size: 0.95rem; }
                .chat-time { font-size: 0.75rem; color: var(--color-gray-400); }
                .chat-preview { font-size: 0.85rem; color: var(--color-gray-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                
                .unread-badge { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: var(--color-primary); color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 99px; }

                .chat-area { flex: 1; display: flex; flex-direction: column; background: #F9FAFB; }
                .chat-header { padding: 1rem; background: white; border-bottom: 1px solid var(--color-gray-200); display: flex; justify-content: space-between; align-items: center; }
                
                .active-chat-content { flex: 1; padding: 2rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
                
                .msg { max-width: 60%; padding: 0.75rem 1rem; border-radius: 12px; position: relative; }
                .msg.received { background: white; border: 1px solid var(--color-gray-200); align-self: flex-start; border-bottom-left-radius: 2px; }
                .msg.sent { background: var(--color-primary); color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
                
                .msg-time { font-size: 0.7rem; opacity: 0.7; margin-top: 4px; display: block; text-align: right; }

                .chat-input-area { padding: 1rem; background: white; border-top: 1px solid var(--color-gray-200); display: flex; gap: 1rem; }
                .chat-input-area input { flex: 1; padding: 0.75rem 1rem; border: 1px solid var(--color-gray-300); border-radius: var(--radius-full); outline: none; }
                .send-btn { border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; padding: 0; }

                .icon-btn { padding: 8px; border-radius: 50%; color: var(--color-gray-500); }
                .icon-btn:hover { background: var(--color-gray-100); }
                .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .gap-3 { gap: 0.75rem; }
                .text-primary { color: var(--color-primary); }
                .btn-primary { background: var(--color-primary); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: var(--radius-full); cursor: pointer; font-weight: 600; }
                .btn-primary:hover { opacity: 0.9; }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

                @media (max-width: 768px) {
                    .messages-sidebar { width: 100%; display: ${activeChatPubkey ? 'none' : 'flex'}; }
                    .chat-area { display: ${activeChatPubkey ? 'flex' : 'none'}; }
                }
            `}</style>
        </div>
    );
};

export default Messages;

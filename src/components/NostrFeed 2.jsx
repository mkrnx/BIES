import React from 'react';
import { MessageCircle, Heart, Repeat, Share } from 'lucide-react';
import NostrIcon from './NostrIcon';

const NostrFeed = ({ npub, notes }) => {

    // In a real scenario, this component might fetch dynamically based on npub
    // For now, we utilize the provided mock `notes` array.

    if (!notes || notes.length === 0) {
        return (
            <div className="nostr-feed-empty text-center p-8 bg-gray-50 rounded-xl border border-gray-100 mt-6">
                <p className="text-gray-500 mb-2">No recent notes found.</p>
                <p className="text-sm text-gray-400">Connect a Nostr client to see what they're saying.</p>
            </div>
        );
    }

    return (
        <div className="nostr-feed mt-6">
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-xl font-bold font-display text-gray-900">Nostr Feed</h3>
                <span className="text-xs font-mono bg-purple-50 text-purple-600 px-3 py-1 rounded-md border border-purple-100 flex items-center gap-1" title="Public Nostr Key">
                    <NostrIcon size={12} /> {npub ? `${npub.substring(0, 12)}...` : "npub1..."}
                </span>
            </div>

            <div className="flex flex-col gap-4">
                {notes.map(note => (
                    <div key={note.id} className="note-card p-5 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer">
                        <div className="flex gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-50 shrink-0 flex items-center justify-center text-purple-500 border border-purple-100">
                                <NostrIcon size={18} />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900 leading-tight">Nostr User</div>
                                <div className="text-xs text-gray-400">@nostr_user • 2h</div>
                            </div>
                        </div>
                        <div className="note-body mb-4 text-gray-700 leading-relaxed" style={{ paddingLeft: '52px' }}>
                            {note.text}
                        </div>
                        <div className="note-actions flex gap-6 text-gray-400 text-sm" style={{ paddingLeft: '52px' }}>
                            <button className="flex items-center gap-1.5 hover:text-purple-500 transition-colors"><MessageCircle size={15} /> <span className="text-xs">0</span></button>
                            <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors"><Repeat size={15} /> <span className="text-xs">{note.reposts || 0}</span></button>
                            <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors"><Heart size={15} /> <span className="text-xs">{note.likes || 0}</span></button>
                            <button className="flex items-center gap-1.5 hover:text-purple-500 transition-colors ml-auto"><Share size={15} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NostrFeed;

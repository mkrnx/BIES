import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { profilesApi, projectsApi } from '../services/api';
import ZapModal from './ZapModal';

/**
 * A tag chip that can be zapped. Clicking it fetches all users who share
 * the tag (or all project team members) and opens a ZapModal to split
 * the payment among them.
 *
 * @param {string} props.tag - The tag text to display
 * @param {'tag'|'project'} [props.mode='tag'] - 'tag' fetches users by tag, 'project' fetches project team
 * @param {string} [props.projectId] - Required when mode='project'
 * @param {Array} [props.recipients] - Pre-resolved recipients (skips fetch)
 * @param {string} [props.className] - Additional CSS class
 */
const ZappableTag = ({ tag, mode = 'tag', projectId, recipients: preResolved, className = '' }) => {
    const [showModal, setShowModal] = useState(false);
    const [recipients, setRecipients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // If pre-resolved recipients are provided, use them directly
        if (preResolved && preResolved.length > 0) {
            setRecipients(preResolved);
            setShowModal(true);
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (mode === 'project' && projectId) {
                // Fetch project details to get team members
                const project = await projectsApi.get(projectId);
                const members = [];

                // Add owner
                if (project.owner?.nostrPubkey) {
                    members.push({
                        pubkey: project.owner.nostrPubkey,
                        name: project.owner?.profile?.name || project.owner?.email || 'Owner',
                        avatar: project.owner?.profile?.avatar || '',
                        lud16: project.owner?.profile?.lightningAddress,
                    });
                }

                // Add team members
                for (const tm of (project.teamMembers || [])) {
                    if (tm.user?.nostrPubkey) {
                        members.push({
                            pubkey: tm.user.nostrPubkey,
                            name: tm.user?.profile?.name || 'Team Member',
                            avatar: tm.user?.profile?.avatar || '',
                            lud16: tm.user?.profile?.lightningAddress,
                        });
                    }
                }

                if (members.length === 0) {
                    setError('No team members have a Lightning address');
                    setLoading(false);
                    setTimeout(() => setError(''), 3000);
                    return;
                }

                setRecipients(members);
                setShowModal(true);
            } else {
                // Fetch all users who share this tag
                const res = await profilesApi.list({ search: tag, limit: 50 });
                const profiles = res.data || res || [];

                // Filter to profiles whose tags array actually contains this tag (case-insensitive)
                const tagLower = tag.toLowerCase();
                const matched = profiles.filter(p =>
                    Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase() === tagLower)
                );

                const members = matched
                    .filter(p => p.user?.nostrPubkey || p.nostrPubkey)
                    .map(p => ({
                        pubkey: p.user?.nostrPubkey || p.nostrPubkey,
                        name: p.name || p.biesDisplayName || 'Builder',
                        avatar: p.avatar || '',
                        lud16: p.lightningAddress || '',
                    }));

                if (members.length === 0) {
                    setError('No zappable builders with this tag');
                    setLoading(false);
                    setTimeout(() => setError(''), 3000);
                    return;
                }

                setRecipients(members);
                setShowModal(true);
            }
        } catch (err) {
            console.error('Failed to fetch zap recipients:', err);
            setError('Failed to load recipients');
            setTimeout(() => setError(''), 3000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                className={`zappable-tag ${className}`}
                onClick={handleClick}
                disabled={loading}
                data-testid={`zappable-tag-${tag}`}
                title={`Zap everyone tagged "${tag}"`}
            >
                {loading ? (
                    <Loader2 size={12} className="zappable-tag-spin" />
                ) : (
                    <Zap size={12} className="zappable-tag-icon" />
                )}
                <span>{tag}</span>
                {error && <span className="zappable-tag-error">{error}</span>}
            </button>

            {showModal && recipients.length > 0 && (
                <ZapModal
                    recipients={recipients}
                    onClose={() => setShowModal(false)}
                />
            )}

            <style jsx>{`
                .zappable-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 12px;
                    background-color: var(--color-surface-raised);
                    color: var(--color-gray-700);
                    border-radius: 999px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    border: 1.5px solid transparent;
                    cursor: pointer;
                    font-family: var(--font-sans, 'Inter', sans-serif);
                    transition: all 0.2s ease;
                    position: relative;
                }

                .zappable-tag:hover {
                    border-color: #f7931a;
                    color: #f7931a;
                    background: rgba(247, 147, 26, 0.06);
                }

                .zappable-tag:hover .zappable-tag-icon {
                    color: #f7931a;
                }

                .zappable-tag:disabled {
                    opacity: 0.7;
                    cursor: wait;
                }

                .zappable-tag-icon {
                    color: var(--color-gray-400);
                    flex-shrink: 0;
                    transition: color 0.2s;
                }

                .zappable-tag-spin {
                    animation: zappable-spin 1s linear infinite;
                    color: #f7931a;
                    flex-shrink: 0;
                }

                @keyframes zappable-spin {
                    to { transform: rotate(360deg); }
                }

                .zappable-tag-error {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 50%;
                    transform: translateX(-50%);
                    background: #ef4444;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    white-space: nowrap;
                    z-index: 100;
                    pointer-events: none;
                }
            `}</style>
        </>
    );
};

export default ZappableTag;

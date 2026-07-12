import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';

const YT_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * Classifies a video URL into one of:
 *  - { kind: 'iframe', src }  — YouTube / Vimeo embed
 *  - { kind: 'file', src }    — direct .mp4 / .webm
 *  - { kind: 'link', href }   — unknown but http(s): safe link-out
 *  - { kind: 'none' }         — empty or unusable
 */
const classify = (url) => {
    if (!url || typeof url !== 'string') return { kind: 'none' };

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return { kind: 'none' };
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { kind: 'none' };
    }

    const host = parsed.hostname.replace(/^www\.|^m\./, '').toLowerCase();

    // YouTube
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        let id = '';
        if (parsed.pathname === '/watch') {
            id = parsed.searchParams.get('v') || '';
        } else if (parsed.pathname.startsWith('/embed/')) {
            id = parsed.pathname.slice('/embed/'.length).split('/')[0];
        }
        if (YT_ID_RE.test(id)) {
            return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` };
        }
    }
    if (host === 'youtu.be') {
        const id = parsed.pathname.slice(1).split('/')[0];
        if (YT_ID_RE.test(id)) {
            return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` };
        }
    }

    // Vimeo
    if (host === 'vimeo.com') {
        const match = parsed.pathname.match(/^\/(\d+)/);
        if (match) {
            return { kind: 'iframe', src: `https://player.vimeo.com/video/${match[1]}` };
        }
    }
    if (host === 'player.vimeo.com') {
        const match = parsed.pathname.match(/^\/video\/(\d+)/);
        if (match) {
            return { kind: 'iframe', src: `https://player.vimeo.com/video/${match[1]}` };
        }
    }

    // Direct video files (query strings allowed — pathname excludes them)
    if (/\.(mp4|webm)$/i.test(parsed.pathname)) {
        return { kind: 'file', src: url };
    }

    return { kind: 'link', href: url };
};

const VideoEmbed = ({ url, caption }) => {
    const video = useMemo(() => classify(url), [url]);

    if (video.kind === 'none') return null;

    return (
        <figure style={{ margin: 0 }}>
            {video.kind === 'iframe' && (
                <div style={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: '56.25%',
                    background: 'var(--color-gray-900)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                }}>
                    <iframe
                        src={video.src}
                        title={caption || 'Video'}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            border: 'none',
                        }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="no-referrer"
                    />
                </div>
            )}

            {video.kind === 'file' && (
                <video
                    controls
                    preload="metadata"
                    src={video.src}
                    style={{
                        maxWidth: '100%',
                        width: '100%',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-gray-900)',
                    }}
                >
                    <a href={video.src} target="_blank" rel="noopener noreferrer">{video.src}</a>
                </video>
            )}

            {video.kind === 'link' && (
                <a
                    href={video.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--color-gray-200)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        wordBreak: 'break-all',
                    }}
                >
                    <ExternalLink size={16} style={{ flexShrink: 0 }} /> {video.href}
                </a>
            )}

            {caption && (
                <figcaption style={{
                    margin: '0.5rem 0 0',
                    fontSize: '0.85rem',
                    color: 'var(--color-gray-500)',
                }}>
                    {caption}
                </figcaption>
            )}
        </figure>
    );
};

export default VideoEmbed;

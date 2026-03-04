import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ExternalLink, ArrowLeft, Clock, Tag, Loader2, CheckCircle } from 'lucide-react';
import { eventsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ZapButton from '../components/ZapButton';

const EventDetail = () => {
    const { id } = useParams();
    const { isAuthenticated } = useAuth();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rsvpStatus, setRsvpStatus] = useState(null); // null | 'GOING' | 'MAYBE'
    const [rsvpLoading, setRsvpLoading] = useState(false);

    useEffect(() => {
        const fetchEvent = async () => {
            setLoading(true);
            try {
                const result = await eventsApi.get(id);
                setEvent(result);
                if (result?.rsvpStatus) setRsvpStatus(result.rsvpStatus);
            } catch (err) {
                setError(err.message || 'Failed to load event');
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [id]);

    const handleRsvp = async () => {
        if (!isAuthenticated) return;
        setRsvpLoading(true);
        try {
            if (rsvpStatus) {
                await eventsApi.cancelRsvp(id);
                setRsvpStatus(null);
            } else {
                await eventsApi.rsvp(id, 'GOING');
                setRsvpStatus('GOING');
            }
        } catch { /* ignore */ }
        finally { setRsvpLoading(false); }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return dateStr; }
    };

    if (loading) {
        return (
            <div className="event-detail-page">
                <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                </div>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="event-detail-page">
                <div className="container">
                    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                        <h2>Event not found</h2>
                        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>{error || "This event doesn't exist or has been removed."}</p>
                        <Link to="/events" className="back-link" style={{ marginTop: '1.5rem', display: 'inline-flex' }}>
                            <ArrowLeft size={16} /> Back to Events
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const description = event.fullDescription || event.description || '';

    return (
        <div className="event-detail-page">
            <div className="container">
                <Link to="/events" className="back-link">
                    <ArrowLeft size={16} /> Back to Events
                </Link>

                {(event.image || event.coverImage) && (
                    <div className="hero-image">
                        <img src={event.image || event.coverImage} alt={event.title} />
                        <span className={`category-badge ${(event.category || '').toLowerCase()}`}>
                            {event.category}
                        </span>
                    </div>
                )}

                <div className="detail-grid">
                    <div className="main-content">
                        <h1>{event.title}</h1>
                        {event.organizer && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <p className="organizer" style={{ margin: 0 }}>Hosted by {event.organizer}</p>
                                {event.host?.nostrPubkey && (
                                    <ZapButton
                                        recipients={[{ pubkey: event.host.nostrPubkey, name: event.host?.profile?.name || event.organizer, avatar: event.host?.profile?.avatar || '' }]}
                                        size="sm"
                                    />
                                )}
                            </div>
                        )}

                        <div className="description">
                            {description.split('\n\n').map((paragraph, i) => (
                                <p key={i}>{paragraph}</p>
                            ))}
                        </div>

                        {(event.tags || []).length > 0 && (
                            <div className="tags">
                                {event.tags.map(tag => (
                                    <span key={tag} className="tag">
                                        <Tag size={12} /> {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="detail-sidebar">
                        <div className="info-card">
                            <h3>Event Details</h3>

                            <div className="info-row">
                                <Calendar size={18} />
                                <div>
                                    <span className="info-label">Date</span>
                                    <span className="info-value">{formatDate(event.date || event.startDate)}</span>
                                </div>
                            </div>

                            {(event.time || event.startTime) && (
                                <div className="info-row">
                                    <Clock size={18} />
                                    <div>
                                        <span className="info-label">Time</span>
                                        <span className="info-value">{event.time || event.startTime}</span>
                                    </div>
                                </div>
                            )}

                            <div className="info-row">
                                <MapPin size={18} />
                                <div>
                                    <span className="info-label">Location</span>
                                    <span className="info-value">{event.location}</span>
                                </div>
                            </div>

                            {event.attendees > 0 && (
                                <div className="info-row">
                                    <Users size={18} />
                                    <div>
                                        <span className="info-label">Attendees</span>
                                        <span className="info-value">{event.attendees}+ expected</span>
                                    </div>
                                </div>
                            )}

                            {isAuthenticated && (
                                <button
                                    className={`rsvp-btn ${rsvpStatus ? 'going' : ''}`}
                                    onClick={handleRsvp}
                                    disabled={rsvpLoading}
                                >
                                    {rsvpStatus ? (
                                        <><CheckCircle size={16} /> Going</>
                                    ) : (
                                        'RSVP'
                                    )}
                                </button>
                            )}

                            {event.externalUrl && (
                                <a
                                    href={event.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ticket-btn"
                                >
                                    Get Tickets <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .event-detail-page {
                    background: var(--color-gray-50);
                    min-height: 100vh;
                    padding-bottom: 4rem;
                }
                .container {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 0 1rem;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--color-gray-500);
                    font-size: 0.9rem;
                    font-weight: 500;
                    margin: 1.5rem 0;
                    transition: color 0.2s;
                }
                .back-link:hover { color: var(--color-gray-900); }

                .hero-image {
                    width: 100%;
                    height: 400px;
                    border-radius: 16px;
                    overflow: hidden;
                    position: relative;
                    margin-bottom: 2rem;
                }
                .hero-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .category-badge {
                    position: absolute;
                    top: 1.5rem;
                    right: 1.5rem;
                    padding: 0.35rem 1rem;
                    border-radius: 9999px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    backdrop-filter: blur(4px);
                }
                .category-badge.official, .category-badge.conference { background: rgba(0, 71, 171, 0.9); color: white; }
                .category-badge.network, .category-badge.networking { background: rgba(255, 91, 0, 0.9); color: white; }
                .category-badge.community, .category-badge.meetup { background: rgba(16, 185, 129, 0.9); color: white; }
                .category-badge.private { background: rgba(0, 0, 0, 0.8); color: white; }
                .category-badge.education, .category-badge.workshop { background: rgba(124, 58, 237, 0.9); color: white; }
                .category-badge.hackathon { background: rgba(234, 88, 12, 0.9); color: white; }

                .detail-grid {
                    display: grid;
                    grid-template-columns: 1fr 360px;
                    gap: 2rem;
                    align-items: start;
                }

                .main-content h1 {
                    font-size: 2rem;
                    font-weight: 800;
                    margin-bottom: 0.5rem;
                    color: var(--color-gray-900);
                }

                .organizer {
                    color: var(--color-gray-500);
                    font-size: 0.95rem;
                    margin-bottom: 2rem;
                }

                .description p {
                    color: var(--color-gray-700);
                    line-height: 1.75;
                    margin-bottom: 1rem;
                    font-size: 1rem;
                }

                .tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-top: 1.5rem;
                }

                .tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.3rem 0.75rem;
                    background: var(--color-gray-200);
                    color: var(--color-gray-600);
                    border-radius: 9999px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .info-card {
                    background: white;
                    border-radius: var(--radius-xl);
                    padding: 1.75rem;
                    box-shadow: var(--shadow-md);
                    border: 1px solid var(--color-gray-200);
                    position: sticky;
                    top: 100px;
                }

                .info-card h3 {
                    font-size: 1.1rem;
                    font-weight: 700;
                    margin-bottom: 1.5rem;
                    color: var(--color-gray-900);
                }

                .info-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    margin-bottom: 1.25rem;
                    color: var(--color-secondary);
                }

                .info-row div {
                    display: flex;
                    flex-direction: column;
                }

                .info-label {
                    font-size: 0.75rem;
                    color: var(--color-gray-400);
                    text-transform: uppercase;
                    font-weight: 600;
                    margin-bottom: 0.15rem;
                }

                .info-value {
                    font-size: 0.95rem;
                    color: var(--color-gray-800);
                    font-weight: 500;
                }

                .rsvp-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.85rem;
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 0.75rem;
                }
                .rsvp-btn:hover:not(:disabled) { opacity: 0.9; }
                .rsvp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .rsvp-btn.going { background: var(--color-success); }

                .ticket-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.85rem;
                    background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-dark) 100%);
                    color: white;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    transition: all 0.2s;
                    margin-top: 0.5rem;
                }
                .ticket-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
                }

                @media (max-width: 768px) {
                    .hero-image { height: 250px; }
                    .detail-grid {
                        grid-template-columns: 1fr;
                    }
                    .info-card { position: static; }
                    .main-content h1 { font-size: 1.5rem; }
                }
            `}</style>
        </div>
    );
};

export default EventDetail;

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Calendar, MapPin, Clock, Users, Globe, Link as LinkIcon, ShieldCheck, Award, Zap, AlertCircle, Share2, Facebook, Twitter, Mail, Check, MessageSquare, Loader2, Tag, ExternalLink, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';
import { eventsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ZapButton from '../components/ZapButton';
import DOMPurify from 'dompurify';
import TranslatableText from '../components/TranslatableText';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { useLightbox } from '../context/LightboxContext';

const EventDetail = () => {
    const { id } = useParams();
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();
    const lightbox = useLightbox();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rsvpStatus, setRsvpStatus] = useState(null); // null | 'GOING' | 'INTERESTED' | 'NOT_GOING'
    const [rsvpLoading, setRsvpLoading] = useState(false);
    const [showRsvpDropdown, setShowRsvpDropdown] = useState(false);

    const parseEvent = (data) => {
        if (!data) return data;
        const parsed = { ...data };
        try {
            if (typeof parsed.tags === 'string') parsed.tags = JSON.parse(parsed.tags || '[]');
            if (typeof parsed.customSections === 'string') parsed.customSections = JSON.parse(parsed.customSections || '[]');
            if (typeof parsed.guestList === 'string') parsed.guestList = JSON.parse(parsed.guestList || '[]');
        } catch (e) {
            console.error('Error parsing event JSON fields:', e);
        }
        return parsed;
    };

    const fetchEvent = async () => {
        setLoading(true);
        try {
            const result = await eventsApi.get(id);
            const parsed = parseEvent(result);
            setEvent(parsed);
            if (parsed?.rsvpStatus) setRsvpStatus(parsed.rsvpStatus);
        } catch (err) {
            console.error('Error fetching event:', err);
            setError(err.message || 'Failed to load event');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvent();
    }, [id]);

    const handleRsvp = async (status) => {
        if (!isAuthenticated) return;
        setRsvpLoading(true);
        try {
            if (status === 'NOT_GOING' || status === null) {
                await eventsApi.cancelRsvp(id);
                setRsvpStatus(null);
            } else {
                await eventsApi.rsvp(id, status);
                setRsvpStatus(status);
            }
            // Refresh event data to update attendee list
            const result = await eventsApi.get(id);
            setEvent(parseEvent(result));
        } catch (err) {
            console.error('RSVP error:', err);
        } finally {
            setRsvpLoading(false);
            setShowRsvpDropdown(false);
        }
    };

    const getRsvpLabel = (status) => {
        switch (status) {
            case 'GOING': return t('eventDetail.attending', 'Attending');
            case 'INTERESTED': return t('eventDetail.thinkingAboutIt', 'Thinking About It');
            case 'NOT_GOING': return t('eventDetail.notAttending', 'Not Attending');
            default: return t('eventDetail.rsvp', 'RSVP');
        }
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
                        <h2>{t('eventDetail.eventNotFound', 'Event not found')}</h2>
                        <p style={{ color: '#64748b', margin: '0.5rem 0' }}>{error || t('eventDetail.eventNotFoundDesc', "This event doesn't exist or has been removed.")}</p>
                        <Link to="/events" className="back-link" style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', fontWeight: 500, color: 'var(--color-primary)' }}>
                            <ArrowLeft size={16} /> {t('eventDetail.backToEvents', 'Back to Events')}
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
                <div className="hero-image">
                    {(event.coverImage || event.thumbnail || event.image) && (
                        <img
                            src={getAssetUrl(event.coverImage || event.thumbnail || event.image)}
                            alt={event.title}
                            onClick={() => lightbox.open(getAssetUrl(event.coverImage || event.thumbnail || event.image))}
                            style={{ cursor: 'pointer' }}
                        />
                    )}
                    <Link to="/events" style={{
                        position: 'absolute', top: '24px', left: '24px',
                        borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-gray-200)',
                        width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        textDecoration: 'none', color: 'var(--color-gray-700)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                        zIndex: 10,
                    }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <span className={`category-badge ${(event.category || '').toLowerCase()}`}>
                        {event.category?.replace(/_/g, ' ')}
                    </span>
                </div>

                <div className="detail-grid">
                    <div className="main-content">
                        <h1>{event.title}</h1>
                        {(event.organizer || event.host?.profile?.name || event.host?.profile?.company) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <p className="organizer" style={{ margin: 0 }}>
                                    {t('eventDetail.hostedBy', 'Hosted by')}{' '}
                                    {event.host?.id ? (
                                        <Link to={`/builder/${event.host.id}`} style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
                                            {event.organizer || event.host?.profile?.name || event.host?.profile?.company || 'BIES Community'}
                                        </Link>
                                    ) : (
                                        <span style={{ fontWeight: 600 }}>{event.organizer || 'BIES Community'}</span>
                                    )}
                                </p>
                                {event.host?.nostrPubkey && (
                                    <ZapButton
                                        recipients={[{ pubkey: event.host.nostrPubkey, name: event.host?.profile?.name || event.organizer, avatar: getAssetUrl(event.host?.profile?.avatar) || '', lud16: event.host?.profile?.lightningAddress }]}
                                        size="sm"
                                    />
                                )}
                            </div>
                        )}

                        <div className="pd-card" style={{ marginTop: '1.5rem', padding: '1.75rem', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-gray-200)', boxShadow: 'var(--shadow-md)' }}>
                            <TranslatableText
                                title={t('eventDetail.aboutEvent', 'About Event')}
                                titleStyle={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-gray-900)' }}
                                text={description}
                                isHtml={true}
                                className="description rich-text-content"
                                style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.75 }}
                            />
                        </div>

                        {Array.isArray(event.tags) && event.tags.length > 0 && (
                            <div className="tags">
                                {event.tags.map(tag => (
                                    <span key={tag} className="tag">
                                        <Tag size={12} /> {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {Array.isArray(event.customSections) && event.customSections
                            .filter(s => s.placement === 'LEFT' || !s.placement)
                            .map((section, idx) => (
                                <EventSection key={idx} section={section} />
                            ))
                        }

                    </div>

                    <div className="detail-sidebar">
                        <div className="info-card">
                            <h3>{t('eventDetail.eventDetails', 'Event Details')}</h3>

                            <div className="info-row">
                                <Calendar size={18} />
                                <div>
                                    <span className="info-label">{t('eventDetail.date', 'Date')}</span>
                                    <span className="info-value">{formatDate(event.date || event.startDate)}</span>
                                </div>
                            </div>

                            {(event.time || event.startDate) && (
                                <div className="info-row">
                                    <Clock size={18} />
                                    <div>
                                        <span className="info-label">{t('eventDetail.time', 'Time')}</span>
                                        <span className="info-value">
                                            {event.time || new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="info-row">
                                <MapPin size={18} />
                                <div>
                                    <span className="info-label">{t('eventDetail.locationLabel', 'Location')}</span>
                                    <span className="info-value">{event.location}</span>
                                </div>
                            </div>

                            {(event.attendeeCount > 0 || event._count?.attendees > 0 || (typeof event.attendees === 'number' && event.attendees > 0)) && (
                                <div className="info-row">
                                    <Users size={18} />
                                    <div>
                                        <span className="info-label">{t('eventDetail.attendees', 'Attendees')}</span>
                                        <span className="info-value">
                                            {event.attendeeCount || event._count?.attendees || (typeof event.attendees === 'number' ? event.attendees : 0)}
                                            {` + ${t('eventDetail.expected', 'expected')}`}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {isAuthenticated && (
                                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                                    <button
                                        className={`rsvp-btn ${rsvpStatus ? 'going' : ''}`}
                                        onClick={() => setShowRsvpDropdown(!showRsvpDropdown)}
                                        disabled={rsvpLoading}
                                    >
                                        {rsvpStatus === 'GOING' ? <CheckCircle size={16} /> : null}
                                        {getRsvpLabel(rsvpStatus)}
                                    </button>

                                    {showRsvpDropdown && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            background: 'var(--color-surface)',
                                            borderRadius: '10px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            border: '1px solid var(--color-gray-200)',
                                            zIndex: 20,
                                            marginTop: '4px',
                                            overflow: 'hidden'
                                        }}>
                                            <button
                                                className="dropdown-item"
                                                onClick={() => handleRsvp('GOING')}
                                                style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, borderBottom: '1px solid var(--color-gray-50)' }}
                                            >
                                                {t('eventDetail.attending', 'Attending')}
                                            </button>
                                            <button
                                                className="dropdown-item"
                                                onClick={() => handleRsvp('INTERESTED')}
                                                style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, borderBottom: '1px solid var(--color-gray-50)' }}
                                            >
                                                {t('eventDetail.thinkingAboutIt', 'Thinking About It')}
                                            </button>
                                            <button
                                                className="dropdown-item"
                                                onClick={() => handleRsvp(null)}
                                                style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, color: '#ef4444' }}
                                            >
                                                {t('eventDetail.notAttending', 'Not Attending')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(event.externalUrl || event.ticketUrl) && (
                                <a
                                    href={event.externalUrl || event.ticketUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ticket-btn"
                                >
                                    Get Tickets <ExternalLink size={14} />
                                </a>
                            )}
                        </div>

                        {/* Attendees Card — below Event Details */}
                        {event.attendees && Array.isArray(event.attendees) && event.attendees.filter(a => a.status === 'GOING').length > 0 && (
                            <div className="info-card" style={{ marginTop: '1.25rem' }}>
                                <h3 style={{ marginBottom: '1rem' }}>
                                    Attending
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-gray-400)' }}>
                                        ({event.attendees.filter(a => a.status === 'GOING').length})
                                    </span>
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                    {event.attendees.filter(a => a.status === 'GOING').slice(0, 8).map((attendee) => (
                                        <Link
                                            key={attendee.id}
                                            to={`/builder/${attendee.user?.id}`}
                                            className="attendee-row"
                                        >
                                            <div className="attendee-avatar">
                                                {attendee.user?.profile?.avatar ? (
                                                    <img src={getAssetUrl(attendee.user.profile.avatar)} alt="" />
                                                ) : (
                                                    <span>{attendee.user?.profile?.name?.charAt(0) || '?'}</span>
                                                )}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-gray-900)' }}>
                                                    {attendee.user?.profile?.name || 'Community Member'}
                                                </div>
                                                {attendee.user?.profile?.company && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {attendee.user.profile.company}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                    {event.attendees.filter(a => a.status === 'GOING').length > 8 && (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)', marginTop: '0.25rem', textAlign: 'center' }}>
                                            +{event.attendees.filter(a => a.status === 'GOING').length - 8} more attending
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        {/* Right-placement custom sections */}
                        {Array.isArray(event.customSections) && event.customSections
                            .filter(s => s.placement === 'RIGHT')
                            .map((section, idx) => (
                                <EventSection key={`right-${idx}`} section={section} isSidebar />
                            ))
                        }
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
                    padding: 2rem 1rem 0;
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
                    background: linear-gradient(135deg, #0052cc 0%, #0a192f 100%);
                }
                .hero-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    position: absolute;
                    inset: 0;
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
                    background: var(--color-surface);
                    border-radius: var(--radius-xl);
                    padding: 1.75rem;
                    box-shadow: var(--shadow-md);
                    border: 1px solid var(--color-gray-200);
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

                .dropdown-item:hover {
                    background-color: var(--color-gray-50);
                }

                .attendee-card:hover {
                    border-color: var(--color-primary) !important;
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-sm);
                }

                .attendee-row {
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                    text-decoration: none;
                    color: inherit;
                    padding: 0.4rem 0.5rem;
                    border-radius: 8px;
                    transition: background 0.15s;
                }
                .attendee-row:hover { background: var(--color-gray-50); }
                .attendee-avatar {
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    overflow: hidden;
                    background: var(--color-gray-100);
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 0.8rem;
                    color: var(--color-gray-500);
                }
                .attendee-avatar img { width: 100%; height: 100%; object-fit: cover; }

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

// ─── Rich Section Renderer ───────────────────────────────────────────────────

const PIE_COLORS = ['#F97316', '#0052cc', '#22c55e', '#8b5cf6', '#ef4444', '#06b6d4', '#eab308', '#ec4899'];

const EventSection = ({ section, isSidebar }) => {
    const stype = section.type || 'TEXT';
    return (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-gray-200)', borderRadius: '12px', padding: isSidebar ? '1.25rem' : '1.75rem', marginTop: '1.5rem' }}>
            {stype === 'TEXT' ? (
                <TranslatableText
                    title={section.title}
                    titleTag="h2"
                    titleStyle={{ fontSize: isSidebar ? '1rem' : '1.35rem', fontWeight: 700, color: '#111827', margin: '0 0 1rem', letterSpacing: '-0.01em' }}
                    text={section.body || section.content || ''}
                    isHtml={true}
                    className="rich-text-content"
                    style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.75 }}
                />
            ) : (
                <>
                    {section.title && (
                        <h2 style={{ fontSize: isSidebar ? '1rem' : '1.35rem', fontWeight: 700, color: '#111827', margin: '0 0 1rem', letterSpacing: '-0.01em' }}>{section.title}</h2>
                    )}
                </>
            )}
            {stype === 'PHOTO' && section.imageUrl && (
                <img src={section.imageUrl} alt={section.title || ''} onClick={() => lightbox.open(section.imageUrl)} style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', cursor: 'pointer' }} />
            )}
            {stype === 'CAROUSEL' && section.images?.length > 0 && (
                <EventCarousel images={section.images} onImageClick={(img, imgs) => lightbox.open(img, imgs)} />
            )}
            {stype === 'GRAPH' && section.dataPoints?.length > 0 && (
                <div style={{ width: '100%', height: isSidebar ? '240px' : '340px', marginTop: section.title ? '0.5rem' : '0' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        {section.graphType === 'BAR' ? (
                            <BarChart data={section.dataPoints} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false}>
                                    {section.xAxisLabel && <Label value={section.xAxisLabel} offset={-10} position="insideBottom" fill="#4b5563" fontSize={12} fontWeight={600} />}
                                </XAxis>
                                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        ) : section.graphType === 'LINE' ? (
                            <LineChart data={section.dataPoints} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={3} dot={{ fill: 'var(--color-primary)', r: 4 }} />
                            </LineChart>
                        ) : (
                            <PieChart>
                                <Pie data={section.dataPoints} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={isSidebar ? 70 : 110} label>
                                    {section.dataPoints.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                <Legend />
                            </PieChart>
                        )}
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

const EventCarousel = ({ images, onImageClick }) => {
    const [idx, setIdx] = useState(0);
    if (!images?.length) return null;
    return (
        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#f3f4f6' }}>
            <div style={{ display: 'flex', transition: 'transform 0.4s ease', transform: `translateX(-${idx * 100}%)`, height: '320px' }}>
                {images.map((img, i) => (
                    <img key={i} src={img} alt="" onClick={() => onImageClick && onImageClick(img, images)} style={{ width: '100%', height: '100%', objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }} />
                ))}
            </div>
            {images.length > 1 && (
                <>
                    <button onClick={() => setIdx(p => p === 0 ? images.length - 1 : p - 1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <ChevronLeft size={20} color="#374151" />
                    </button>
                    <button onClick={() => setIdx(p => p === images.length - 1 ? 0 : p + 1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <ChevronRight size={20} color="#374151" />
                    </button>
                    <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                        {images.map((_, i) => (
                            <div key={i} onClick={() => setIdx(i)} style={{ width: 8, height: 8, borderRadius: '50%', background: i === idx ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)', cursor: 'pointer' }} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

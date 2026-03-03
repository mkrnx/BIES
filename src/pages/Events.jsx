import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ExternalLink, Users, Search, Loader2 } from 'lucide-react';
import { eventsApi } from '../services/api';

const Events = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const categories = ['Official', 'Network', 'Community', 'Private', 'Education'];

    useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true);
            try {
                const params = { page, limit: 12, upcoming: true };
                if (search) params.search = search;
                if (category) params.category = category;
                const result = await eventsApi.list(params);
                const list = result?.data || result || [];
                setEvents(Array.isArray(list) ? list : []);
                setTotalPages(result?.totalPages || 1);
            } catch {
                setEvents([]);
            } finally {
                setLoading(false);
            }
        };
        const debounce = setTimeout(fetchEvents, 300);
        return () => clearTimeout(debounce);
    }, [search, category, page]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return dateStr; }
    };

    return (
        <div className="events-page">
            <div className="container py-12">
                <div className="header mb-10 text-center">
                    <h1 className="text-4xl font-bold mb-4">Ecosystem Events</h1>
                    <p className="text-gray-500 max-w-2xl mx-auto">
                        Connect with the community, learn from experts, and participate in the financial revolution happening in El Salvador.
                    </p>
                </div>

                <div className="filters">
                    <div className="search-bar">
                        <Search size={18} className="text-gray-400" />
                        <input type="text" placeholder="Search events..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    </div>
                    <div className="category-filters">
                        <button className={`filter-btn ${!category ? 'active' : ''}`} onClick={() => { setCategory(''); setPage(1); }}>All</button>
                        {categories.map(cat => (
                            <button key={cat} className={`filter-btn ${category === cat ? 'active' : ''}`} onClick={() => { setCategory(category === cat ? '' : cat); setPage(1); }}>
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    </div>
                ) : events.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>
                        No events found{search ? ` matching "${search}"` : ''}.
                    </div>
                ) : (
                    <div className="events-grid">
                        {events.map(event => (
                            <div key={event.id} className="event-card">
                                <Link
                                    to={`/events/${event.id}`}
                                    className="card-image"
                                    style={{
                                        backgroundImage: event.image || event.coverImage ? `url(${event.image || event.coverImage})` : undefined,
                                        backgroundColor: !event.image && !event.coverImage ? 'var(--color-gray-200)' : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        height: '160px',
                                        display: 'block',
                                        position: 'relative',
                                    }}
                                >
                                    <span className={`category-badge ${(event.category || '').toLowerCase()}`}>
                                        {event.category}
                                    </span>
                                </Link>
                                <div className="card-content">
                                    <div className="meta-row mb-2">
                                        <span className="date flex items-center gap-1 text-primary font-semibold text-sm">
                                            <Calendar size={14} /> {formatDate(event.date || event.startDate)}
                                        </span>
                                        {event.attendees > 0 && (
                                            <span className="attendees flex items-center gap-1 text-gray-400 text-xs">
                                                <Users size={12} /> {event.attendees}+
                                            </span>
                                        )}
                                    </div>
                                    <Link to={`/events/${event.id}`} className="event-title-link">
                                        <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                                    </Link>
                                    <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                                        {event.description}
                                    </p>
                                    <div className="location mb-4 flex items-center gap-1 text-gray-500 text-sm">
                                        <MapPin size={14} /> {event.location}
                                    </div>
                                    <Link to={`/events/${event.id}`} className="view-btn">
                                        View Details <ExternalLink size={14} />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="pagination">
                        <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button className="btn btn-outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                )}
            </div>

            <style jsx>{`
                .events-page {
                    background: var(--color-gray-50);
                    min-height: 100vh;
                }
                .mb-10 { margin-bottom: 2.5rem; }

                .filters {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    align-items: center;
                }

                .search-bar {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    background: white;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-full);
                    width: 100%;
                    max-width: 400px;
                    box-shadow: var(--shadow-sm);
                }
                .search-bar input {
                    border: none;
                    outline: none;
                    width: 100%;
                    font-size: 1rem;
                }

                .category-filters {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                .filter-btn {
                    padding: 0.4rem 1rem;
                    border-radius: 99px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--color-gray-500);
                    border: 1px solid var(--color-gray-200);
                    background: white;
                    transition: all 0.2s;
                }
                .filter-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
                .filter-btn.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

                .event-card {
                    background: white;
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    border: 1px solid var(--color-gray-200);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .event-card:hover {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow-lg);
                }

                .card-image {
                    height: 160px;
                    position: relative;
                    background-size: cover;
                    background-position: center;
                }

                .category-badge {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    backdrop-filter: blur(4px);
                }
                .category-badge.official { background: rgba(0, 71, 171, 0.9); color: white; }
                .category-badge.network, .category-badge.networking { background: rgba(255, 91, 0, 0.9); color: white; }
                .category-badge.community, .category-badge.meetup { background: rgba(16, 185, 129, 0.9); color: white; }
                .category-badge.private { background: rgba(0, 0, 0, 0.8); color: white; }
                .category-badge.education, .category-badge.workshop { background: rgba(124, 58, 237, 0.9); color: white; }
                .category-badge.conference { background: rgba(0, 71, 171, 0.9); color: white; }
                .category-badge.hackathon { background: rgba(234, 88, 12, 0.9); color: white; }
                .category-badge.demo_day { background: rgba(79, 70, 229, 0.9); color: white; }

                .card-content {
                    padding: 1.5rem;
                }

                .meta-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .view-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.75rem;
                    background: var(--color-gray-100);
                    color: var(--color-gray-600);
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    transition: all 0.2s;
                    text-decoration: none;
                }
                .view-btn:hover {
                    background: var(--color-gray-200);
                    color: var(--color-gray-800);
                }

                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .events-grid {
                    display: grid;
                    gap: 2rem;
                    grid-template-columns: repeat(1, 1fr);
                }

                @media (min-width: 640px) {
                    .events-grid { grid-template-columns: repeat(2, 1fr); }
                }

                @media (min-width: 1024px) {
                    .events-grid { grid-template-columns: repeat(3, 1fr); }
                }

                .event-title-link {
                    text-decoration: none;
                    color: inherit;
                }
                .event-title-link:hover h3 {
                    color: var(--color-secondary);
                }
                .event-title-link h3 {
                    transition: color 0.2s;
                }

                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 1rem;
                    margin-top: 3rem;
                }
            `}</style>
        </div>
    );
};

export default Events;

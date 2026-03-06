import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalendarIcon, MapPin, Users, Search, Loader2, ChevronRight, ChevronLeft, ShieldCheck, Globe, Plus, Award } from 'lucide-react';
import { eventsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MOCK_OFFICIAL_EVENTS = [
    {
        id: 'mock-off-1',
        title: 'Bitcoin & Business Summit El Salvador 2026',
        description: 'The flagship annual gathering for builders, investors, and entrepreneurs building the Bitcoin economy in El Salvador. Featuring keynotes, panels, and deal-making sessions.',
        category: 'CONFERENCE',
        startDate: '2026-04-15T09:00:00Z',
        location: 'Hotel Decameron, Santa Elena, El Salvador',
        isOfficial: true,
        isOnline: false,
        coverImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
        externalUrl: 'https://satlantis.io',
    },
    {
        id: 'mock-off-2',
        title: 'BIES Hackathon: Lightning Applications',
        description: 'A 48-hour hackathon focused on building Lightning Network-powered applications. Cash prizes and mentorship from top Bitcoin developers in the ecosystem.',
        category: 'HACKATHON',
        startDate: '2026-05-03T10:00:00Z',
        location: 'Chivo Lab, San Salvador, El Salvador',
        isOfficial: true,
        isOnline: false,
        coverImage: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
        externalUrl: 'https://satlantis.io',
    },
    {
        id: 'mock-off-3',
        title: 'Investor Demo Day — Spring 2026',
        description: 'Top BIES-vetted startups pitch live to a curated audience of Bitcoin-native investors. Apply to present or register as an investor to attend.',
        category: 'DEMO_DAY',
        startDate: '2026-05-20T14:00:00Z',
        location: 'Virtual & In-Person — San Salvador',
        isOfficial: true,
        isOnline: true,
        coverImage: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
        externalUrl: 'https://satlantis.io',
    },
];

const MOCK_COMMUNITY_EVENTS = [
    {
        id: 'mock-com-1',
        title: 'Bitcoin Builders Meetup — San Salvador',
        description: 'Monthly casual meetup for developers and founders building on Bitcoin. Share what you\'re working on, swap ideas, and connect with the local community.',
        category: 'MEETUP',
        startDate: '2026-03-18T18:30:00Z',
        location: 'La Ventana Café, San Salvador',
        isOfficial: false,
        isOnline: false,
        coverImage: 'https://images.unsplash.com/photo-1528605105345-5344ea20e269?w=800&q=80',
        externalUrl: 'https://lu.ma',
    },
    {
        id: 'mock-com-2',
        title: 'Nostr for Builders Workshop',
        description: 'Hands-on session covering Nostr protocol basics, key management, and how to integrate Nostr identity into your product. Bring a laptop.',
        category: 'WORKSHOP',
        startDate: '2026-03-25T10:00:00Z',
        location: 'Online — Zoom',
        isOfficial: false,
        isOnline: true,
        coverImage: 'https://images.unsplash.com/photo-1516321165247-4aa89a48be55?w=800&q=80',
        externalUrl: 'https://lu.ma',
    },
    {
        id: 'mock-com-3',
        title: 'El Salvador Founders Networking Night',
        description: 'An informal evening for founders building in El Salvador to connect over drinks, share lessons learned, and explore collaboration opportunities.',
        category: 'NETWORKING',
        startDate: '2026-04-08T19:00:00Z',
        location: 'Rooftop Bar La Terraza, Santa Tecla',
        isOfficial: false,
        isOnline: false,
        coverImage: 'https://images.unsplash.com/photo-1515169067868-5387ec356754?w=800&q=80',
        externalUrl: 'https://lu.ma',
    },
    {
        id: 'mock-com-4',
        title: 'Lightning Payments Deep Dive',
        description: 'Technical walkthrough of Lightning payment flows, BOLT specs, and practical integration patterns for apps targeting the Salvadoran market.',
        category: 'WORKSHOP',
        startDate: '2026-04-22T17:00:00Z',
        location: 'Online — Google Meet',
        isOfficial: false,
        isOnline: true,
        coverImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
        externalUrl: 'https://lu.ma',
    },
];

const CATEGORY_COLORS = {
    CONFERENCE: '#DBEAFE',
    HACKATHON: '#FEF3C7',
    WORKSHOP: '#EDE9FE',
    MEETUP: '#D1FAE5',
    NETWORKING: '#FFE4E6',
    DEMO_DAY: '#FFF7ED',
};

const EventCard = ({ event, isOfficial }) => {
    const bgColor = CATEGORY_COLORS[event.category] || '#F1F5F9';
    const hasImage = event.coverImage || event.image || event.thumbnail;
    const categoryLabel = (event.category || '').replace(/_/g, ' ');
    const dateStr = (() => {
        const d = event.startDate || event.date;
        if (!d) return '';
        try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
        catch { return d; }
    })();

    return (
        <div className="event-card">
            <Link to={`/events/${event.id}`} className="card-image-link">
                <div
                    className="card-image"
                    style={{
                        backgroundColor: hasImage ? undefined : bgColor,
                        backgroundImage: hasImage ? `url(${event.coverImage || event.image || event.thumbnail})` : 'none',
                    }}
                >
                    <span className="cat-badge">{categoryLabel}</span>
                    {isOfficial && (
                        <span className="official-badge"><ShieldCheck size={11} /> Official</span>
                    )}
                    {event.isOnline && (
                        <span className="online-badge"><Globe size={11} /> Online</span>
                    )}
                    {event.isEndorsed && (
                        <span className="endorsed-badge"><Award size={11} /> Endorsed</span>
                    )}
                </div>
            </Link>
            <div className="card-body">
                <Link to={`/events/${event.id}`} className="card-title-link">
                    <h3>{event.title}</h3>
                </Link>
                <p className="description">{event.description}</p>
                <div className="meta-rows">
                    <div className="meta-item"><CalendarIcon size={13} /><span>{dateStr}</span></div>
                    <div className="meta-item"><MapPin size={13} /><span>{event.location}</span></div>
                </div>
                <div className="actions">
                    {(event.ticketUrl || event.externalUrl) ? (
                        <a href={event.ticketUrl || event.externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-xs reserve-btn">Get Tickets</a>
                    ) : (
                        <Link to={`/events/${event.id}`} className="btn btn-outline btn-xs reserve-btn">View Event</Link>
                    )}
                </div>
            </div>
            <style jsx>{`
                .event-card {
                    background: white;
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    border: 1px solid ${isOfficial ? '#fed7aa' : 'var(--color-gray-200)'};
                    transition: transform 0.2s, box-shadow 0.2s;
                    display: flex;
                    flex-direction: column;
                }
                .event-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
                .card-image-link { text-decoration: none; display: block; }
                .card-image {
                    height: 160px;
                    position: relative;
                    padding: 1rem;
                    background-size: cover;
                    background-position: center;
                }
                .cat-badge {
                    position: absolute;
                    top: 1rem;
                    left: 1rem;
                    background: rgba(255,255,255,0.9);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--color-neutral-dark);
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .official-badge {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    background: var(--color-secondary);
                    color: white;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 3px;
                }
                .online-badge {
                    position: absolute;
                    bottom: 1rem;
                    left: 1rem;
                    background: rgba(0,0,0,0.6);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-size: 0.72rem;
                    display: flex;
                    align-items: center;
                    gap: 3px;
                }
                .endorsed-badge {
                    position: absolute;
                    bottom: 1rem;
                    right: 1rem;
                    background: #fef3c7;
                    color: #d97706;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 3px;
                }
                .card-body { padding: 1.5rem; flex: 1; display: flex; flex-direction: column; }
                .card-title-link { text-decoration: none; color: inherit; }
                .card-title-link:hover h3 { color: var(--color-primary); }
                h3 { font-size: 1.05rem; margin-bottom: 0.5rem; line-height: 1.3; }
                .description {
                    font-size: 0.875rem;
                    color: var(--color-gray-500);
                    margin-bottom: 1rem;
                    line-height: 1.45;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .meta-rows { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
                .meta-item { display: flex; align-items: center; gap: 5px; font-size: 0.82rem; color: var(--color-gray-500); }
                .meta-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .actions { margin-top: auto; }
                .reserve-btn {
                    width: 100%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.85rem;
                    height: 36px;
                    white-space: nowrap;
                    text-decoration: none;
                }
            `}</style>
        </div>
    );
};

const Events = () => {
    const { user } = useAuth();
    const [rawOfficialEvents, setRawOfficialEvents] = useState([]);
    const [rawCommunityEvents, setRawCommunityEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [selectedDate, setSelectedDate] = useState(null);
    const [showOfficial, setShowOfficial] = useState(true);
    const [showCommunity, setShowCommunity] = useState(true);

    const categories = [
        { id: 'NETWORKING', label: 'Networking' },
        { id: 'CONFERENCE', label: 'Conference' },
        { id: 'WORKSHOP', label: 'Workshop' },
        { id: 'HACKATHON', label: 'Hackathon' },
        { id: 'MEETUP', label: 'Meetup' },
        { id: 'DEMO_DAY', label: 'Demo Day' },
    ];

    useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true);
            try {
                const officialParams = { upcoming: true, isOfficial: 'true' };
                if (search) officialParams.search = search;
                if (category) officialParams.category = category;

                const communityParams = { upcoming: true, isOfficial: 'false' };
                if (search) communityParams.search = search;
                if (category) communityParams.category = category;

                const [offResult, commResult] = await Promise.all([
                    eventsApi.list(officialParams),
                    eventsApi.list(communityParams)
                ]);

                const offList = offResult?.data || offResult || [];
                const commList = commResult?.data || commResult || [];

                setRawOfficialEvents(Array.isArray(offList) && offList.length > 0 ? offList : MOCK_OFFICIAL_EVENTS);
                setRawCommunityEvents(Array.isArray(commList) && commList.length > 0 ? commList : MOCK_COMMUNITY_EVENTS);
            } catch (err) {
                console.error('Fetch events error:', err);
                setRawOfficialEvents(MOCK_OFFICIAL_EVENTS);
                setRawCommunityEvents(MOCK_COMMUNITY_EVENTS);
            } finally {
                setLoading(false);
            }
        };
        const debounce = setTimeout(fetchEvents, 300);
        return () => clearTimeout(debounce);
    }, [search, category]);

    // Derive displayed lists — apply selectedDate filter client-side
    const officialEvents = useMemo(() => {
        if (!selectedDate) return rawOfficialEvents;
        const dateStr = selectedDate.toISOString().split('T')[0];
        return rawOfficialEvents.filter(e => (e.startDate || e.date || '').startsWith(dateStr));
    }, [rawOfficialEvents, selectedDate]);

    const communityEvents = useMemo(() => {
        if (!selectedDate) return rawCommunityEvents;
        const dateStr = selectedDate.toISOString().split('T')[0];
        return rawCommunityEvents.filter(e => (e.startDate || e.date || '').startsWith(dateStr));
    }, [rawCommunityEvents, selectedDate]);

    // Build a Set of date strings that have events, for calendar dot indicators
    const eventDates = useMemo(() => {
        const dates = new Set();
        [...rawOfficialEvents, ...rawCommunityEvents].forEach(e => {
            const d = e.startDate || e.date;
            if (d) dates.add(d.substring(0, 10));
        });
        return dates;
    }, [rawOfficialEvents, rawCommunityEvents]);

    // Calendar Helper
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const renderCalendar = () => {
        const totalDays = daysInMonth(currentMonth);
        const firstDay = firstDayOfMonth(currentMonth);
        const days = [];

        // Header
        const monthYear = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

        const dayStyle = {
            aspectRatio: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            cursor: 'pointer',
            borderRadius: '4px',
        };

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} style={{ aspectRatio: '1' }}></div>);
        }

        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasEvents = eventDates.has(dateStr);

            days.push(
                <div
                    key={d}
                    title={hasEvents ? 'Events on this date' : undefined}
                    style={{
                        ...dayStyle,
                        background: isSelected ? 'var(--color-secondary)' : hasEvents && !isSelected ? '#eff6ff' : undefined,
                        color: isSelected ? 'white' : isToday ? 'var(--color-secondary)' : hasEvents ? '#1d4ed8' : undefined,
                        fontWeight: isSelected || isToday || hasEvents ? 700 : undefined,
                        border: isSelected ? 'none' : isToday ? '1px solid var(--color-secondary)' : hasEvents ? '1.5px solid #3b82f6' : undefined,
                        cursor: hasEvents ? 'pointer' : 'default',
                        position: 'relative',
                    }}
                    onClick={() => hasEvents || isSelected ? setSelectedDate(isSelected ? null : date) : undefined}
                >
                    {d}
                </div>
            );
        }

        return (
            <div className="calendar-widget">
                <div className="calendar-header">
                    <button onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                        <ChevronLeft size={16} />
                    </button>
                    <span>{monthYear}</span>
                    <button onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', width: '100%' }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="weekday" style={{ fontSize: '0.7rem', color: 'var(--color-gray-400)', fontWeight: 700, paddingBottom: '0.5rem' }}>{d}</div>)}
                    {days}
                </div>
                {selectedDate && (
                    <button className="clear-date" onClick={() => setSelectedDate(null)}>Clear Date</button>
                )}
            </div>
        );
    };

    return (
        <div className="events-page container">
            <div className="discover-header">
                <h1>Ecosystem Events</h1>
                <p className="text-gray-500">Connect, learn, and grow within the BIES network.</p>
            </div>

            <div className="search-row">
                <div className="search-left-column">
                    {(user?.role === 'BUILDER' || user?.role === 'ADMIN' || user?.role === 'INVESTOR') && (
                        <Link to="/events/create" className="btn btn-primary create-project-btn">
                            <Plus size={18} /> Create Event
                        </Link>
                    )}
                </div>
                <div className="search-bar">
                    <Search size={20} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search events by name, host, or tag..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button className="btn btn-primary">Search</button>
                </div>
            </div>

            <div className="content-layout">
                {/* Filters Sidebar */}
                <div className="filters-column">
                    <div className="sidebar-section calendar-section">
                        <div className="filter-header">
                            <CalendarIcon size={18} />
                            <span>Calendar</span>
                        </div>
                        {renderCalendar()}
                    </div>

                    <aside className="filters">
                        <div className="filter-group">
                            <label>Event Types</label>
                            <div className="checkbox-list">
                                <label>
                                    <input type="checkbox" checked={showOfficial} onChange={e => setShowOfficial(e.target.checked)} />
                                    Official Events
                                </label>
                                <label>
                                    <input type="checkbox" checked={showCommunity} onChange={e => setShowCommunity(e.target.checked)} />
                                    Community Events
                                </label>
                            </div>
                        </div>

                        <div className="filter-group" style={{ marginBottom: 0 }}>
                            <label>Categories</label>
                            <div className="checkbox-list">
                                <button
                                    className={`cat-item ${!category ? 'active' : ''}`}
                                    onClick={() => setCategory('')}
                                >
                                    All Categories
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        className={`cat-item ${category === cat.id ? 'active' : ''}`}
                                        onClick={() => setCategory(cat.id)}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div>

                {/* Main Content */}
                <main className="main-content">
                    {loading ? (
                        <div className="loading-state">
                            <Loader2 size={40} className="spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Official Events Section */}
                            {showOfficial && officialEvents.length > 0 && (
                                <section className="events-section official-section">
                                    <div className="section-header">
                                        <ShieldCheck size={24} className="text-secondary" />
                                        <h2>Official Build in El Salvador Events</h2>
                                    </div>
                                    <div className="events-grid">
                                        {officialEvents.map(event => (
                                            <EventCard key={event.id} event={event} isOfficial={true} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Community Events Section */}
                            {showCommunity && (
                                <section className="events-section community-section">
                                    <div className="section-header">
                                        <Users size={24} className="text-primary" />
                                        <h2>BIES Community Events</h2>
                                    </div>
                                    {communityEvents.length === 0 ? (
                                        <div className="empty-state">No community events found.</div>
                                    ) : (
                                        <div className="events-grid">
                                            {communityEvents.map(event => (
                                                <EventCard key={event.id} event={event} isOfficial={false} />
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}

                            {!showOfficial && !showCommunity && (
                                <div className="empty-state">Select event types to view.</div>
                            )}
                        </>
                    )}
                </main>
            </div>

            <style jsx>{`
                .events-page {
                    padding-top: 2rem;
                    padding-bottom: 4rem;
                }

                .discover-header {
                    margin-bottom: 1.5rem;
                    text-align: center;
                }
                .discover-header h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem; }

                .search-row {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    margin-bottom: 2rem;
                }

                .search-left-column {
                    width: 250px;
                    flex-shrink: 0;
                    display: flex;
                }

                .create-project-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    font-weight: 600;
                    border-radius: var(--radius-full);
                    padding: 0.6rem 1.5rem;
                    white-space: nowrap;
                    width: 100%;
                    flex-shrink: 0;
                    text-decoration: none;
                }

                .search-bar {
                    display: flex;
                    align-items: center;
                    flex: 1;
                    background: white;
                    padding: 0.5rem;
                    border-radius: var(--radius-full);
                    border: 1px solid var(--color-gray-300);
                    box-shadow: var(--shadow-sm);
                }

                .search-icon {
                    margin-left: 1rem;
                    color: var(--color-gray-400);
                }

                .search-bar input {
                    flex: 1;
                    border: none;
                    padding: 0.5rem 1rem;
                    outline: none;
                    font-size: 1rem;
                    background: transparent;
                }

                /* Layout */
                .content-layout {
                    display: flex;
                    gap: 2rem;
                    align-items: flex-start;
                }

                .filters-column {
                    width: 250px;
                    display: flex;
                    flex-direction: column;
                    flex-shrink: 0;
                }

                .filters {
                    width: 250px;
                    background: white;
                    padding: 1.5rem;
                    border-radius: var(--radius-lg);
                    height: fit-content;
                    border: 1px solid var(--color-gray-200);
                    display: flex;
                    flex-direction: column;
                }

                .filter-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 600;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid var(--color-gray-200);
                }

                .filter-group { margin-bottom: 1.5rem; }
                .filter-group label {
                    display: block;
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin-bottom: 0.75rem;
                }

                .checkbox-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    align-items: flex-start;
                }

                .checkbox-list label {
                    font-weight: normal;
                    font-size: 0.9rem;
                    color: var(--color-gray-600);
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    cursor: pointer;
                    width: auto;
                    padding: 2px 0;
                    margin: 0;
                    gap: 8px;
                }
                
                .checkbox-list input[type="checkbox"] {
                    margin: 0;
                    width: 16px;
                    height: 16px;
                    accent-color: var(--color-primary);
                    flex-shrink: 0;
                    cursor: pointer;
                }

                .cat-item {
                    width: 100%;
                    text-align: left;
                    padding: 0.5rem 0.75rem;
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                    color: var(--color-gray-600);
                    background: none;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 500;
                }
                .cat-item:hover { background: var(--color-gray-50); color: var(--color-primary); }
                .cat-item.active { background: #eff6ff; color: var(--color-primary); font-weight: 600; }

                /* Calendar Widget */
                .calendar-widget {
                    width: 100%;
                }
                .calendar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .calendar-header span { font-weight: 600; font-size: 0.9rem; }
                .calendar-header button {
                    padding: 0.25rem;
                    border-radius: 4px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--color-gray-400);
                }
                .calendar-header button:hover { color: var(--color-gray-900); background: var(--color-gray-100); }
                
                .sidebar-section {
                    background: white;
                    padding: 1.5rem;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--color-gray-200);
                    margin-bottom: 2rem;
                }

                .calendar-grid {
                    display: grid !important;
                    grid-template-columns: repeat(7, 1fr) !important;
                    gap: 4px !important;
                    text-align: center;
                    width: 100%;
                    min-width: 210px;
                }
                .weekday { font-size: 0.7rem; color: var(--color-gray-400); font-weight: 700; padding-bottom: 0.5rem; }
                .calendar-day {
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .calendar-day:hover { background: #fef3c7; }
                .calendar-day.selected { background: var(--color-secondary); color: white; font-weight: 700; }
                .calendar-day.today { border: 1px solid var(--color-secondary); color: var(--color-secondary); font-weight: 700; }
                .calendar-day.empty { cursor: default; }
                .clear-date {
                    width: 100%;
                    margin-top: 1rem;
                    font-size: 0.75rem;
                    color: var(--color-gray-400);
                    background: none;
                    border: 1px solid var(--color-gray-200);
                    padding: 0.4rem;
                    border-radius: 4px;
                    cursor: pointer;
                }

                /* Main Content */
                .main-content { 
                    flex: 1;
                    min-width: 0;
                }
                .loading-state { display: flex; justify-content: center; padding: 4rem 0; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .events-section { margin-bottom: 4rem; }
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }
                .section-header h2 { font-size: 1.5rem; font-weight: 800; color: var(--color-gray-900); }

                .events-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                }

                @media (max-width: 1150px) {
                    .events-grid { grid-template-columns: repeat(2, 1fr); }
                }

                .empty-state { padding: 3rem; text-align: center; color: var(--color-gray-400); background: white; border-radius: var(--radius-lg); border: 1px dashed var(--color-gray-200); }

                @media (max-width: 768px) {
                    .search-row { flex-direction: column; align-items: stretch; gap: 1rem; }
                    .search-left-column { width: 100%; }
                    .content-layout { flex-direction: column; }
                    .filters-column { width: 100%; }
                    .filters { width: 100%; }
                    .events-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Events;

import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ExternalLink, Users } from 'lucide-react';

const Events = () => {
    const events = [
        {
            id: 1,
            title: "Adopting Bitcoin 2024",
            date: "Nov 15-17, 2024",
            location: "San Salvador, El Salvador",
            description: "The premier Bitcoin conference promoting Bitcoin adoption in El Salvador and beyond. Join developers, investors, and educators.",
            image: "https://images.unsplash.com/photo-1591115765373-5207764f72e7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Official",
            attendees: 1200
        },
        {
            id: 2,
            title: "El Zonte Bitcoin Beach Party",
            date: "Dec 05, 2024",
            location: "El Zonte, La Libertad",
            description: "A sunset gathering for the Bitcoin community. Networking, music, and lightning payments everywhere.",
            image: "https://images.unsplash.com/photo-1545129139-1eb68079a633?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Network",
            attendees: 350
        },
        {
            id: 3,
            title: "Tech & Tacos Meetup",
            date: "Every Tuesday",
            location: "Bitcoin Embassy, San Salvador",
            description: "Weekly meetup for builders and developers. Discuss your projects, find collaborators, and eat tacos.",
            image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Community",
            attendees: 45
        },
        {
            id: 4,
            title: "Volcano Bond Strategy Session",
            date: "Oct 20, 2024",
            location: "Private Location",
            description: "Exclusive roundtable for accredited investors discussing the EBB (Volcano Bond) opportunities.",
            image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Private",
            attendees: 25
        },
        {
            id: 5,
            title: "Lightning Network Hackathon",
            date: "Jan 10-12, 2025",
            location: "Don Bosco University",
            description: "48-hour hackathon to build the next generation of Lightning apps. Prizes in BTC.",
            image: "https://images.unsplash.com/photo-1504384308090-c54be3855833?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Education",
            attendees: 200
        }
    ];

    return (
        <div className="events-page">
            <div className="container py-12">
                <div className="header mb-10 text-center">
                    <h1 className="text-4xl font-bold mb-4">Ecosystem Events</h1>
                    <p className="text-gray-500 max-w-2xl mx-auto">
                        Connect with the community, learn from experts, and participate in the financial revolution happening in El Salvador.
                    </p>
                </div>

                <div className="events-grid">
                    {events.map(event => (
                        <div key={event.id} className="event-card">
                            <Link
                                to={`/events/${event.id}`}
                                className="card-image"
                                style={{
                                    backgroundImage: `url(${event.image})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    height: '160px',
                                    display: 'block',
                                    position: 'relative',
                                }}
                            >
                                <span className={`category-badge ${event.category.toLowerCase()}`}>
                                    {event.category}
                                </span>
                            </Link>
                            <div className="card-content">
                                <div className="meta-row mb-2">
                                    <span className="date flex items-center gap-1 text-primary font-semibold text-sm">
                                        <Calendar size={14} /> {event.date}
                                    </span>
                                    <span className="attendees flex items-center gap-1 text-gray-400 text-xs">
                                        <Users size={12} /> {event.attendees}+
                                    </span>
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
                                <a
                                    href="https://satlantis.io"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="view-btn"
                                >
                                    View on Satlantis <ExternalLink size={14} />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                .events-page {
                    background: var(--color-gray-50);
                    min-height: 100vh;
                }
                .container {
                    padding: 0 1rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
                .mb-10 { margin-bottom: 2.5rem; }
                .mb-4 { margin-bottom: 1rem; }
                
                .grid {
                    display: grid;
                }
                @media (min-width: 768px) {
                    .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
                }
                @media (min-width: 1024px) {
                    .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
                }
                .gap-8 { gap: 2rem; }

                .event-card {
                    background: white;
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    border: 1px solid var(--color-gray-200);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .event-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
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
                .category-badge.network { background: rgba(255, 91, 0, 0.9); color: white; }
                .category-badge.community { background: rgba(16, 185, 129, 0.9); color: white; }
                .category-badge.private { background: rgba(0, 0, 0, 0.8); color: white; }
                .category-badge.education { background: rgba(124, 58, 237, 0.9); color: white; }

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
                    background: #f1f5f9;
                    color: #475569;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .view-btn:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                }
                
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; width: 100%; }

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
                    color: #FF5B00;
                }
                .event-title-link h3 {
                    transition: color 0.2s;
                }
            `}</style>
        </div>
    );
};

export default Events;

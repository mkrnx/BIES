import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ExternalLink, ArrowLeft, Clock, Tag } from 'lucide-react';

const EventDetail = () => {
    const { id } = useParams();

    // Mock events data (same as Events.jsx — will be replaced with API call)
    const events = [
        {
            id: 1,
            title: "Adopting Bitcoin 2024",
            date: "Nov 15-17, 2024",
            time: "9:00 AM - 6:00 PM CST",
            location: "San Salvador, El Salvador",
            description: "The premier Bitcoin conference promoting Bitcoin adoption in El Salvador and beyond. Join developers, investors, and educators.",
            fullDescription: "Adopting Bitcoin is the premier conference dedicated to promoting Bitcoin adoption in El Salvador and across Latin America. This three-day event brings together developers, investors, educators, and policymakers to discuss the future of money, financial sovereignty, and the growing Bitcoin ecosystem.\n\nTopics include Lightning Network development, Bitcoin mining with renewable energy, regulatory frameworks, merchant adoption strategies, and building on Nostr. Whether you're a seasoned Bitcoiner or just getting started, this conference offers something for everyone.",
            image: "https://images.unsplash.com/photo-1591115765373-5207764f72e7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Official",
            attendees: 1200,
            organizer: "Adopting Bitcoin Foundation",
            tags: ["Bitcoin", "Lightning", "Conference", "Adoption"]
        },
        {
            id: 2,
            title: "El Zonte Bitcoin Beach Party",
            date: "Dec 05, 2024",
            time: "4:00 PM - 11:00 PM CST",
            location: "El Zonte, La Libertad",
            description: "A sunset gathering for the Bitcoin community. Networking, music, and lightning payments everywhere.",
            fullDescription: "Join the legendary Bitcoin Beach community for an evening of networking, live music, and celebration under the stars. El Zonte — the birthplace of Bitcoin adoption in El Salvador — hosts this iconic gathering where the entire local economy runs on Lightning.\n\nExperience firsthand what a circular Bitcoin economy looks like. Pay for food, drinks, and merchandise entirely with sats. Meet the builders and entrepreneurs who are making it happen on the ground.",
            image: "https://images.unsplash.com/photo-1545129139-1eb68079a633?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Network",
            attendees: 350,
            organizer: "Bitcoin Beach",
            tags: ["Networking", "Community", "Lightning", "Beach"]
        },
        {
            id: 3,
            title: "Tech & Tacos Meetup",
            date: "Every Tuesday",
            time: "6:30 PM - 9:00 PM CST",
            location: "Bitcoin Embassy, San Salvador",
            description: "Weekly meetup for builders and developers. Discuss your projects, find collaborators, and eat tacos.",
            fullDescription: "The weekly gathering point for El Salvador's builder community. Every Tuesday evening, developers, designers, and entrepreneurs come together at the Bitcoin Embassy to share progress on their projects, find collaborators, and brainstorm new ideas — all over delicious tacos.\n\nWhether you're working on a Lightning app, a Nostr client, or a traditional startup looking to integrate Bitcoin, this is the place to find your tribe. Presentations are welcome but not required — the vibe is casual and collaborative.",
            image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Community",
            attendees: 45,
            organizer: "BIES Community",
            tags: ["Builders", "Developers", "Weekly", "Networking"]
        },
        {
            id: 4,
            title: "Volcano Bond Strategy Session",
            date: "Oct 20, 2024",
            time: "2:00 PM - 5:00 PM CST",
            location: "Private Location",
            description: "Exclusive roundtable for accredited investors discussing the EBB (Volcano Bond) opportunities.",
            fullDescription: "An invitation-only roundtable bringing together accredited investors and financial professionals to discuss the El Salvador Bitcoin Bond (EBB) — commonly known as the Volcano Bond. This intimate session covers the bond structure, legal framework, expected returns, and strategic implications for institutional investors.\n\nPresentations from government officials, bond underwriters, and independent analysts provide a 360-degree view of this groundbreaking financial instrument. Limited to 25 attendees to ensure meaningful discussion.",
            image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Private",
            attendees: 25,
            organizer: "BIES Capital Network",
            tags: ["Investing", "Bonds", "Strategy", "Exclusive"]
        },
        {
            id: 5,
            title: "Lightning Network Hackathon",
            date: "Jan 10-12, 2025",
            time: "Fri 6PM - Sun 6PM CST",
            location: "Don Bosco University",
            description: "48-hour hackathon to build the next generation of Lightning apps. Prizes in BTC.",
            fullDescription: "A 48-hour hackathon challenging developers to build the next generation of Lightning Network applications. Teams of 2-5 will compete for prizes totaling 10M sats across multiple categories including best UX, most innovative use case, and best use of Nostr integration.\n\nMentors from leading Bitcoin companies will be available throughout the event. Meals, snacks, and coffee provided. Whether you're a hackathon veteran or a first-timer, this is your chance to build something real and ship it to the world.",
            image: "https://images.unsplash.com/photo-1504384308090-c54be3855833?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            category: "Education",
            attendees: 200,
            organizer: "Don Bosco University & BIES",
            tags: ["Hackathon", "Lightning", "Developers", "Prizes"]
        }
    ];

    const event = events.find(e => e.id === parseInt(id));

    if (!event) {
        return (
            <div className="event-detail-page">
                <div className="container">
                    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                        <h2>Event not found</h2>
                        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>This event doesn't exist or has been removed.</p>
                        <Link to="/events" className="back-link" style={{ marginTop: '1.5rem', display: 'inline-flex' }}>
                            <ArrowLeft size={16} /> Back to Events
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="event-detail-page">
            <div className="container">
                {/* Back Link */}
                <Link to="/events" className="back-link">
                    <ArrowLeft size={16} /> Back to Events
                </Link>

                {/* Hero Image */}
                <div className="hero-image">
                    <img src={event.image} alt={event.title} />
                    <span className={`category-badge ${event.category.toLowerCase()}`}>
                        {event.category}
                    </span>
                </div>

                {/* Content Grid */}
                <div className="detail-grid">
                    {/* Main Content */}
                    <div className="main-content">
                        <h1>{event.title}</h1>
                        <p className="organizer">Hosted by {event.organizer}</p>

                        <div className="description">
                            {event.fullDescription.split('\n\n').map((paragraph, i) => (
                                <p key={i}>{paragraph}</p>
                            ))}
                        </div>

                        {event.tags && (
                            <div className="tags">
                                {event.tags.map(tag => (
                                    <span key={tag} className="tag">
                                        <Tag size={12} /> {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="detail-sidebar">
                        <div className="info-card">
                            <h3>Event Details</h3>

                            <div className="info-row">
                                <Calendar size={18} />
                                <div>
                                    <span className="info-label">Date</span>
                                    <span className="info-value">{event.date}</span>
                                </div>
                            </div>

                            {event.time && (
                                <div className="info-row">
                                    <Clock size={18} />
                                    <div>
                                        <span className="info-label">Time</span>
                                        <span className="info-value">{event.time}</span>
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

                            <div className="info-row">
                                <Users size={18} />
                                <div>
                                    <span className="info-label">Attendees</span>
                                    <span className="info-value">{event.attendees}+ expected</span>
                                </div>
                            </div>

                            <a
                                href="https://satlantis.io"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ticket-btn"
                            >
                                Get Tickets on Satlantis <ExternalLink size={14} />
                            </a>
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
                    color: #64748b;
                    font-size: 0.9rem;
                    font-weight: 500;
                    margin: 1.5rem 0;
                    transition: color 0.2s;
                }
                .back-link:hover { color: #0f172a; }

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
                .category-badge.official { background: rgba(0, 71, 171, 0.9); color: white; }
                .category-badge.network { background: rgba(255, 91, 0, 0.9); color: white; }
                .category-badge.community { background: rgba(16, 185, 129, 0.9); color: white; }
                .category-badge.private { background: rgba(0, 0, 0, 0.8); color: white; }
                .category-badge.education { background: rgba(124, 58, 237, 0.9); color: white; }

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
                    color: #0f172a;
                }

                .organizer {
                    color: #64748b;
                    font-size: 0.95rem;
                    margin-bottom: 2rem;
                }

                .description p {
                    color: #334155;
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
                    background: #e2e8f0;
                    color: #475569;
                    border-radius: 9999px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                /* Sidebar */
                .info-card {
                    background: white;
                    border-radius: 16px;
                    padding: 1.75rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
                    border: 1px solid #e2e8f0;
                    position: sticky;
                    top: 100px;
                }

                .info-card h3 {
                    font-size: 1.1rem;
                    font-weight: 700;
                    margin-bottom: 1.5rem;
                    color: #0f172a;
                }

                .info-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    margin-bottom: 1.25rem;
                    color: #FF5B00;
                }

                .info-row div {
                    display: flex;
                    flex-direction: column;
                }

                .info-label {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    font-weight: 600;
                    margin-bottom: 0.15rem;
                }

                .info-value {
                    font-size: 0.95rem;
                    color: #1e293b;
                    font-weight: 500;
                }

                .ticket-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.85rem;
                    background: linear-gradient(135deg, #FF5B00 0%, #CC4A00 100%);
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

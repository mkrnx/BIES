import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, DollarSign, Users, Award, Download, ArrowLeft, Globe, Share2, MessageSquare } from 'lucide-react';

const ProjectDetails = () => {
    const { id } = useParams();

    // Mock Data (would be fetched by ID)
    const project = {
        name: 'Volcano Energy Solutions',
        industry: 'Energy',
        stage: 'Early Revenue',
        location: 'San Salvador',
        funding: '$2.5M',
        raised: '$1.2M',
        minTicket: '$25k',
        builder: 'Carlos M.',
        description: 'Geothermal energy harvesting for Bitcoin mining infrastructure. We are leveraging El Salvador\'s volcanic resources to create a sustainable, renewable energy grid dedicated to securing the Bitcoin network while providing surplus power to local communities.',
        traction: [
            { label: 'Energy Output', value: '2.5 MW' },
            { label: 'Revenue YTD', value: '$450k' },
            { label: 'Hashrate', value: '150 PH/s' },
        ],
        team: [
            { name: 'Carlos Mendoza', role: 'CEO', exp: 'Ex-Geotermica' },
            { name: 'Elena R.', role: 'CTO', exp: 'Bitcoin Core Dev' },
        ]
    };

    return (
        <div className="container py-8">
            <Link to="/discover" className="back-link">
                <ArrowLeft size={16} /> Back to Discover
            </Link>

            <div className="project-header">
                <div>
                    <div className="badges">
                        <span className="badge industry">{project.industry}</span>
                        <span className="badge stage">{project.stage}</span>
                    </div>
                    <h1>{project.name}</h1>
                    <div className="meta">
                        <div className="meta-item"><MapPin size={16} /> {project.location}</div>
                        <div className="meta-item"><Users size={16} /> Built by {project.builder}</div>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline"><Share2 size={18} /> Share</button>
                    <button className="btn btn-primary"><MessageSquare size={18} style={{ marginRight: 8 }} /> Contact Builder</button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-8 main-layout">
                {/* Main Content */}
                <div className="col-span-2">
                    <section className="detail-card">
                        <h3>About the Project</h3>
                        <p className="text-body">{project.description}</p>
                    </section>

                    <section className="detail-card">
                        <h3>Traction & Metrics</h3>
                        <div className="metrics-grid">
                            {project.traction.map((stat, i) => (
                                <div key={i} className="metric-box">
                                    <span className="metric-value">{stat.value}</span>
                                    <span className="metric-label">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="detail-card">
                        <h3>Core Team</h3>
                        <div className="team-list">
                            {project.team.map((member, i) => (
                                <div key={i} className="team-member">
                                    <div className="member-avatar">{member.name[0]}</div>
                                    <div>
                                        <div className="member-name">{member.name}</div>
                                        <div className="member-role">{member.role} • {member.exp}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <div className="sidebar">
                    <div className="detail-card funding-card">
                        <h3>Funding Status</h3>
                        <div className="funding-progress">
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-700">Raised</span>
                                <span className="text-sm font-bold text-primary">{project.raised} <span className="text-gray-400 font-normal">/ {project.funding}</span></span>
                            </div>
                            <div className="progress-bar">
                                <div className="fill" style={{ width: '45%' }}></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Min. Ticket: {project.minTicket}</p>
                        </div>
                        <button className="btn btn-secondary w-full">Request Pitch Deck <Download size={16} style={{ marginLeft: 6 }} /></button>
                        <button className="btn btn-outline w-full mt-2">Follow Project</button>
                    </div>

                    <div className="detail-card">
                        <h3>Documents</h3>
                        <ul className="doc-list">
                            <li><Download size={14} /> One Pager</li>
                            <li><Download size={14} /> Technical Whitepaper</li>
                            <li><Download size={14} /> Legal Disclaimer</li>
                        </ul>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .back-link { display: flex; align-items: center; gap: 0.5rem; color: var(--color-gray-500); margin-bottom: 2rem; font-weight: 500; }
                .back-link:hover { color: var(--color-primary); }

                .project-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 2rem; }
                .project-header h1 { font-size: 2.5rem; margin: 0.5rem 0; letter-spacing: -0.02em; }
                
                .badges { display: flex; gap: 0.5rem; }
                .badge { padding: 4px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
                .badge.industry { background: #E0F2FE; color: var(--color-primary); }
                .badge.stage { background: var(--color-gray-100); color: var(--color-gray-700); }

                .meta { display: flex; gap: 1.5rem; color: var(--color-gray-500); font-weight: 500; }
                .meta-item { display: flex; align-items: center; gap: 6px; }

                .header-actions { display: flex; gap: 1rem; }

                .gap-8 { gap: 2rem; }

                .detail-card { background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-gray-200); padding: 2rem; margin-bottom: 2rem; }
                .detail-card h3 { font-size: 1.25rem; margin-bottom: 1.5rem; color: var(--color-neutral-dark); }
                .text-body { line-height: 1.6; color: var(--color-gray-600); }

                .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
                .metric-box { background: var(--color-gray-100); padding: 1.5rem; border-radius: var(--radius-md); text-align: center; }
                .metric-value { display: block; font-size: 1.5rem; font-weight: 700; color: var(--color-primary); }
                .metric-label { font-size: 0.85rem; color: var(--color-gray-500); }

                .team-list { display: flex; flex-direction: column; gap: 1rem; }
                .team-member { display: flex; align-items: center; gap: 1rem; }
                .member-avatar { width: 48px; height: 48px; background: var(--color-gray-200); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--color-gray-500); }
                .member-name { font-weight: 600; }
                .member-role { font-size: 0.9rem; color: var(--color-gray-500); }

                .funding-card { border-top: 4px solid var(--color-secondary); }
                .progress-bar { height: 8px; background: var(--color-gray-100); border-radius: 99px; overflow: hidden; margin-bottom: 0.5rem; }
                .fill { height: 100%; background: var(--color-success); }
                
                .main-layout { grid-template-columns: 2fr 1fr; }

                .doc-list { list-style: none; padding: 0; }
                .doc-list li { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 0; border-bottom: 1px solid var(--color-gray-100); color: var(--color-primary); cursor: pointer; font-weight: 500; }
                .doc-list li:last-child { border-bottom: none; }
                .doc-list li:hover { text-decoration: underline; }

                @media (max-width: 768px) {
                    .project-header { flex-direction: column; align-items: flex-start; gap: 1.5rem; }
                    .main-layout { grid-template-columns: 1fr; }
                    .metrics-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default ProjectDetails;

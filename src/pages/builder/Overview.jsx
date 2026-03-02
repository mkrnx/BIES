import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, MessageSquare, Plus, MoreHorizontal } from 'lucide-react';

const BuilderOverview = () => {
    // Mock Data
    const projects = [
        { id: 1, name: 'Volcano Energy Solutions', status: 'Active', views: '2.4k', likes: 145, enquiries: 12, raised: '250k', goal: '1.2M' },
        { id: 2, name: 'Surf City Logistics', status: 'Draft', views: 0, likes: 0, enquiries: 0, raised: '0', goal: '500k' },
    ];

    return (
        <>
            <div className="header">
                <div>
                    <h1>Builder Dashboard</h1>
                    <p className="subtitle">Manage your projects and fundraising</p>
                </div>
                <Link to="/dashboard/builder/new-project" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                    <Plus size={18} style={{ marginRight: 8 }} /> New Project
                </Link>
            </div>

            {/* Stats Row */}
            <div className="stats-grid">
                <div className="stat-box featured">
                    <span className="label">Total Capital Raised</span>
                    <div className="value-row">
                        <span className="value">$250k</span>
                        <span className="fraction">/ $1.7M Goal</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: '15%' }}></div>
                    </div>
                </div>
                <div className="stat-box">
                    <span className="label">Total Project Views</span>
                    <div className="value-row">
                        <Eye size={20} className="text-secondary" />
                        <span className="value">2.4k</span>
                    </div>
                </div>
                <div className="stat-box">
                    <span className="label">Active Enquiries</span>
                    <div className="value-row">
                        <MessageSquare size={20} className="text-primary" />
                        <span className="value">12</span>
                    </div>
                </div>
            </div>

            {/* Projects Section */}
            <section className="section">
                <h2>Recent Projects</h2>
                <div className="projects-table-container">
                    <table className="projects-table">
                        <thead>
                            <tr>
                                <th>Project Name</th>
                                <th>Status</th>
                                <th>Capital Progress</th>
                                <th>Views</th>
                                <th>Likes</th>
                                <th>Enquiries</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map(project => (
                                <tr key={project.id}>
                                    <td className="font-semibold">{project.name}</td>
                                    <td><span className={`status-badge ${project.status.toLowerCase()}`}>{project.status}</span></td>
                                    <td>
                                        <div className="text-sm font-semibold">${project.raised} / ${project.goal}</div>
                                    </td>
                                    <td>{project.views}</td>
                                    <td>{project.likes}</td>
                                    <td>{project.enquiries}</td>
                                    <td>
                                        <button className="icon-btn-sm"><MoreHorizontal size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </section>

            <style jsx>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .subtitle { color: var(--color-gray-500); }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .stat-box {
          background: white;
          padding: 1.5rem;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }
        
        .stat-box.featured {
            background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
            color: white;
        }
        .stat-box.featured .label { color: rgba(255,255,255,0.8); }
        .stat-box.featured .fraction { color: rgba(255,255,255,0.6); font-size: 0.9rem; font-weight: normal; margin-left: 8px;}

        .stat-box .label { display: block; color: var(--color-gray-400); font-size: 0.875rem; margin-bottom: 0.5rem; }
        .value-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
        .value-row .value { font-size: 1.75rem; font-weight: 700; font-family: var(--font-mono); }
        
        .progress-bar {
            height: 6px;
            background: rgba(255,255,255,0.2);
            border-radius: 99px;
            overflow: hidden;
            margin-top: 0.5rem;
        }
        .progress-fill { height: 100%; background: var(--color-success); border-radius: 99px; }

        .text-success { color: var(--color-success); }
        .text-secondary { color: var(--color-secondary); }

        /* Projects Table */
        .projects-table-container {
            background: white;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-sm);
            overflow: hidden;
        }
        
        .projects-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .projects-table th {
            text-align: left;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--color-gray-200);
            color: var(--color-gray-500);
            font-size: 0.85rem;
            font-weight: 600;
        }
        
        .projects-table td {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--color-gray-100);
            font-size: 0.95rem;
        }
        .projects-table tr:last-child td { border-bottom: none; }

        .status-badge {
          display: inline-block;
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 99px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-badge.active { background: #DCFCE7; color: #166534; }
        .status-badge.draft { background: #F3F4F6; color: #4B5563; }

        .icon-btn-sm { padding: 0.5rem; border-radius: 4px; color: var(--color-gray-400); }
        .icon-btn-sm:hover { background: var(--color-gray-100); color: var(--color-neutral-dark); }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: 1fr; }
            .projects-table-container { overflow-x: auto; }
        }
      `}</style>
        </>
    );
};

export default BuilderOverview;

import React from 'react';
import { Plus, MoreHorizontal, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const MyProjects = () => {
    // Mock Data - Expanded
    const projects = [
        { id: 1, name: 'Volcano Energy Solutions', status: 'Active', category: 'Infrastructure', created: 'Oct 15, 2024', raised: '250k', goal: '1.2M' },
        { id: 2, name: 'Surf City Logistics', status: 'Draft', category: 'Logistics', created: 'Nov 02, 2024', raised: '0', goal: '500k' },
        { id: 3, name: 'BitCoffee Export', status: 'Pending Review', category: 'Agriculture', created: 'Nov 10, 2024', raised: '0', goal: '150k' },
    ];

    return (
        <div className="page-content">
            <div className="header">
                <div>
                    <h1>My Projects</h1>
                    <p className="subtitle">Manage and track all your ventures</p>
                </div>
                <Link to="/dashboard/builder/new-project" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                    <Plus size={18} style={{ marginRight: 8 }} /> Create Project
                </Link>
            </div>

            <div className="card-container">
                <div className="toolbar">
                    <div className="tabs">
                        <button className="tab active">All Projects</button>
                        <button className="tab">Active</button>
                        <button className="tab">Drafts</button>
                    </div>
                    <div className="search-wrapper">
                        <input type="text" placeholder="Search projects..." className="search-input" />
                    </div>
                </div>

                <div className="table-wrapper">
                    <table className="projects-table">
                        <thead>
                            <tr>
                                <th>Project Name</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Date Created</th>
                                <th>Fundraising</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map(project => (
                                <tr key={project.id}>
                                    <td>
                                        <div className="font-semibold">{project.name}</div>
                                    </td>
                                    <td>{project.category}</td>
                                    <td><span className={`status-badge ${project.status.toLowerCase().replace(' ', '-')}`}>{project.status}</span></td>
                                    <td className="text-gray-500">{project.created}</td>
                                    <td>
                                        <div className="text-sm font-semibold">${project.raised} / ${project.goal}</div>
                                        <div className="progress-bar-sm">
                                            <div className="fill" style={{ width: `${(parseInt(project.raised) / parseInt(project.goal)) * 100}%` }}></div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="actions-cell">
                                            <button className="action-btn" title="Edit"><Edit size={16} /></button>
                                            <button className="action-btn" title="View"><ExternalLink size={16} /></button>
                                            <button className="action-btn text-error" title="Delete"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <style jsx>{`
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
                .subtitle { color: var(--color-gray-500); }

                .card-container {
                    background: white;
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-gray-200);
                    overflow: hidden;
                }

                .toolbar {
                    padding: 1rem;
                    border-bottom: 1px solid var(--color-gray-200);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .tabs { display: flex; gap: 1rem; }
                .tab {
                    padding: 0.5rem 1rem;
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--color-gray-500);
                    cursor: pointer;
                }
                .tab.active { background: var(--color-gray-100); color: var(--color-primary); }

                .search-input {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                    width: 250px;
                }

                .table-wrapper { overflow-x: auto; }
                .projects-table { width: 100%; border-collapse: collapse; }
                
                .projects-table th {
                    text-align: left;
                    padding: 1rem;
                    background: var(--color-gray-50);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--color-gray-500);
                    font-weight: 600;
                }
                
                .projects-table td { padding: 1rem; border-bottom: 1px solid var(--color-gray-100); font-size: 0.9rem; }
                .projects-table tr:last-child td { border-bottom: none; }

                .status-badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
                .status-badge.active { background: #DCFCE7; color: #166534; }
                .status-badge.draft { background: #F3F4F6; color: #4B5563; }
                .status-badge.pending-review { background: #FEF9C3; color: #854D0E; }

                .progress-bar-sm { width: 100px; height: 4px; background: #E5E7EB; border-radius: 99px; margin-top: 4px; overflow: hidden; }
                .progress-bar-sm .fill { height: 100%; background: var(--color-success); border-radius: 99px; }

                .actions-cell { display: flex; gap: 0.5rem; }
                .action-btn { padding: 4px; color: var(--color-gray-400); border-radius: 4px; cursor: pointer; }
                .action-btn:hover { background: var(--color-gray-100); color: var(--color-gray-700); }
                .action-btn.text-error:hover { background: #FEF2F2; color: var(--color-error); }
            `}</style>
        </div>
    );
};

export default MyProjects;

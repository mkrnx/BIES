import React, { useState } from 'react';
import { Plus, Edit, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApiQuery, useApiMutation } from '../../hooks/useApi';
import { projectsApi } from '../../services/api';

const MyProjects = () => {
    const { user } = useAuth();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const { data: projects, loading, refetch } = useApiQuery(projectsApi.list, { ownerId: user?.id });
    const { mutate: deleteProject, loading: deleting } = useApiMutation(projectsApi.delete);

    const projectList = projects?.data || projects || [];

    const filtered = projectList.filter(p => {
        if (filter !== 'all' && (p.status || 'draft').toLowerCase() !== filter) return false;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
            await deleteProject(id);
            refetch();
        } catch { /* error handled by hook */ }
    };

    const formatCurrency = (val) => {
        if (!val) return '$0';
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val}`;
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

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
                        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Projects</button>
                        <button className={`tab ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>Active</button>
                        <button className={`tab ${filter === 'draft' ? 'active' : ''}`} onClick={() => setFilter('draft')}>Drafts</button>
                    </div>
                    <div className="search-wrapper">
                        <input type="text" placeholder="Search projects..." className="search-input" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
                        {projectList.length === 0 ? 'No projects yet. Create your first one!' : 'No projects match your filter.'}
                    </div>
                ) : (
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
                                {filtered.map(project => {
                                    const raised = project.raised || 0;
                                    const goal = project.fundingGoal || 0;
                                    const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
                                    return (
                                        <tr key={project.id}>
                                            <td>
                                                <div className="font-semibold">{project.name}</div>
                                            </td>
                                            <td>{project.category || '—'}</td>
                                            <td><span className={`status-badge ${(project.status || 'draft').toLowerCase().replace(' ', '-')}`}>{project.status || 'Draft'}</span></td>
                                            <td className="text-gray-500">{project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'}</td>
                                            <td>
                                                <div className="text-sm font-semibold">{formatCurrency(raised)} / {formatCurrency(goal)}</div>
                                                <div className="progress-bar-sm">
                                                    <div className="fill" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="actions-cell">
                                                    <Link to={`/dashboard/builder/new-project?edit=${project.id}`} className="action-btn" title="Edit"><Edit size={16} /></Link>
                                                    <Link to={`/project/${project.id}`} className="action-btn" title="View"><ExternalLink size={16} /></Link>
                                                    <button className="action-btn text-error" title="Delete" onClick={() => handleDelete(project.id, project.name)} disabled={deleting}><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
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
                    border: none;
                    background: none;
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
                .action-btn { padding: 4px; color: var(--color-gray-400); border-radius: 4px; cursor: pointer; display: inline-flex; border: none; background: none; }
                .action-btn:hover { background: var(--color-gray-100); color: var(--color-gray-700); }
                .action-btn.text-error:hover { background: #FEF2F2; color: var(--color-error); }
            `}</style>
        </div>
    );
};

export default MyProjects;

import React, { useState, useEffect } from 'react';
import { Search, Filter, SlidersHorizontal, MapPin, DollarSign, Download, Heart, Loader2, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { projectsApi, watchlistApi } from '../services/api';
import ZapButton from '../components/ZapButton';
import { useAuth } from '../context/AuthContext';

const ProjectCard = ({ project }) => {
  const [isLiked, setIsLiked] = useState(project._watchlisted || false);

  const toggleWatchlist = async () => {
    try {
      if (isLiked) {
        await watchlistApi.remove(project.id);
      } else {
        await watchlistApi.add(project.id);
      }
      setIsLiked(!isLiked);
    } catch {
      // Silently fail (user might not be logged in)
      setIsLiked(!isLiked);
    }
  };

  const formatFunding = (val) => {
    if (!val) return '—';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val}`;
  };

  const categoryLabel = (c) => {
    if (!c) return '—';
    const special = {
      SAAS: 'SaaS', ECOMMERCE: 'E-Commerce', WEB3: 'Web3', REAL_ESTATE: 'Real Estate'
    };
    if (special[c]) return special[c];
    return c.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
  };

  const builderName = project.owner?.profile?.name || project.owner?.name || project.builder;
  const builderId = project.ownerId || project.owner?.id;

  return (
    <div className="project-card">
      <Link to={`/project/${project.id}`} className="card-image-link">
        <div
          className="card-image"
          style={{
            backgroundColor: project.color || '#E0F2FE',
            backgroundImage: (project.thumbnail || project.coverImage || project.image) ? `url(${project.thumbnail || project.coverImage || project.image})` : 'none'
          }}
        >
          <span className="industry-badge">{categoryLabel(project.category || project.industry)}</span>
          <span className="stage-badge">{project.stage || '—'}</span>
        </div>
      </Link>
      <div className="card-body">
        <Link to={`/project/${project.id}`} className="card-title-link">
          <h3>{project.title || project.name}</h3>
        </Link>
        <p className="description">{project.description || ''}</p>

        <div className="meta-row">
          <div className="meta-item">
            <MapPin size={14} />
            <span>{project.location || 'El Salvador'}</span>
          </div>
          <div className="meta-item">
            <DollarSign size={14} />
            <span>{formatFunding(project.fundingGoal || project.funding)}</span>
          </div>
        </div>

        {builderName && (
          <Link to={builderId ? `/builder/${builderId}` : '#'} className="builder-row builder-link">
            <div className="avatar">{(builderName || '?')[0]}</div>
            <span>{builderName}</span>
          </Link>
        )}

        <div className="actions">
          <Link to={`/project/${project.id}`} className="btn btn-outline btn-xs view-details-btn">Details</Link>
          <button
            className={`icon-btn ${isLiked ? 'liked' : ''}`}
            title="Add to Watchlist"
            onClick={toggleWatchlist}
          >
            <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
          </button>
          <button className="icon-btn btn-secondary-icon" title="Request Pitch Deck"><Download size={18} /></button>
          {project.owner?.nostrPubkey && (
            <ZapButton
              recipients={[{ pubkey: project.owner.nostrPubkey, name: project.owner?.profile?.name || project.owner?.name || 'Builder', avatar: project.owner?.profile?.avatar || '' }]}
              size="sm"
            />
          )}
        </div>
      </div>
      <style jsx>{`
        .project-card {
          background: white;
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--color-gray-200);
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          flex-direction: column;
        }
        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }

        .card-image-link {
          text-decoration: none;
          display: block;
        }

        .card-image {
          height: 160px;
          position: relative;
          padding: 1rem;
          background-size: cover;
          background-position: center;
          cursor: pointer;
        }

        .card-title-link {
          text-decoration: none;
          color: inherit;
        }
        .card-title-link:hover h3 {
          color: var(--color-primary);
        }

        .builder-link {
          text-decoration: none;
          color: inherit;
          cursor: pointer;
        }
        .builder-link:hover span {
          color: var(--color-primary);
        }
        
        .industry-badge {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: rgba(255,255,255,0.9);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-neutral-dark);
        }

        .stage-badge {
          position: absolute;
          bottom: 1rem;
          left: 1rem;
          background: rgba(0,0,0,0.6);
          color: white;
          padding: 2px 8px;
          border-radius: 99px;
          font-size: 0.75rem;
        }

        .card-body { padding: 1.5rem; flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        
        h3 { font-size: 1.1rem; margin-bottom: 0.5rem; }
        
        .description {
          font-size: 0.9rem;
          color: var(--color-gray-500);
          margin-bottom: 1rem;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .meta-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          font-size: 0.85rem;
          color: var(--color-gray-500);
        }
        .meta-item { display: flex; align-items: center; gap: 4px; }

        .builder-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          font-size: 0.85rem;
          color: var(--color-neutral-dark);
          font-weight: 500;
        }

        .avatar {
          width: 24px;
          height: 24px;
          background: var(--color-gray-200);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          color: var(--color-gray-600);
        }

        .actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
        }

        .actions > button.icon-btn:first-of-type {
            margin-left: auto;
        }

        .view-details-btn {
            flex: 1;
            white-space: nowrap !important;
            font-size: 0.85rem;
            padding: 0 12px !important;
            height: 36px !important;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: fit-content;
        }
        
        .icon-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-gray-200);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-gray-400);
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .icon-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .icon-btn.liked { color: var(--color-error); border-color: var(--color-error); }
        
        .btn-secondary-icon:hover { 
          background: var(--color-secondary); 
          border-color: var(--color-secondary); 
          color: white; 
        }
      `}</style>
    </div>
  );
};

const Discover = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [selectedStages, setSelectedStages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const categories = [
    { id: 'FINTECH', label: 'Fintech' },
    { id: 'INFRASTRUCTURE', label: 'Infrastructure' },
    { id: 'ENERGY', label: 'Energy' },
    { id: 'TOURISM', label: 'Tourism' },
    { id: 'AGRICULTURE', label: 'Agriculture' },
    { id: 'REAL_ESTATE', label: 'Real Estate' },
    { id: 'TECHNOLOGY', label: 'Technology' },
    { id: 'FITNESS', label: 'Fitness / Sports' },
    { id: 'HEALTH', label: 'Health / Wellness' },
    { id: 'SAAS', label: 'SaaS' },
    { id: 'ECOMMERCE', label: 'E-Commerce' },
    { id: 'WEB3', label: 'Web3' },
    { id: 'ENTERTAINMENT', label: 'Entertainment' },
    { id: 'LOGISTICS', label: 'Logistics' },
    { id: 'EDUCATION', label: 'Education' }
  ];

  const handleIndustryChange = (industryId) => {
    setSelectedIndustries(prev =>
      prev.includes(industryId) ? prev.filter(i => i !== industryId) : [...prev, industryId]
    );
    setPage(1);
  };

  const handleStageChange = (stage) => {
    setSelectedStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
    setPage(1);
  };

  // Read the URL query param ?q= on load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
    }
  }, [location.search]);

  // Fetch projects from API
  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: 12,
        };
        if (searchQuery) params.search = searchQuery;
        if (selectedIndustries.length === 1) params.category = selectedIndustries[0];
        if (selectedStages.length === 1) params.stage = selectedStages[0];

        const result = await projectsApi.list(params);
        const list = result?.data || result || [];
        setProjects(Array.isArray(list) ? list : []);
        setTotalPages(result?.totalPages || 1);
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchProjects, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedIndustries, selectedStages, page]);

  // Client-side multi-filter (API may not support multi-select)
  const filteredProjects = projects.filter(p => {
    if (selectedIndustries.length > 1) {
      const cat = p.category || p.industry || '';
      if (!selectedIndustries.some(i => i.toLowerCase() === cat.toLowerCase())) return false;
    }
    if (selectedStages.length > 1) {
      const stage = p.stage || '';
      if (!selectedStages.some(s => s.toLowerCase() === stage.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="discover-page container">
      {/* Header & Search */}
      <div className="discover-header">
        <h1>Discover Projects</h1>
      </div>

      <div className="search-row">
        {user?.role === 'BUILDER' && (
          <Link to="/dashboard/builder/projects/new" className="btn btn-primary create-project-btn">
            <Plus size={18} /> Create Project
          </Link>
        )}
        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, industry, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => { }}>Search</button>
        </div>
      </div>

      <div className="content-layout">
        {/* Filters Sidebar */}
        <div className="filters-column">
          <aside className="filters">
            <div className="filter-header">
              <SlidersHorizontal size={18} />
              <span>Filters</span>
            </div>

            <div className="filter-group">
              <label>Industry</label>
              <div className="checkbox-list">
                {categories.map(cat => (
                  <label key={cat.id}>
                    <input
                      type="checkbox"
                      checked={selectedIndustries.includes(cat.id)}
                      onChange={() => handleIndustryChange(cat.id)}
                    />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <label>Stage</label>
              <div className="checkbox-list">
                {['Idea', 'MVP', 'Seed', 'Series A', 'Early Revenue', 'Scaling'].map(stg => (
                  <label key={stg}>
                    <input
                      type="checkbox"
                      checked={selectedStages.includes(stg)}
                      onChange={() => handleStageChange(stg)}
                    />
                    {stg}
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <label>Funding Goal</label>
              <input type="range" className="range-slider" />
              <div className="range-labels">
                <span>$10k</span>
                <span>$5M+</span>
              </div>
            </div>
          </aside>
        </div>

        {/* Project Grid */}
        <div className="project-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            </div>
          ) : filteredProjects.length > 0 ? (
            filteredProjects.map(p => <ProjectCard key={p.id} project={p} />)
          ) : (
            <div className="no-results" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>
              No projects found{searchQuery ? ` matching "${searchQuery}"` : ''}
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      <style jsx>{`
        .discover-page {
          padding-top: 2rem;
          padding-bottom: 4rem;
        }

        .discover-header {
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .search-row {
          display: flex;
          align-items: center;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .filters-column {
          width: 250px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
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
          width: 250px;
          flex-shrink: 0;
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

        input {
          flex: 1;
          border: none;
          padding: 0.5rem 1rem;
          outline: none;
          font-size: 1rem;
        }

        /* Layout */
        .content-layout {
          display: flex;
          gap: 2rem;
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
          width: auto; /* Allow shrink wrap */
          padding: 2px 0;
          margin: 0;
          gap: 8px; /* Use gap instead of margin */
        }
        
        .checkbox-list input[type="checkbox"] {
            margin: 0;
            width: 16px;
            height: 16px;
            accent-color: var(--color-primary);
            flex-shrink: 0;
            cursor: pointer;
        }

        .project-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        @media (max-width: 1024px) {
          .project-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          margin-top: 2rem;
          padding: 1rem;
        }
        .pagination span { font-size: 0.9rem; color: var(--color-gray-500); }

        @media (max-width: 768px) {
          .content-layout { flex-direction: column; }
          .filters-column { width: 100%; }
          .filters { width: 100%; }
          .project-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Discover;

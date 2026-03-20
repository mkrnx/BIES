import React, { useState, useEffect } from 'react';
import { Search, Filter, SlidersHorizontal, MapPin, DollarSign, Download, Heart, Loader2, Plus, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectsApi, watchlistApi } from '../services/api';
import ZapButton from '../components/ZapButton';
import { useAuth } from '../context/AuthContext';
import { useUserMode } from '../context/UserModeContext';
import { getAssetUrl } from '../utils/assets';

const ProjectCard = ({ project, t }) => {
  const [isLiked, setIsLiked] = useState(project._watchlisted || false);

  useEffect(() => {
    setIsLiked(project._watchlisted || false);
  }, [project._watchlisted]);

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
  const builderAvatar = project.owner?.profile?.avatar || project.owner?.avatar;

  return (
    <div className="project-card">
      <Link to={`/project/${project.id}`} className="card-image-link">
        <div
          className="card-image"
          style={{
            backgroundColor: project.color || 'var(--color-blue-tint)',
            backgroundImage: (project.thumbnail || project.coverImage || project.image) ? `url(${getAssetUrl(project.thumbnail || project.coverImage || project.image)})` : 'none'
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
          <Link to={builderId ? `/builder/${builderId}` : '#'} className="builder-row builder-link" style={{ display: 'flex', alignItems: 'center', marginTop: '0.35rem', marginBottom: '0.85rem' }}>
            {builderAvatar ? (
              <img src={getAssetUrl(builderAvatar)} alt={builderName} className="avatar-img" />
            ) : (
              <div className="avatar">{(builderName || '?')[0]}</div>
            )}
            <span className="builder-name-text" style={{ marginTop: '-6px' }}>{builderName}</span>
          </Link>
        )}

        <div className="actions">
          <Link to={`/project/${project.id}`} className="btn btn-outline btn-xs view-details-btn">{t('common.details')}</Link>
          <button
            className={`icon-btn ${isLiked ? 'liked' : ''}`}
            title={t('discover.addToWatchlist')}
            onClick={toggleWatchlist}
          >
            <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
          </button>
          <button className="icon-btn btn-secondary-icon" title={t('discover.requestPitchDeck')}><Download size={18} /></button>
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
          background: var(--color-surface);
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
          background: rgba(75, 85, 99, 0.85);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          color: white;
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
          font-size: 0.85rem;
          color: var(--color-neutral-dark);
          font-weight: 500;
        }

        .avatar {
          width: 24px;
          height: 24px;
          background: var(--color-surface-raised);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          color: var(--color-gray-600);
          flex-shrink: 0;
          margin-right: 12px;
        }

        .avatar-img {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          margin-right: 12px;
        }

        .builder-name-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { mode } = useUserMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [selectedStages, setSelectedStages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

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

        const [result, wlRes] = await Promise.all([
          projectsApi.list(params),
          user?.id ? watchlistApi.list().catch(() => null) : Promise.resolve(null)
        ]);

        const list = result?.data || result || [];
        const wl = wlRes?.data || wlRes || [];
        const wlIds = new Set(wl.map(w => w.projectId || w.project?.id));

        const listWithWatchlist = (Array.isArray(list) ? list : []).map(p => ({
          ...p,
          _watchlisted: wlIds.has(p.id)
        }));

        setProjects(listWithWatchlist);
        setTotalPages(result?.totalPages || 1);
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchProjects, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedIndustries, selectedStages, page, user?.id]);

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
      {/* Header */}
      <h1 className="page-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>{t('discover.title')}</h1>

      <div className="search-row">
        <div className="search-left-column">
          {(mode === 'builder' || user?.role === 'BUILDER' || user?.role === 'ADMIN' || user?.role === 'MOD') && (
            <Link to="/dashboard/builder/new-project" className="btn btn-primary create-project-btn" style={{ display: 'flex', width: '100%', boxSizing: 'border-box', gap: '0.5rem', justifyContent: 'center' }}>
              <Plus size={18} /><span>{t('discover.newProject')}</span>
            </Link>
          )}
        </div>
        <div style={{ display: 'flex', flex: 1, gap: '0.75rem', alignItems: 'center' }}>
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder={t('discover.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button className="mobile-filter-toggle" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}>
              <SlidersHorizontal size={20} />
              {(selectedIndustries.length + selectedStages.length) > 0 && (
                <span className="filter-badge">{selectedIndustries.length + selectedStages.length}</span>
              )}
            </button>
            <button className="btn btn-primary search-btn-desktop" onClick={() => { }}>{t('common.search')}</button>
          </div>
          {isPWA && (mode === 'builder' || user?.role === 'BUILDER' || user?.role === 'ADMIN' || user?.role === 'MOD') && (
            <Link to="/dashboard/builder/new-project" className="pwa-create-btn" title={t('discover.newProject')} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, minWidth: 44, borderRadius: '50%',
              background: 'var(--color-primary)', color: 'white', textDecoration: 'none', flexShrink: 0
            }}>
              <Plus size={24} strokeWidth={2.5} />
            </Link>
          )}
        </div>
      </div>

      <div className="content-layout">
        {/* Filters Sidebar */}
        <div className={`filters-column ${mobileFiltersOpen ? 'mobile-open' : ''}`}>
          <aside className="filters">
            <div className="filter-header">
              <SlidersHorizontal size={18} />
              <span>{t('common.filters')}</span>
            </div>

            <div className="filter-group">
              <label>{t('discover.industry')}</label>
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
              <label>{t('discover.stage')}</label>
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
              <label>{t('discover.fundingGoal')}</label>
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
            filteredProjects.map(p => <ProjectCard key={p.id} project={p} t={t} />)
          ) : (
            <div className="no-results" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>
              {searchQuery ? t('discover.noProjectsSearch', { query: searchQuery }) : t('discover.noProjects')}
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('common.previous')}</button>
            <span>{t('common.page', { current: page, total: totalPages })}</span>
            <button className="btn btn-outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('common.next')}</button>
          </div>
        )}
      </div>

      <style jsx>{`
        .discover-page {
          padding-top: 2rem;
          padding-bottom: 4rem;
        }

        .search-row {
          display: flex;
          align-items: center;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .search-left-column {
          width: 250px;
          flex-shrink: 0;
        }

        .create-project-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          text-decoration: none;
          white-space: nowrap;
          width: 100%;
          box-sizing: border-box;
        }

        .filters-column {
          width: 250px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .search-bar {
          display: flex;
          align-items: center;
          flex: 1;
          background: var(--color-surface-raised);
          padding: 0.5rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-gray-200);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s;
        }
        .search-bar:focus-within { 
            border-color: var(--color-primary); 
            box-shadow: 0 0 0 3px rgba(0, 71, 171, 0.1); 
            background: var(--color-surface-raised); 
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
        .search-input:focus { outline: none; }


        /* Layout */
        .content-layout {
          display: flex;
          gap: 2rem;
          align-items: flex-start;
        }

        .filters {
          width: 250px;
          background: var(--color-surface);
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
            padding: 0;
            display: block;
            width: 16px !important;
            min-width: 16px;
            max-width: 16px;
            height: 16px !important;
            min-height: 16px;
            max-height: 16px;
            accent-color: var(--color-primary);
            flex: 0 0 16px;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            background: var(--color-surface-raised);
            border: 1px solid var(--color-gray-200);
            border-radius: 3px;
            position: relative;
            box-sizing: content-box;
        }
        .checkbox-list input[type="checkbox"]:checked {
            background: var(--color-primary);
        }
        .checkbox-list input[type="checkbox"]:checked::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 11px;
            font-weight: 700;
        }

        .project-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          align-content: flex-start;
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

        .mobile-filter-toggle {
          display: none;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: none;
          color: var(--color-gray-500);
          cursor: pointer;
          flex-shrink: 0;
          position: relative;
        }
        .filter-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--color-secondary);
          color: white;
          font-size: 0.65rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 768px) {
          .search-left-column { display: none !important; }
          .page-header { display: none !important; }
        }

        @media (max-width: 768px) {
          .search-row { flex-direction: column; align-items: stretch; gap: 1rem; }
          .search-left-column { display: none !important; }
          .content-layout { flex-direction: column; }
          .filters-column {
            width: 100%;
            display: none;
          }
          .filters-column.mobile-open {
            display: flex;
          }
          .filters { width: 100%; }
          .project-grid { grid-template-columns: 1fr; }
          .mobile-filter-toggle { display: flex; }
          .search-btn-desktop { display: none; }
        }
      `}</style>
    </div>
  );
};

export default Discover;

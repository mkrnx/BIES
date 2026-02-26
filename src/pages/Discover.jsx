import React, { useState, useEffect } from 'react';
import { Search, Filter, SlidersHorizontal, MapPin, DollarSign, Download, Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const ProjectCard = ({ project }) => {
  const [isLiked, setIsLiked] = useState(false);

  return (
    <div className="project-card">
      <div
        className="card-image"
        style={{
          backgroundColor: project.color,
          backgroundImage: project.image ? `url(${project.image})` : 'none'
        }}
      >
        <span className="industry-badge">{project.industry}</span>
        <span className="stage-badge">{project.stage}</span>
      </div>
      <div className="card-body">
        <h3>{project.name}</h3>
        <p className="description">{project.description}</p>

        <div className="meta-row">
          <div className="meta-item">
            <MapPin size={14} />
            <span>{project.location}</span>
          </div>
          <div className="meta-item">
            <DollarSign size={14} />
            <span>{project.funding}</span>
          </div>
        </div>

        <div className="builder-row">
          <div className="avatar">{project.builder[0]}</div>
          <span>{project.builder}</span>
        </div>

        <div className="actions">
          <Link to={`/project/${project.id}`} className="btn btn-outline btn-xs view-details-btn">Details</Link>
          <button
            className={`icon-btn ${isLiked ? 'liked' : ''}`}
            title="Add to Watchlist"
            onClick={() => setIsLiked(!isLiked)}
          >
            <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
          </button>
          <button className="icon-btn btn-secondary-icon" title="Request Pitch Deck"><Download size={18} /></button>
        </div>
      </div>
      <style jsx>{`
        .project-card {
          background: white;
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--color-gray-200);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }

        .card-image {
          height: 160px;
          position: relative;
          padding: 1rem;
          background-size: cover;
          background-position: center;
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

        .card-body { padding: 1.5rem; }
        
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [selectedStages, setSelectedStages] = useState([]);

  const handleIndustryChange = (industry) => {
    setSelectedIndustries(prev =>
      prev.includes(industry) ? prev.filter(i => i !== industry) : [...prev, industry]
    );
  };

  const handleStageChange = (stage) => {
    setSelectedStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  };

  // Read the URL query param ?q= on load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
    }
  }, [location.search]);

  // Mock Projects
  const projects = [
    { id: 1, name: 'Volcano Energy Solutions', industry: 'Energy', stage: 'Early Revenue', location: 'San Salvador', funding: '$2.5M', builder: 'Carlos M.', description: 'Geothermal energy harvesting for Bitcoin mining infrastructure.', color: '#E0F2FE', image: 'https://images.unsplash.com/photo-1549321473-b3c9b74070be?auto=format&fit=crop&q=80&w=800' },
    { id: 2, name: 'Surf City Logistics', industry: 'Infrastructure', stage: 'Seed', location: 'La Libertad', funding: '$500K', builder: 'Elena R.', description: 'Last-mile delivery drones for the coastal tourism corridor.', color: '#FEF3C7', image: 'https://images.unsplash.com/photo-1473221326025-9183b464bb7e?auto=format&fit=crop&q=80&w=800' },
    { id: 3, name: 'BitPupusas Franchise', industry: 'Food & Bev', stage: 'Scaling', location: 'Santa Ana', funding: '$1.0M', builder: 'Juan P.', description: 'Global franchise model for authentic Salvadoran cuisine accepting only BTC.', color: '#FCE7F3', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800' },
    { id: 4, name: 'NeoBank El Salvador', industry: 'Fintech', stage: 'Idea', location: 'San Salvador', funding: '$150K', builder: 'Sofia L.', description: 'Digital-first banking combining FIAT and Lightning Network.', color: '#DCFCE7', image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=800' },
    { id: 5, name: 'AgroTech Coffee', industry: 'Agriculture', stage: 'MVP', location: 'Sonsonate', funding: '$300K', builder: 'Miguel A.', description: 'IoT sensors for premium coffee growing optimization.', color: '#F3E8FF', image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=800' },
    { id: 6, name: 'Pacific Resort DAO', industry: 'Real Estate', stage: 'Series A', location: 'El Zonte', funding: '$5.0M', builder: 'DAO Team', description: 'Tokenized resort ownership on the Bitcoin beach.', color: '#FFEDD5', image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=800' },
  ];

  // Filter Logic
  const filteredProjects = projects.filter(p => {
    // 1. Search Query Filter
    let matchesSearch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      matchesSearch = (
        p.name.toLowerCase().includes(q) ||
        p.industry.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    // 2. Industry Filter
    let matchesIndustry = true;
    if (selectedIndustries.length > 0) {
      matchesIndustry = selectedIndustries.includes(p.industry);
    }

    // 3. Stage Filter
    let matchesStage = true;
    if (selectedStages.length > 0) {
      matchesStage = selectedStages.includes(p.stage);
    }

    return matchesSearch && matchesIndustry && matchesStage;
  });

  return (
    <div className="discover-page container">
      {/* Header & Search */}
      <div className="discover-header">
        <h1>Discover Projects</h1>
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
        <aside className="filters">
          <div className="filter-header">
            <SlidersHorizontal size={18} />
            <span>Filters</span>
          </div>

          <div className="filter-group">
            <label>Industry</label>
            <div className="checkbox-list">
              {['Fintech', 'Infrastructure', 'Energy', 'Tourism', 'Food & Bev', 'Agriculture', 'Real Estate'].map(ind => (
                <label key={ind}>
                  <input
                    type="checkbox"
                    checked={selectedIndustries.includes(ind)}
                    onChange={() => handleIndustryChange(ind)}
                  />
                  {ind}
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

        {/* Project Grid */}
        <div className="project-grid">
          {filteredProjects.length > 0 ? (
            filteredProjects.map(p => <ProjectCard key={p.id} project={p} />)
          ) : (
            <div className="no-results" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>
              No projects found matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .discover-page {
          padding-top: 2rem;
          padding-bottom: 4rem;
        }

        .discover-header {
          margin-bottom: 2rem;
          text-align: center;
        }

        .search-bar {
          display: flex;
          align-items: center;
          max-width: 600px;
          margin: 1.5rem auto 0;
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

        @media (max-width: 768px) {
          .content-layout { flex-direction: column; }
          .filters { width: 100%; }
          .project-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Discover;

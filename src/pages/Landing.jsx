import React from 'react';
import { useUserMode } from '../context/UserModeContext';
import { ArrowRight, Globe, Shield, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialPulse from '../components/SocialPulse';
import heroBg from '../assets/el-salvador-banner.png';

const Landing = () => {
  const { mode } = useUserMode();

  return (
    <div className="landing-page">
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <span className="pill">
              {mode === 'investor' ? 'For Global Investors' : 'The Future of El Salvador'}
            </span>
            <h1>
              {mode === 'builder'
                ? 'Build the Future of Freedom'
                : mode === 'investor'
                  ? 'Invest in Liberty & Innovation'
                  : 'The Bridge to El Salvador\'s Future'}
            </h1>
            <p className="hero-text">
              {mode === 'builder'
                ? 'Connect with global capital, showcase your vision, and launch your startup in the world\'s first Bitcoin country.'
                : 'Access exclusive deal flow from the world\'s most rapidly growing digital economy. Verified projects, direct connections.'}
            </p>
            <div className="cta-group">
              <Link
                to={mode === 'builder' ? '/dashboard/builder' : '/discover'}
                className={`btn ${mode === 'investor' ? 'btn-secondary' : 'btn-primary'}`}
              >
                {mode === 'builder' ? 'Start Building' : 'Explore Projects'} <ArrowRight size={18} style={{ marginLeft: 8 }} />
              </Link>
              <button className="btn btn-outline-white">Watch Video</button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="stat-card float-1">
              <span className="label">Total Investment</span>
              <span className="value text-mono text-secondary">$42.5M+</span>
            </div>
            <div className="stat-card float-2">
              <span className="label">Active Builders</span>
              <span className="value text-mono text-primary">1,240</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features container">
        <div className="grid grid-cols-3 gap-lg">
          <div className="feature-card">
            <div className="icon-box blue">
              <Globe size={24} />
            </div>
            <h3>Global Ecosystem</h3>
            <p>Direct integration with international markets and the Bitcoin standard economy.</p>
          </div>
          <div className="feature-card">
            <div className="icon-box orange">
              <Shield size={24} />
            </div>
            <h3>Verified Trust</h3>
            <p>Identity verification and due diligence tools built directly into the platform.</p>
          </div>
          <div className="feature-card">
            <div className="icon-box dark">
              <Users size={24} />
            </div>
            <h3>Direct Access</h3>
            <p>No intermediaries. Connect directly with founders and funders via secure messaging.</p>
          </div>
        </div>
      </section>

      <SocialPulse />

      <style jsx>{`
        .landing-page {
          overflow-x: hidden;
        }

        .hero {
          padding: 8rem 0;
          background-image: url(${heroBg});
          background-size: cover;
          background-position: center;
          position: relative;
          color: white;
        }

        .hero::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1;
        }

        .container {
          position: relative;
          z-index: 2;
        }

        .hero-content {
          max-width: 600px;
        }

        .pill {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(4px);
          border-radius: var(--radius-full);
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        h1 {
          font-size: 3.5rem;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          color: white;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .hero-text {
          font-size: 1.25rem;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 2.5rem;
          line-height: 1.6;
        }

        .cta-group {
          display: flex;
          gap: 1rem;
        }

        .btn-outline-white {
          background: transparent;
          border: 1px solid white;
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: var(--radius-md);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-outline-white:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        /* Float Cards */
        .hero-visual {
          position: absolute;
          top: 0;
          right: 0;
          width: 50%;
          height: 100%;
          display: flex;
        }
        
        .stat-card {
          position: absolute;
          background: rgba(255, 255, 255, 0.95);
          padding: 1.5rem;
          border-radius: var(--radius-lg);
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          border: 1px solid rgba(255, 255, 255, 0.5);
          min-width: 200px;
          color: var(--color-neutral-dark);
        }
        
        .float-1 { top: 20%; right: 15%; animation: float 6s ease-in-out infinite; }
        .float-2 { top: 60%; right: 25%; animation: float 8s ease-in-out infinite reverse; }

        .stat-card .label { display: block; font-size: 0.875rem; color: var(--color-gray-500); margin-bottom: 0.5rem; }
        .stat-card .value { font-size: 2rem; font-weight: 700; }

        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }

        /* Features */
        .features { padding: 4rem var(--spacing-md); }
        
        .feature-card {
          background: white;
          padding: 2rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-gray-100);
          transition: transform 0.2s;
        }
        .feature-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }

        .icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
        }
        .icon-box.blue { background: rgba(0, 71, 171, 0.1); color: var(--color-primary); }
        .icon-box.orange { background: rgba(247, 147, 26, 0.1); color: var(--color-secondary); }
        .icon-box.dark { background: rgba(10, 25, 47, 0.1); color: var(--color-neutral-dark); }

        .feature-card h3 { font-size: 1.25rem; margin-bottom: 0.75rem; color: var(--color-neutral-dark); }
        .feature-card p { color: var(--color-gray-500); font-size: 0.95rem; }

        @media (max-width: 768px) {
          .hero-visual { display: none; }
          .hero-content { margin: 0 auto; text-align: center; }
          .cta-group { justify-content: center; }
          .grid-cols-3 { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>

  );
};

export default Landing;

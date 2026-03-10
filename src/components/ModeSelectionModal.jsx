import React from 'react';
import { Hammer, TrendingUp, X } from 'lucide-react';
import { useUserMode } from '../context/UserModeContext';
import { useAuth } from '../context/AuthContext';

const ModeSelectionModal = () => {
    const { isModalOpen, selectMode } = useUserMode();
    const { isAuthenticated } = useAuth();

    // Don't show modal for authenticated users — their role is synced automatically
    if (!isModalOpen || isAuthenticated) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                {/* Builder Side */}
                <div
                    className="mode-card builder-side"
                    onClick={() => selectMode('builder')}
                >
                    <div className="icon-wrapper">
                        <Hammer size={64} color="white" strokeWidth={1.5} />
                    </div>
                    <h2>I WANT TO BUILD</h2>
                    <p className="tagline">Launch your vision in El Salvador</p>
                    <p className="subtext">Create your profile, upload pitch decks, connect with investors</p>
                    <button className="btn btn-outline-light">Enter as Builder</button>
                </div>

                {/* Investor Side */}
                <div
                    className="mode-card investor-side"
                    onClick={() => selectMode('investor')}
                >
                    <div className="icon-wrapper">
                        <TrendingUp size={64} color="white" strokeWidth={1.5} />
                    </div>
                    <h2>I WANT TO INVEST</h2>
                    <p className="tagline">Discover El Salvador's next big opportunity</p>
                    <p className="subtext">Browse verified projects, request pitch decks, build your portfolio</p>
                    <button className="btn btn-outline-light">Enter as Investor</button>
                </div>
            </div>

            <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 25, 47, 0.95);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .modal-content {
          display: flex;
          width: 100%;
          max-width: 1200px;
          height: 80vh;
          background: white;
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.5s ease-out;
        }

        .mode-card {
          flex: 1;
          padding: 4rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        /* Builder Side Styles */
        .builder-side {
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
          color: white;
        }
        .builder-side:hover {
          flex: 1.2;
        }
        .builder-side .btn-outline-light:hover {
          background: white;
          color: var(--color-primary);
        }

        /* Investor Side Styles */
        .investor-side {
          background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-dark) 100%);
          color: white;
        }
        .investor-side:hover {
          flex: 1.2;
        }
        .investor-side .btn-outline-light:hover {
          background: white;
          color: var(--color-secondary);
        }

        .icon-wrapper {
          margin-bottom: 2rem;
          background: rgba(255,255,255,0.1);
          padding: 2rem;
          border-radius: 50%;
          backdrop-filter: blur(10px);
        }

        h2 {
          font-family: var(--font-display);
          font-size: 2.5rem;
          margin-bottom: 1rem;
          color: white;
          letter-spacing: -0.02em;
        }

        .tagline {
          font-size: 1.25rem;
          font-weight: 500;
          margin-bottom: 1rem;
          opacity: 0.9;
        }

        .subtext {
          font-size: 1rem;
          opacity: 0.7;
          max-width: 300px;
          line-height: 1.6;
          margin-bottom: 3rem;
        }

        .btn-outline-light {
          border: 2px solid rgba(255,255,255,0.3);
          color: white;
          padding: 1rem 2rem;
          font-size: 1.1rem;
          border-radius: var(--radius-full);
          background: transparent;
          transition: all 0.2s;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .modal-overlay {
            padding: 1rem;
            align-items: center;
          }
          .modal-content {
            flex-direction: column;
            height: auto;
            max-height: 100vh;
            overflow-y: auto;
          }
          .mode-card {
            padding: 1.75rem 1.25rem;
          }
          .mode-card:hover {
            flex: 1;
          }
          .icon-wrapper {
            margin-bottom: 1rem;
            padding: 1.25rem;
          }
          .icon-wrapper :global(svg) {
            width: 40px !important;
            height: 40px !important;
          }
          h2 {
            font-size: 1.4rem;
            margin-bottom: 0.5rem;
          }
          .tagline {
            font-size: 0.95rem;
            margin-bottom: 0.5rem;
          }
          .subtext {
            font-size: 0.85rem;
            margin-bottom: 1.5rem;
            line-height: 1.4;
          }
          .btn-outline-light {
            padding: 0.75rem 1.5rem;
            font-size: 0.95rem;
          }
        }
      `}</style>
        </div>
    );
};

export default ModeSelectionModal;

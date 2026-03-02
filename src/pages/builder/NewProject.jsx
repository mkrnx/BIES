import React, { useState } from 'react';
import { Upload, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NewProject = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            navigate('/dashboard/builder/projects');
        }, 1500);
    };

    return (
        <div className="container py-8 max-w-3xl">
            <button onClick={() => navigate(-1)} className="back-btn">
                <ChevronLeft size={20} /> Back
            </button>

            <div className="header">
                <h1>Create New Project</h1>
                <p className="subtitle">Launch your venture on the Bitcoin network</p>
            </div>

            <div className="form-card">
                <form onSubmit={handleSubmit}>
                    {/* Cover Image Upload (Mock) */}
                    <div className="form-group">
                        <label>Cover Image</label>
                        <div className="image-upload-area">
                            <Upload size={32} className="text-gray-400 mb-2" />
                            <p className="text-sm font-semibold text-primary">Click to upload</p>
                            <p className="text-xs text-gray-500">SVG, PNG, JPG or GIF (max. 5MB)</p>
                        </div>
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label htmlFor="name">Project Name</label>
                            <input type="text" id="name" placeholder="e.g. Volcano Mining" className="input" required />
                        </div>

                        <div className="form-group">
                            <label htmlFor="category">Category</label>
                            <select id="category" className="input select" required>
                                <option value="">Select a category</option>
                                <option value="infrastructure">Infrastructure</option>
                                <option value="finance">Finance / DeFi</option>
                                <option value="education">Education</option>
                                <option value="tourism">Tourism</option>
                                <option value="technology">Technology</option>
                                <option value="agriculture">Agriculture</option>
                                <option value="energy">Energy</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="tagline">Tagline</label>
                        <input type="text" id="tagline" placeholder="Short description (max 100 chars)" className="input" maxLength={100} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Detailed Description</label>
                        <textarea id="description" rows={5} placeholder="Describe your project, goals, and team..." className="input textarea" required></textarea>
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label htmlFor="goal">Funding Goal (USD)</label>
                            <div className="input-with-prefix">
                                <span className="prefix">$</span>
                                <input type="number" id="goal" placeholder="500,000" className="input pl-8" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="website">Website URL</label>
                            <input type="url" id="website" placeholder="https://" className="input" />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>

            <style jsx>{`
        .container { max-width: 800px; margin: 0 auto; }
        .max-w-3xl { max-width: 48rem; }
        
        .header { margin-bottom: 2rem; }
        .subtitle { color: var(--color-gray-500); margin-top: 0.5rem; }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--color-gray-500);
          background: none;
          border: none;
          cursor: pointer;
          margin-bottom: 1.5rem;
          font-weight: 500;
          padding: 0;
        }
        .back-btn:hover { color: var(--color-primary); }

        .form-card {
          background: white;
          padding: 2rem;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--color-gray-200);
        }

        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-gray-700); font-size: 0.95rem; }

        .input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-gray-300);
          font-size: 1rem;
          transition: border-color 0.2s;
        }
        .input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(255, 91, 0, 0.1); }
        
        .textarea { resize: vertical; }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }

        .input-with-prefix { position: relative; }
        .input-with-prefix .prefix { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--color-gray-500); pointer-events: none; }
        .input.pl-8 { padding-left: 2rem; }

        .image-upload-area {
          border: 2px dashed var(--color-gray-300);
          border-radius: var(--radius-lg);
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--color-gray-50);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .image-upload-area:hover { border-color: var(--color-primary); background: var(--color-gray-50); }

        .form-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; }

        .text-gray-400 { color: var(--color-gray-400); }
      `}</style>
        </div>
    );
};

export default NewProject;

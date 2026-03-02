import React, { useState, useEffect } from 'react';
import { Upload, ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectsApi, uploadApi } from '../../services/api';

const NewProject = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit');

    const [loading, setLoading] = useState(false);
    const [loadingProject, setLoadingProject] = useState(!!editId);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        name: '',
        category: '',
        tagline: '',
        description: '',
        fundingGoal: '',
        website: '',
        coverImage: '',
    });

    useEffect(() => {
        if (editId) {
            projectsApi.get(editId).then(project => {
                setForm({
                    name: project.name || '',
                    category: project.category || '',
                    tagline: project.tagline || '',
                    description: project.description || '',
                    fundingGoal: project.fundingGoal || '',
                    website: project.website || '',
                    coverImage: project.coverImage || '',
                });
            }).catch(() => {
                setError('Failed to load project for editing.');
            }).finally(() => setLoadingProject(false));
        }
    }, [editId]);

    const handleChange = (field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const result = await uploadApi.media(file);
            setForm(prev => ({ ...prev, coverImage: result.url }));
        } catch {
            setError('Failed to upload image.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = {
                ...form,
                fundingGoal: form.fundingGoal ? Number(form.fundingGoal) : 0,
            };

            if (editId) {
                await projectsApi.update(editId, payload);
            } else {
                await projectsApi.create(payload);
            }
            navigate('/dashboard/builder/projects');
        } catch (err) {
            setError(err.message || 'Failed to save project.');
        } finally {
            setLoading(false);
        }
    };

    if (loadingProject) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div className="container py-8 max-w-3xl">
            <button onClick={() => navigate(-1)} className="back-btn">
                <ChevronLeft size={20} /> Back
            </button>

            <div className="header">
                <h1>{editId ? 'Edit Project' : 'Create New Project'}</h1>
                <p className="subtitle">Launch your venture on the Bitcoin network</p>
            </div>

            {error && (
                <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
                    {error}
                </div>
            )}

            <div className="form-card">
                <form onSubmit={handleSubmit}>
                    {/* Cover Image Upload */}
                    <div className="form-group">
                        <label>Cover Image</label>
                        {form.coverImage ? (
                            <div className="image-preview">
                                <img src={form.coverImage} alt="Cover" />
                                <button type="button" onClick={() => setForm(prev => ({ ...prev, coverImage: '' }))} className="remove-img">Remove</button>
                            </div>
                        ) : (
                            <label className="image-upload-area">
                                <Upload size={32} className="text-gray-400 mb-2" />
                                <p className="text-sm font-semibold text-primary">Click to upload</p>
                                <p className="text-xs text-gray-500">SVG, PNG, JPG or GIF (max. 5MB)</p>
                                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                            </label>
                        )}
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label htmlFor="name">Project Name</label>
                            <input type="text" id="name" placeholder="e.g. Volcano Mining" className="input" required value={form.name} onChange={handleChange('name')} />
                        </div>

                        <div className="form-group">
                            <label htmlFor="category">Category</label>
                            <select id="category" className="input select" required value={form.category} onChange={handleChange('category')}>
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
                        <input type="text" id="tagline" placeholder="Short description (max 100 chars)" className="input" maxLength={100} value={form.tagline} onChange={handleChange('tagline')} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Detailed Description</label>
                        <textarea id="description" rows={5} placeholder="Describe your project, goals, and team..." className="input textarea" required value={form.description} onChange={handleChange('description')}></textarea>
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label htmlFor="goal">Funding Goal (USD)</label>
                            <div className="input-with-prefix">
                                <span className="prefix">$</span>
                                <input type="number" id="goal" placeholder="500000" className="input pl-8" value={form.fundingGoal} onChange={handleChange('fundingGoal')} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="website">Website URL</label>
                            <input type="url" id="website" placeholder="https://" className="input" value={form.website} onChange={handleChange('website')} />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? (editId ? 'Saving...' : 'Creating...') : (editId ? 'Save Changes' : 'Create Project')}
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

        .image-preview { position: relative; border-radius: var(--radius-lg); overflow: hidden; max-height: 200px; }
        .image-preview img { width: 100%; height: 200px; object-fit: cover; }
        .image-preview .remove-img {
          position: absolute; top: 8px; right: 8px;
          background: rgba(0,0,0,0.6); color: white;
          border: none; padding: 4px 12px; border-radius: var(--radius-md);
          cursor: pointer; font-size: 0.8rem;
        }

        .form-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; }

        .text-gray-400 { color: var(--color-gray-400); }
      `}</style>
        </div>
    );
};

export default NewProject;

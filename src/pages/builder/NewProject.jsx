import React, { useState, useEffect } from 'react';
import { Camera, ChevronLeft, Loader2, FileText, X, Save, Upload, Plus, UserPlus, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectsApi, uploadApi, profilesApi } from '../../services/api';

const NewProject = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit');

    const [loading, setLoading] = useState(false);
    const [loadingProject, setLoadingProject] = useState(!!editId);
    const [imageUploading, setImageUploading] = useState(false);
    const [error, setError] = useState('');
    const [deckFile, setDeckFile] = useState(null);
    const [deckUploading, setDeckUploading] = useState(false);
    const [existingDeck, setExistingDeck] = useState(false);
    const [teamAvatarUploading, setTeamAvatarUploading] = useState(null); // index of uploading member
    const [memberSearchResults, setMemberSearchResults] = useState([]);
    const [memberSearchIndex, setMemberSearchIndex] = useState(null); // which team member index is searching
    const [form, setForm] = useState({
        name: '',
        category: '',
        stage: 'IDEA',
        description: '',
        fundingGoal: '',
        raisedAmount: '',
        website: '',
        coverImage: '',
        ownerRole: '',
        teamInfo: [],
        customSections: [],
        useOfFunds: [],
        requiresDeckApproval: true,
    });

    useEffect(() => {
        if (editId) {
            projectsApi.get(editId).then(project => {
                setForm({
                    name: project.title || '',
                    category: project.category || '',
                    stage: project.stage || 'IDEA',
                    description: project.description || '',
                    fundingGoal: project.fundingGoal || '',
                    raisedAmount: project.raisedAmount || '',
                    website: project.websiteUrl || '',
                    coverImage: project.thumbnail || '',
                    ownerRole: project.ownerRole || '',
                    teamInfo: project.teamInfo || [],
                    customSections: project.customSections || [],
                    useOfFunds: project.useOfFunds || [],
                    requiresDeckApproval: project.requiresDeckApproval !== undefined ? project.requiresDeckApproval : true,
                });
                if (project.deckKey) setExistingDeck(true);
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
        setImageUploading(true);
        setError('');
        try {
            const result = await uploadApi.media(file);
            setForm(prev => ({ ...prev, coverImage: result.url }));
        } catch {
            setError('Failed to upload image. Please try again.');
        } finally {
            setImageUploading(false);
        }
    };

    const handleDeckUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/pdf') { setError('Please upload a PDF file'); return; }
        if (file.size > 20 * 1024 * 1024) { setError('File must be under 20MB'); return; }
        setDeckFile(file);
        setError('');
    };

    // ─── Team Members ────────────────────────────────────────
    const addTeamMember = () => {
        setForm(prev => ({
            ...prev,
            teamInfo: [...prev.teamInfo, { name: '', position: '', avatar: '' }],
        }));
    };

    const updateTeamMember = (index, field, value) => {
        setForm(prev => {
            const updated = [...prev.teamInfo];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, teamInfo: updated };
        });
    };

    const removeTeamMember = (index) => {
        setForm(prev => ({
            ...prev,
            teamInfo: prev.teamInfo.filter((_, i) => i !== index),
        }));
    };

    const handleMemberNameChange = (index, value) => {
        updateTeamMember(index, 'name', value);
        updateTeamMember(index, 'biesUserId', ''); // clear any prior selection
        setMemberSearchIndex(index);
        if (value.trim().length >= 2) {
            const timer = setTimeout(async () => {
                try {
                    const res = await profilesApi.list({ search: value, limit: 5 });
                    const list = res?.data || res || [];
                    setMemberSearchResults(list);
                } catch {
                    setMemberSearchResults([]);
                }
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setMemberSearchResults([]);
        }
    };

    const selectBiesMember = (index, profile) => {
        updateTeamMember(index, 'name', profile.name || '');
        updateTeamMember(index, 'avatar', profile.avatar || '');
        updateTeamMember(index, 'biesUserId', profile.userId || profile.user?.id || '');
        setMemberSearchResults([]);
        setMemberSearchIndex(null);
    };

    const handleTeamAvatarUpload = async (index, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setTeamAvatarUploading(index);
        try {
            const result = await uploadApi.media(file);
            updateTeamMember(index, 'avatar', result.url);
        } catch {
            setError('Failed to upload team member photo.');
        } finally {
            setTeamAvatarUploading(null);
        }
    };

    // ─── Custom Sections ─────────────────────────────────────
    const addSection = () => {
        setForm(prev => ({
            ...prev,
            customSections: [...prev.customSections, { title: '', body: '' }],
        }));
    };

    const updateSection = (index, field, value) => {
        setForm(prev => {
            const updated = [...prev.customSections];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, customSections: updated };
        });
    };

    const removeSection = (index) => {
        setForm(prev => ({
            ...prev,
            customSections: prev.customSections.filter((_, i) => i !== index),
        }));
    };

    // ─── Use of Funds ──────────────────────────────────────────
    const addUseOfFunds = () => {
        setForm(prev => ({
            ...prev,
            useOfFunds: [...prev.useOfFunds, { label: '', percentage: '' }],
        }));
    };

    const updateUseOfFunds = (index, field, value) => {
        setForm(prev => {
            const updated = [...prev.useOfFunds];
            updated[index] = { ...updated[index], [field]: field === 'percentage' ? value.replace(/[^0-9.]/g, '') : value };
            return { ...prev, useOfFunds: updated };
        });
    };

    const removeUseOfFunds = (index) => {
        setForm(prev => ({
            ...prev,
            useOfFunds: prev.useOfFunds.filter((_, i) => i !== index),
        }));
    };

    // Helper to calculate total percentage safely with decimals
    const getFundsTotal = () => {
        const total = form.useOfFunds.reduce((sum, u) => sum + (parseFloat(u.percentage) || 0), 0);
        return parseFloat(total.toFixed(2));
    };
    const fundsTotal = getFundsTotal();

    // ─── Submit ──────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e?.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = {
                title: form.name,
                description: form.description,
                category: form.category || undefined,
                stage: form.stage || undefined,
                fundingGoal: form.fundingGoal ? Number(form.fundingGoal) : undefined,
                raisedAmount: form.raisedAmount !== '' ? Number(form.raisedAmount) : undefined,
                websiteUrl: form.website || undefined,
                thumbnail: form.coverImage || undefined,
                ownerRole: form.ownerRole || undefined,
                teamInfo: form.teamInfo.filter(m => m.name.trim()),
                customSections: form.customSections.filter(s => s.title.trim() || s.body.trim()),
                useOfFunds: form.useOfFunds.filter(u => u.label.trim() && parseFloat(u.percentage) > 0),
                requiresDeckApproval: form.requiresDeckApproval,
            };
            Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

            let project;
            if (editId) {
                project = await projectsApi.update(editId, payload);
            } else {
                project = await projectsApi.create(payload);
            }

            if (deckFile && project?.id) {
                setDeckUploading(true);
                await uploadApi.deck(deckFile, project.id);
            }

            navigate('/dashboard/builder/projects');
        } catch (err) {
            setError(err.message || 'Failed to save project.');
        } finally {
            setLoading(false);
            setDeckUploading(false);
        }
    };

    if (loadingProject) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    const isBusy = loading || imageUploading || deckUploading;

    return (
        <div className="project-edit-page">
            <div className="container py-8 max-w-6xl">

                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <button onClick={() => navigate(-1)} className="back-link">
                            <ChevronLeft size={18} /> Back
                        </button>
                        <h1 className="h1-title">{editId ? 'Edit Project' : 'Create New Project'}</h1>
                        <p className="text-gray-500">Launch your venture on the Bitcoin network</p>
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                {/* Cover Image Banner Card */}
                <div className="profile-card mb-8" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="cover-banner" style={{
                        backgroundImage: form.coverImage ? `url(${form.coverImage})` : 'none',
                    }}>
                        {imageUploading && (
                            <div className="upload-overlay">
                                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'white' }} />
                                <span style={{ color: 'white', fontWeight: 600, marginTop: '0.5rem' }}>Uploading...</span>
                            </div>
                        )}
                        <div className="banner-actions-left">
                            <label className="banner-btn" style={{ cursor: imageUploading ? 'not-allowed' : 'pointer' }}>
                                {imageUploading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={16} />}
                                {form.coverImage ? 'Change Cover' : 'Add Cover Image'}
                                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={imageUploading} />
                            </label>
                            {form.coverImage && !imageUploading && (
                                <button className="banner-btn danger" onClick={() => setForm(prev => ({ ...prev, coverImage: '' }))}>
                                    <X size={16} /> Remove
                                </button>
                            )}
                        </div>
                        <div className="banner-actions-right">
                            <button onClick={handleSubmit} type="button" disabled={isBusy} className="save-btn">
                                {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
                                {loading ? 'Saving...' : deckUploading ? 'Uploading Deck...' : (editId ? 'Save Changes' : 'Create Project')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Form Sections */}
                <div className="sections">

                    {/* Project Details */}
                    <div className="profile-card">
                        <div className="section-inner">
                            <h3 className="h3-title section-heading">Project Details</h3>

                            <div className="form-row">
                                <label className="form-label">Project Name</label>
                                <div className="form-content">
                                    <input type="text" value={form.name} onChange={handleChange('name')} className="input-field" placeholder="e.g. Volcano Mining" required />
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Category</label>
                                <div className="form-content">
                                    <select value={form.category} onChange={handleChange('category')} className="input-field" required>
                                        <option value="">Select a category</option>
                                        <option value="INFRASTRUCTURE">Infrastructure</option>
                                        <option value="FINTECH">Finance / DeFi</option>
                                        <option value="EDUCATION">Education</option>
                                        <option value="TOURISM">Tourism</option>
                                        <option value="TECHNOLOGY">Technology</option>
                                        <option value="FITNESS">Fitness / Sports</option>
                                        <option value="HEALTH">Healthcare / Wellness</option>
                                        <option value="SAAS">Software as a Service (SaaS)</option>
                                        <option value="ECOMMERCE">E-Commerce</option>
                                        <option value="WEB3">Web3 / Crypto</option>
                                        <option value="ENTERTAINMENT">Entertainment / Media</option>
                                        <option value="LOGISTICS">Logistics / Supply Chain</option>
                                        <option value="AGRICULTURE">Agriculture</option>
                                        <option value="ENERGY">Energy</option>
                                        <option value="REAL_ESTATE">Real Estate</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Stage</label>
                                <div className="form-content">
                                    <select value={form.stage} onChange={handleChange('stage')} className="input-field">
                                        <option value="IDEA">Idea</option>
                                        <option value="MVP">MVP</option>
                                        <option value="GROWTH">Growth</option>
                                        <option value="SCALING">Scaling</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Description</label>
                                <div className="form-content">
                                    <textarea
                                        rows="5"
                                        value={form.description}
                                        onChange={handleChange('description')}
                                        className="input-field"
                                        style={{ resize: 'vertical', minHeight: '120px' }}
                                        placeholder="Describe your project, goals, and team..."
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Funding */}
                    <div className="profile-card">
                        <div className="section-inner">
                            <h3 className="h3-title section-heading">Funding</h3>

                            <div className="form-row">
                                <label className="form-label">Funding Goal (USD)</label>
                                <div className="form-content">
                                    <div className="input-with-prefix">
                                        <span className="prefix">$</span>
                                        <input type="number" value={form.fundingGoal} onChange={handleChange('fundingGoal')} className="input-field" style={{ paddingLeft: '2rem' }} placeholder="500000" />
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Amount Raised (USD)</label>
                                <div className="form-content">
                                    <div className="input-with-prefix">
                                        <span className="prefix">$</span>
                                        <input type="number" value={form.raisedAmount} onChange={handleChange('raisedAmount')} className="input-field" style={{ paddingLeft: '2rem' }} placeholder="0" />
                                    </div>
                                    <p className="form-hint">Update this as you raise funds. This is displayed on your project page.</p>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Website URL</label>
                                <div className="form-content">
                                    <input type="url" value={form.website} onChange={handleChange('website')} className="input-field" placeholder="https://" />
                                </div>
                            </div>

                            {/* Use of Funds */}
                            <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Use of Funds</label>
                                <div className="form-content">
                                    {form.useOfFunds.length > 0 && (
                                        <div style={{ marginBottom: '1rem' }}>
                                            {form.useOfFunds.map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                    <input
                                                        type="text"
                                                        value={item.label}
                                                        onChange={(e) => updateUseOfFunds(idx, 'label', e.target.value)}
                                                        className="input-field"
                                                        placeholder="e.g. Development, Marketing"
                                                        style={{ flex: 1 }}
                                                    />
                                                    <div style={{ position: 'relative', width: '80px', flexShrink: 0 }}>
                                                        <input
                                                            type="text"
                                                            value={item.percentage}
                                                            onChange={(e) => updateUseOfFunds(idx, 'percentage', e.target.value)}
                                                            className="input-field"
                                                            placeholder="0"
                                                            style={{ paddingRight: '1.5rem', textAlign: 'right' }}
                                                        />
                                                        <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)', pointerEvents: 'none' }}>%</span>
                                                    </div>
                                                    <button type="button" className="team-remove" onClick={() => removeUseOfFunds(idx)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            <p style={{ fontSize: '0.78rem', color: fundsTotal === 100 ? '#16a34a' : fundsTotal > 100 ? '#ef4444' : 'var(--color-gray-400)', marginBottom: '0.5rem' }}>
                                                Total: {fundsTotal}%{fundsTotal === 100 ? ' ✓' : fundsTotal > 100 ? ' (exceeds 100%)' : ''}
                                            </p>
                                        </div>
                                    )}
                                    <button type="button" className="add-btn" onClick={addUseOfFunds}>
                                        <Plus size={16} /> Add Use
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Team Members */}
                    <div className="profile-card">
                        <div className="section-inner">
                            <h3 className="h3-title section-heading">Core Team</h3>

                            {form.teamInfo.length === 0 && (
                                <p className="empty-hint">Add team members to showcase who's building this project.</p>
                            )}

                            {/* Main Builder (Owner) Role Input */}
                            <div className="team-entry" style={{ background: '#f0f7ff', borderColor: '#bfdbfe' }}>
                                <div className="team-avatar-upload">
                                    <div className="team-avatar-label" style={{ cursor: 'default', background: 'var(--color-primary)', color: 'white', border: 'none' }}>
                                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>You</span>
                                    </div>
                                </div>
                                <div className="team-fields" style={{ justifyContent: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Main Builder</span>
                                    <input
                                        type="text"
                                        value={form.ownerRole}
                                        onChange={handleChange('ownerRole')}
                                        className="input-field"
                                        placeholder="Your Role in the Project (e.g. Founder, CEO)"
                                    />
                                </div>
                            </div>

                            {form.teamInfo.map((member, idx) => (
                                <div key={idx} className="team-entry">
                                    <div className="team-avatar-upload">
                                        {member.biesUserId ? (
                                            <div className="team-avatar-label" style={{ cursor: 'default', border: member.avatar ? 'none' : undefined }}>
                                                {member.avatar ? (
                                                    <img src={member.avatar} alt="" className="team-avatar-img" />
                                                ) : (
                                                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-gray-500)' }}>{(member.name || '?')[0]?.toUpperCase()}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <label className="team-avatar-label">
                                                {teamAvatarUploading === idx ? (
                                                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                                ) : member.avatar ? (
                                                    <img src={member.avatar} alt="" className="team-avatar-img" />
                                                ) : (
                                                    <Camera size={18} />
                                                )}
                                                <input type="file" accept="image/*" onChange={(e) => handleTeamAvatarUpload(idx, e)} style={{ display: 'none' }} />
                                            </label>
                                        )}
                                    </div>
                                    <div className="team-fields" style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            value={member.name}
                                            onChange={(e) => handleMemberNameChange(idx, e.target.value)}
                                            onFocus={() => { if (member.name?.length >= 2) setMemberSearchIndex(idx); }}
                                            onBlur={() => setTimeout(() => setMemberSearchIndex(null), 200)}
                                            className="input-field"
                                            placeholder="Name (type to search BIES members)"
                                        />
                                        {memberSearchIndex === idx && memberSearchResults.length > 0 && (
                                            <div className="member-dropdown">
                                                {memberSearchResults.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        className="member-dropdown-item"
                                                        onMouseDown={(e) => { e.preventDefault(); selectBiesMember(idx, p); }}
                                                    >
                                                        <div className="member-dropdown-avatar">
                                                            {p.avatar ? <img src={p.avatar} alt="" /> : <span>{(p.name || '?')[0]?.toUpperCase()}</span>}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div>
                                                            {p.title && <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{p.title}</div>}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <input
                                            type="text"
                                            value={member.position}
                                            onChange={(e) => updateTeamMember(idx, 'position', e.target.value)}
                                            className="input-field"
                                            placeholder="Position / Role"
                                        />
                                    </div>
                                    <button type="button" className="team-remove" onClick={() => removeTeamMember(idx)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            <button type="button" className="add-btn" onClick={addTeamMember}>
                                <UserPlus size={16} /> Add Team Member
                            </button>
                        </div>
                    </div>

                    {/* Custom Content Sections */}
                    <div className="profile-card">
                        <div className="section-inner">
                            <h3 className="h3-title section-heading">Additional Sections</h3>
                            <p className="empty-hint" style={{ marginBottom: '1rem' }}>Add extra info about your project — property details, roadmap, traction, anything relevant.</p>

                            {form.customSections.map((section, idx) => (
                                <div key={idx} className="custom-section-entry">
                                    <div className="custom-section-header">
                                        <span className="custom-section-num">Section {idx + 1}</span>
                                        <button type="button" className="team-remove" onClick={() => removeSection(idx)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={(e) => updateSection(idx, 'title', e.target.value)}
                                        className="input-field"
                                        placeholder="Section Title"
                                        style={{ marginBottom: '0.75rem' }}
                                    />
                                    <textarea
                                        rows="4"
                                        value={section.body}
                                        onChange={(e) => updateSection(idx, 'body', e.target.value)}
                                        className="input-field"
                                        style={{ resize: 'vertical', minHeight: '100px' }}
                                        placeholder="Section content..."
                                    />
                                </div>
                            ))}

                            <button type="button" className="add-btn" onClick={addSection}>
                                <Plus size={16} /> Add Section
                            </button>
                        </div>
                    </div>

                    {/* Pitch Deck */}
                    <div className="profile-card">
                        <div className="section-inner">
                            <h3 className="h3-title section-heading">Pitch Deck</h3>

                            <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Upload PDF</label>
                                <div className="form-content">
                                    {deckFile ? (
                                        <div className="deck-file-display">
                                            <FileText size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                            <span className="deck-name">{deckFile.name}</span>
                                            <span className="deck-size">({(deckFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                                            <button type="button" className="deck-remove" onClick={() => setDeckFile(null)}>
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : existingDeck ? (
                                        <div className="deck-file-display">
                                            <FileText size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                            <span className="deck-name" style={{ color: 'var(--color-gray-600)' }}>Pitch deck uploaded</span>
                                            <label className="deck-replace-btn">
                                                Replace
                                                <input type="file" accept=".pdf,application/pdf" onChange={handleDeckUpload} style={{ display: 'none' }} />
                                            </label>
                                        </div>
                                    ) : (
                                        <label className="deck-upload-area">
                                            <Upload size={24} style={{ color: 'var(--color-gray-400)', marginBottom: '0.5rem' }} />
                                            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-primary)' }}>Upload Pitch Deck</p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)', marginTop: '0.25rem' }}>PDF only, max 20MB</p>
                                            <input type="file" accept=".pdf,application/pdf" onChange={handleDeckUpload} style={{ display: 'none' }} />
                                        </label>
                                    )}

                                    {/* Quick Toggle for Approval */}
                                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-gray-200)' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-gray-800)' }}>Approve Viewers</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)', marginTop: '0.15rem' }}>If enabled, investors must request access before downloading.</div>
                                            </div>
                                            <div style={{
                                                position: 'relative', width: '44px', height: '24px',
                                                background: form.requiresDeckApproval ? 'var(--color-primary)' : 'var(--color-gray-300)',
                                                borderRadius: '12px', transition: 'background 0.2s', flexShrink: 0
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={form.requiresDeckApproval}
                                                    onChange={(e) => setForm(prev => ({ ...prev, requiresDeckApproval: e.target.checked }))}
                                                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                                />
                                                <div style={{
                                                    position: 'absolute', top: '2px', left: form.requiresDeckApproval ? '22px' : '2px',
                                                    width: '20px', height: '20px', background: 'white', borderRadius: '50%',
                                                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                }} />
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Save */}
                    <div className="bottom-actions">
                        <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">Cancel</button>
                        <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={isBusy}>
                            {loading ? (editId ? 'Saving...' : 'Creating...') : deckUploading ? 'Uploading deck...' : (editId ? 'Save Changes' : 'Create Project')}
                        </button>
                    </div>

                </div>
            </div>

            <style jsx>{`
                .project-edit-page {
                    background-color: #f8fafc;
                    min-height: 100vh;
                    padding-bottom: 4rem;
                }
                .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
                .mb-8 { margin-bottom: 2rem; }

                .page-header { margin-bottom: 2rem; }
                .back-link {
                    display: inline-flex; align-items: center; gap: 0.25rem;
                    color: var(--color-gray-500); font-weight: 500; font-size: 0.9rem;
                    background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 0.75rem;
                }
                .back-link:hover { color: var(--color-primary); }

                .h1-title { font-size: 2rem; line-height: 2.25rem; font-weight: 700; font-family: var(--font-display); margin-bottom: 0.25rem; }
                .h3-title { font-size: 1.25rem; font-weight: 700; font-family: var(--font-display); }
                .text-gray-500 { color: var(--color-gray-500); margin: 0; }

                .error-banner {
                    background: #FEF2F2; color: #EF4444;
                    padding: 0.75rem 1rem; border-radius: 8px;
                    margin-bottom: 1rem; font-size: 0.875rem;
                }

                .profile-card {
                    background: white;
                    border-radius: var(--radius-xl, 16px);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-gray-200);
                }
                .section-inner { padding: 2rem; }
                .sections { display: flex; flex-direction: column; gap: 2rem; }
                .section-heading {
                    margin-bottom: 1.5rem; padding-bottom: 1rem;
                    border-bottom: 1px solid var(--color-gray-200);
                }

                .cover-banner {
                    position: relative; height: 220px;
                    background-color: #0a192f; background-size: cover; background-position: center;
                    display: flex; align-items: flex-end; justify-content: space-between;
                    padding: 1.25rem;
                }
                .cover-banner::before {
                    content: ''; position: absolute; inset: 0;
                    background: linear-gradient(transparent 40%, rgba(0,0,0,0.45));
                    pointer-events: none;
                }

                .upload-overlay {
                    position: absolute; inset: 0; background: rgba(0,0,0,0.5);
                    display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 15;
                }

                .banner-actions-left, .banner-actions-right {
                    position: relative; z-index: 20; display: flex; gap: 0.5rem;
                }

                .banner-btn {
                    display: flex; align-items: center; gap: 0.4rem;
                    background: white; color: #1f2937;
                    border-radius: var(--radius-md, 8px); height: 38px; padding: 0 16px;
                    font-weight: 600; font-size: 0.85rem; border: none; cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15); white-space: nowrap;
                }
                .banner-btn:hover { opacity: 0.9; }
                .banner-btn.danger { color: #EF4444; }

                .save-btn {
                    display: inline-flex; align-items: center; gap: 0.5rem;
                    background: var(--color-primary, #0052cc); color: white; border: none;
                    border-radius: var(--radius-md, 8px); height: 44px; padding: 0 24px;
                    font-weight: 700; font-family: var(--font-display); font-size: 1rem;
                    letter-spacing: 0.02em; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                    cursor: pointer; white-space: nowrap;
                }
                .save-btn:disabled { opacity: 0.7; cursor: not-allowed; }

                .form-row {
                    display: grid; grid-template-columns: 160px 1fr;
                    gap: 2rem; align-items: start; margin-bottom: 2rem;
                }
                .form-label {
                    text-align: right; color: var(--color-gray-700);
                    font-weight: 600; font-size: 0.875rem; padding-top: 0.6rem;
                }
                .form-content { min-width: 0; }
                .form-hint { font-size: 0.78rem; color: var(--color-gray-400); margin-top: 0.4rem; }

                .input-field {
                    width: 100%; padding: 0.75rem 1rem;
                    border: 1px solid var(--color-gray-300); background: white;
                    border-radius: var(--radius-md, 8px); outline: none;
                    font-size: 0.95rem; transition: all 0.2s;
                }
                .input-field:focus {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(0, 82, 204, 0.1);
                }
                select.input-field { appearance: auto; cursor: pointer; }

                .input-with-prefix { position: relative; }
                .input-with-prefix .prefix {
                    position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
                    color: var(--color-gray-500); pointer-events: none; font-weight: 500;
                }

                .empty-hint { color: var(--color-gray-400); font-size: 0.88rem; }

                /* Team Members */
                .team-entry {
                    display: flex; align-items: flex-start; gap: 1rem;
                    padding: 1rem; margin-bottom: 1rem;
                    background: var(--color-gray-50, #f9fafb);
                    border: 1px solid var(--color-gray-200);
                    border-radius: 10px;
                }
                .team-avatar-upload { flex-shrink: 0; }
                .team-avatar-label {
                    width: 56px; height: 56px; border-radius: 50%;
                    background: var(--color-gray-100); border: 2px dashed var(--color-gray-300);
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; overflow: hidden; color: var(--color-gray-400);
                    transition: border-color 0.15s;
                }
                .team-avatar-label:hover { border-color: var(--color-primary); }
                .team-avatar-img { width: 100%; height: 100%; object-fit: cover; }
                .team-fields { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
                .team-remove {
                    background: none; border: none; cursor: pointer; padding: 0.35rem;
                    color: var(--color-gray-400); border-radius: 6px; transition: all 0.15s;
                }
                .team-remove:hover { color: #ef4444; background: #fef2f2; }

                .member-dropdown {
                    position: absolute; z-index: 30; top: 100%; left: 0; right: 0;
                    margin-top: 4px; background: white; border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md, 8px); box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    max-height: 200px; overflow-y: auto;
                }
                .member-dropdown-item {
                    width: 100%; padding: 0.6rem 0.75rem; display: flex; align-items: center;
                    gap: 0.6rem; border: none; background: none; cursor: pointer; text-align: left;
                }
                .member-dropdown-item:hover { background: var(--color-gray-50, #f9fafb); }
                .member-dropdown-avatar {
                    width: 32px; height: 32px; border-radius: 50%; overflow: hidden;
                    background: var(--color-gray-200); display: flex; align-items: center;
                    justify-content: center; flex-shrink: 0;
                }
                .member-dropdown-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .member-dropdown-avatar span { font-size: 0.75rem; font-weight: 600; color: var(--color-gray-500); }

                /* Custom Sections */
                .custom-section-entry {
                    padding: 1.25rem; margin-bottom: 1rem;
                    background: var(--color-gray-50, #f9fafb);
                    border: 1px solid var(--color-gray-200);
                    border-radius: 10px;
                }
                .custom-section-header {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 0.75rem;
                }
                .custom-section-num {
                    font-size: 0.78rem; font-weight: 600; text-transform: uppercase;
                    letter-spacing: 0.05em; color: var(--color-gray-400);
                }

                /* Add buttons */
                .add-btn {
                    display: inline-flex; align-items: center; gap: 0.4rem;
                    padding: 0.6rem 1.25rem; border-radius: 8px;
                    border: 2px dashed var(--color-gray-300); background: none;
                    color: var(--color-primary); font-weight: 600; font-size: 0.88rem;
                    cursor: pointer; transition: all 0.15s;
                }
                .add-btn:hover { border-color: var(--color-primary); background: #f0f7ff; }

                /* Deck */
                .deck-upload-area {
                    border: 2px dashed var(--color-gray-300);
                    border-radius: var(--radius-lg, 12px); padding: 1.5rem;
                    text-align: center; cursor: pointer; transition: all 0.2s;
                    background: var(--color-gray-50, #f9fafb);
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                }
                .deck-upload-area:hover { border-color: var(--color-primary); background: #FFFBF5; }

                .deck-file-display {
                    display: flex; align-items: center; gap: 0.75rem;
                    padding: 0.75rem 1rem; background: var(--color-gray-50, #f9fafb);
                    border: 1px solid var(--color-gray-200); border-radius: var(--radius-md, 8px);
                }
                .deck-name { font-weight: 500; flex: 1; }
                .deck-size { color: var(--color-gray-400); font-size: 0.85rem; }
                .deck-remove {
                    padding: 4px; border-radius: 4px; color: var(--color-gray-400);
                    cursor: pointer; background: none; border: none;
                }
                .deck-remove:hover { color: var(--color-error, #EF4444); background: var(--color-gray-100); }
                .deck-replace-btn {
                    padding: 4px 12px; border-radius: var(--radius-md, 8px);
                    font-size: 0.8rem; font-weight: 600; color: var(--color-primary);
                    background: white; border: 1px solid var(--color-gray-200); cursor: pointer;
                }
                .deck-replace-btn:hover { background: var(--color-gray-50, #f9fafb); }

                .bottom-actions {
                    display: flex; justify-content: flex-end; gap: 1rem; margin-top: 0.5rem;
                }

                @media (max-width: 768px) {
                    .form-row { grid-template-columns: 1fr; gap: 0.5rem; }
                    .form-label { text-align: left; padding-top: 0; }
                    .cover-banner { height: 180px; flex-direction: column; align-items: stretch; }
                    .banner-actions-left, .banner-actions-right { justify-content: center; }
                    .team-entry { flex-direction: column; align-items: center; }
                }

                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default NewProject;

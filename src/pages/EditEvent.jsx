import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Upload, Calendar, MapPin, Clock, Users, Globe, Tag, ShieldCheck,
    Eye, Lock, EyeOff, Ticket, Award, UserCheck, AlertCircle, Loader2, Plus, Trash2, Camera, Save, X, Link as LinkIcon
} from 'lucide-react';
import { eventsApi, uploadApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MemberSearchSelect from '../components/MemberSearchSelect';
import TagInput from '../components/TagInput';
import { getAssetUrl } from '../utils/assets';

const VISIBILITY_OPTIONS = [
    { value: 'PUBLIC', label: 'Public', icon: <Globe size={15} />, desc: 'Visible to everyone on BIES' },
    { value: 'LIMITED_SPACES', label: 'Limited Spaces', icon: <Users size={15} />, desc: 'Public listing — capacity is limited' },
    { value: 'INVITE_ONLY', label: 'Invite Only', icon: <UserCheck size={15} />, desc: 'Listed publicly but RSVPs require an invite' },
    { value: 'PRIVATE', label: 'Private', icon: <Lock size={15} />, desc: 'Hidden from public — share via messages or guestlist' },
    { value: 'DRAFT', label: 'Draft', icon: <EyeOff size={15} />, desc: 'Saved as draft — only you can see it' },
];

const CATEGORIES = ['NETWORKING', 'CONFERENCE', 'WORKSHOP', 'HACKATHON', 'MEETUP', 'DEMO_DAY', 'OTHER'];

const toLocalDate = (iso) => {
    if (!iso) return '';
    return iso.substring(0, 10);
};

const toLocalTime = (iso) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toTimeString().substring(0, 5);
    } catch { return ''; }
};

const normalizeGuestList = (arr) => {
    if (!arr || !Array.isArray(arr)) return [];
    return arr.filter(g => g && g.name);
};

const EditEvent = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [form, setForm] = useState({
        title: '',
        category: '',
        description: '',
        locationName: '',
        locationAddress: '',
        locationMapUrl: '',
        isOnline: false,
        onlineUrl: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        maxAttendees: '',
        thumbnail: null,
        ticketUrl: '',
        visibility: 'PUBLIC',
        isOfficial: false,
        endorsementRequested: false,
        guestList: [],
        customSections: [],
    });
    const [tags, setTags] = useState([]);

    useEffect(() => {
        const load = async () => {
            setPageLoading(true);
            try {
                const event = await eventsApi.get(id);

                // Parse location
                let locName = event.locationName || '';
                let locAddr = event.locationAddress || '';
                if (!locName && event.location) {
                    const parts = event.location.split(', ');
                    locName = parts[0] || '';
                    locAddr = parts.slice(1).join(', ') || '';
                }

                setForm({
                    title: event.title || '',
                    category: event.category || '',
                    description: event.description || '',
                    locationName: locName,
                    locationAddress: locAddr,
                    locationMapUrl: event.locationMapUrl || '',
                    isOnline: event.isOnline || false,
                    onlineUrl: event.onlineUrl || '',
                    startDate: toLocalDate(event.startDate),
                    startTime: toLocalTime(event.startDate),
                    endDate: toLocalDate(event.endDate),
                    endTime: toLocalTime(event.endDate),
                    maxAttendees: event.maxAttendees ? String(event.maxAttendees) : '',
                    thumbnail: event.thumbnail || null,
                    ticketUrl: event.ticketUrl || '',
                    visibility: event.visibility || 'PUBLIC',
                    isOfficial: event.isOfficial || false,
                    endorsementRequested: event.endorsementRequested || false,
                    guestList: normalizeGuestList(event.guestList),
                    customSections: Array.isArray(event.customSections) ? event.customSections.map(s => ({ title: s.title, body: s.content || s.body })) : [],
                });
                setTags(Array.isArray(event.tags) ? event.tags : []);
            } catch (err) {
                console.error('Load error:', err);
                setSubmitError('Failed to load event.');
            } finally {
                setPageLoading(false);
            }
        };
        load();
    }, [id]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadLoading(true);
        setSubmitError('');

        try {
            const result = await uploadApi.media(file);
            setForm(prev => ({ ...prev, thumbnail: result.url }));
        } catch (err) {
            console.error('Upload error:', err);
            setSubmitError(err.message || 'Failed to upload image. Please try again.');
        } finally {
            setUploadLoading(false);
            if (e.target) e.target.value = '';
        }
    };

    const clearImage = () => {
        setForm(prev => ({ ...prev, thumbnail: null }));
    };

    const addSection = () => {
        setForm(prev => ({ ...prev, customSections: [...(prev.customSections || []), { title: '', body: '' }] }));
    };

    const updateSection = (index, field, value) => {
        setForm(prev => {
            const newSections = [...(prev.customSections || [])];
            newSections[index] = { ...newSections[index], [field]: value };
            return { ...prev, customSections: newSections };
        });
    };

    const removeSection = (index) => {
        setForm(prev => {
            const newSections = prev.customSections.filter((_, i) => i !== index);
            return { ...prev, customSections: newSections };
        });
    };

    const buildPayload = () => {
        if (!form.startDate) throw new Error('Start date is required');
        const startDate = new Date(`${form.startDate}T${form.startTime || '00:00'}:00`).toISOString();
        const endDate = form.endDate
            ? new Date(`${form.endDate}T${form.endTime || '23:59'}:00`).toISOString()
            : undefined;

        return {
            title: form.title,
            category: form.category,
            description: form.description,
            location: [form.locationName, form.locationAddress].filter(Boolean).join(', '),
            locationName: form.locationName,
            locationAddress: form.locationAddress,
            locationMapUrl: form.locationMapUrl || undefined,
            isOnline: form.isOnline,
            onlineUrl: form.onlineUrl || undefined,
            startDate,
            endDate,
            maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees) : undefined,
            thumbnail: form.thumbnail || undefined,
            ticketUrl: form.ticketUrl || undefined,
            tags: tags,
            visibility: form.visibility,
            isOfficial: form.isOfficial,
            endorsementRequested: form.endorsementRequested,
            guestList: form.guestList,
            customSections: (form.customSections || []).map(s => ({ title: s.title, content: s.body })),
        };
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setSubmitError('');
        try {
            await eventsApi.update(id, buildPayload());
            navigate('/events/my');
        } catch (err) {
            console.error('Update error:', err);
            if (err.data?.details && Array.isArray(err.data.details)) {
                const details = err.data.details.map(d => `${d.field}: ${d.message}`).join(', ');
                setSubmitError(`${err.message}: ${details}`);
            } else {
                setSubmitError(err.message || 'Failed to update event');
            }
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    const needsGuestList = form.visibility === 'PRIVATE' || form.visibility === 'INVITE_ONLY';
    const isNonOfficialCommunity = !form.isOfficial;
    const isBusy = loading || uploadLoading;

    return (
        <div className="create-event-page">
            <div className="container">
                <button onClick={() => navigate(-1)} className="back-link">
                    <ArrowLeft size={16} /> Back
                </button>
                <h1 className="h1-title">Edit Event</h1>
                <p className="subtitle">Update your event details and community information.</p>

                {submitError && (
                    <div className="error-banner">
                        <AlertCircle size={16} /> {submitError}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-container">
                        {/* Cover Image Banner Card */}
                        <div className="profile-card banner-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
                            <div className="cover-banner" style={{
                                backgroundImage: form.thumbnail ? `url(${getAssetUrl(form.thumbnail)})` : 'none',
                            }}>
                                {uploadLoading && (
                                    <div className="upload-overlay">
                                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'white' }} />
                                        <span style={{ color: 'white', fontWeight: 600, marginTop: '0.5rem' }}>Uploading...</span>
                                    </div>
                                )}
                                <div className="banner-actions-left">
                                    <label className="banner-btn" style={{ cursor: uploadLoading ? 'not-allowed' : 'pointer' }}>
                                        {uploadLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={16} />}
                                        {form.thumbnail ? 'Change Cover' : 'Add Cover Image'}
                                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploadLoading} />
                                    </label>
                                    {form.thumbnail && !uploadLoading && (
                                        <button type="button" className="banner-btn danger" onClick={clearImage}>
                                            <X size={16} /> Remove
                                        </button>
                                    )}
                                </div>
                                <div className="banner-actions-right">
                                    <button type="submit" disabled={isBusy} className="save-btn">
                                        {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="profile-card main-form-card">
                            <div className="section-inner">
                                {/* Title */}
                                <div className="form-group">
                                    <label htmlFor="title"><Calendar size={16} /> Event Title</label>
                                    <input type="text" id="title" name="title" value={form.title} onChange={handleChange}
                                        placeholder="e.g. Lightning Network Workshop" required />
                                </div>

                                {/* Category */}
                                <div className="form-group">
                                    <label htmlFor="category"><Tag size={16} /> Category</label>
                                    <select id="category" name="category" value={form.category} onChange={handleChange} required>
                                        <option value="">Select a category</option>
                                        {CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>
                                                {cat.replace(/_/g, ' ').charAt(0) + cat.replace(/_/g, ' ').slice(1).toLowerCase()}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Description */}
                                <div className="form-group">
                                    <label htmlFor="description">Description</label>
                                    <textarea id="description" name="description" value={form.description} onChange={handleChange}
                                        placeholder="Describe your event, what attendees can expect, and any requirements…"
                                        rows={5} required />
                                </div>

                                {/* Additional Sections */}
                                <div className="additional-sections-area" style={{ marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <label style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Additional Sections</label>
                                    </div>
                                    <p className="help-text" style={{ marginBottom: '1rem', marginTop: '-0.5rem' }}>Add extra info about your event — schedule, speakers, FAQ, or anything relevant.</p>

                                    {(form.customSections || []).map((section, idx) => (
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

                                {/* Dates */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="startDate"><Calendar size={16} /> Start Date</label>
                                        <input type="date" id="startDate" name="startDate" value={form.startDate} onChange={handleChange} required />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="startTime"><Clock size={16} /> Start Time</label>
                                        <input type="time" id="startTime" name="startTime" value={form.startTime} onChange={handleChange} required />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="endDate">End Date (optional)</label>
                                        <input type="date" id="endDate" name="endDate" value={form.endDate} onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="endTime">End Time (optional)</label>
                                        <input type="time" id="endTime" name="endTime" value={form.endTime} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Location */}
                                <div className="form-group">
                                    <label><MapPin size={16} /> Location Name</label>
                                    <input type="text" name="locationName" value={form.locationName} onChange={handleChange}
                                        placeholder="e.g. Bitcoin Embassy" required={!form.isOnline} />
                                </div>
                                <div className="form-group">
                                    <label><MapPin size={16} style={{ opacity: 0 }} /> Location Address</label>
                                    <input type="text" name="locationAddress" value={form.locationAddress} onChange={handleChange}
                                        placeholder="e.g. Paseo General Escalón, San Salvador, El Salvador" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="locationMapUrl"><LinkIcon size={16} /> Google Maps Link (optional)</label>
                                    <input type="url" id="locationMapUrl" name="locationMapUrl" value={form.locationMapUrl} onChange={handleChange}
                                        placeholder="https://maps.google.com/…" />
                                </div>

                                {/* Online Toggle */}
                                <div className="form-group checkbox-group">
                                    <label className="checkbox-label">
                                        <input type="checkbox" name="isOnline" checked={form.isOnline} onChange={handleChange} />
                                        <Globe size={16} /> This event is online or has a virtual option
                                    </label>
                                </div>
                                {form.isOnline && (
                                    <div className="form-group">
                                        <label htmlFor="onlineUrl">Online URL</label>
                                        <input type="url" id="onlineUrl" name="onlineUrl" value={form.onlineUrl} onChange={handleChange}
                                            placeholder="https://meet.google.com/…" />
                                    </div>
                                )}

                                {/* Ticket URL */}
                                <div className="form-group">
                                    <label htmlFor="ticketUrl"><Ticket size={16} /> Ticket / Registration Link (optional)</label>
                                    <input type="url" id="ticketUrl" name="ticketUrl" value={form.ticketUrl} onChange={handleChange}
                                        placeholder="https://lu.ma/your-event or https://satlantis.io/…" />
                                </div>

                                {/* Max Attendees */}
                                <div className="form-group">
                                    <label htmlFor="maxAttendees"><Users size={16} /> Max Attendees (optional)</label>
                                    <input type="number" id="maxAttendees" name="maxAttendees" value={form.maxAttendees} onChange={handleChange}
                                        placeholder="Leave blank for unlimited" min="1" />
                                </div>

                                {/* Tags */}
                                <div className="form-group">
                                    <label><Tag size={16} /> Tags</label>
                                    <TagInput tags={tags} onChange={setTags} />
                                    <p className="help-text">Press Enter or comma to add a tag.</p>
                                </div>

                                {/* Visibility */}
                                <div className="form-group">
                                    <label><Eye size={16} /> Visibility</label>
                                    <div className="visibility-options">
                                        {VISIBILITY_OPTIONS.map(opt => (
                                            <label key={opt.value} className={`visibility-option ${form.visibility === opt.value ? 'selected' : ''}`}>
                                                <input type="radio" name="visibility" value={opt.value} checked={form.visibility === opt.value} onChange={handleChange} />
                                                <span className="vis-icon">{opt.icon}</span>
                                                <span className="vis-content">
                                                    <span className="vis-label">{opt.label}</span>
                                                    <span className="vis-desc">{opt.desc}</span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Guest List */}
                                {needsGuestList && (
                                    <div className="form-group">
                                        <label><UserCheck size={16} /> Guest List</label>
                                        <MemberSearchSelect
                                            value={form.guestList}
                                            onChange={(list) => setForm(prev => ({ ...prev, guestList: list }))}
                                        />
                                        <p className="help-text" style={{ marginTop: '0.5rem' }}>
                                            Search and add BIES members. You can also share the event link privately via Messages.
                                        </p>
                                    </div>
                                )}

                                {/* Official (Admin Only) */}
                                {user?.role === 'ADMIN' && (
                                    <div className="form-group checkbox-group official-toggle">
                                        <label className="checkbox-label">
                                            <input type="checkbox" name="isOfficial" checked={form.isOfficial} onChange={handleChange} />
                                            <ShieldCheck size={16} className="text-secondary" />
                                            <span style={{ fontWeight: 700, color: 'var(--color-gray-900)' }}>Official Build in El Salvador Event</span>
                                        </label>
                                        <p className="help-text">Official events appear prominently at the top of the events page.</p>
                                    </div>
                                )}

                                {/* Endorsement Request */}
                                {isNonOfficialCommunity && form.visibility !== 'DRAFT' && form.visibility !== 'PRIVATE' && (
                                    <div className="form-group checkbox-group endorsement-toggle">
                                        <label className="checkbox-label">
                                            <input type="checkbox" name="endorsementRequested" checked={form.endorsementRequested} onChange={handleChange} />
                                            <Award size={22} style={{ color: '#d97706' }} />
                                            <span style={{ fontWeight: 600, color: 'var(--color-gray-900)' }}>Request BIES Endorsement</span>
                                        </label>
                                        <p className="help-text">Ask Build in El Salvador to review and endorse your community event. Endorsed events receive a badge and increased visibility.</p>
                                    </div>
                                )}

                                {/* Bottom Save Button */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-gray-200)' }}>
                                    <button type="submit" disabled={isBusy} className="save-btn" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
                                        {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <style jsx>{`
                .create-event-page { background: var(--color-gray-50); min-height: 100vh; padding-bottom: 4rem; }
                .container { max-width: 720px; margin: 0 auto; padding: 0 1rem; }
                .back-link {
                    display: inline-flex; align-items: center; gap: 0.5rem;
                    color: var(--color-gray-500); font-size: 0.9rem; font-weight: 500;
                    margin: 1.5rem 0; background: none; border: none; cursor: pointer; padding: 0;
                    transition: color 0.2s;
                }
                .back-link:hover { color: var(--color-gray-900); }
                .h1-title { font-size: 2rem; font-weight: 800; margin-bottom: 0.25rem; color: var(--color-gray-900); }
                .subtitle { color: var(--color-gray-500); margin-bottom: 2rem; }
                .error-banner {
                    display: flex; align-items: center; gap: 0.5rem;
                    padding: 0.75rem 1rem; background: #FEF2F2; color: #B91C1C;
                    border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem;
                }
                .profile-card {
                    background: white; border-radius: var(--radius-xl, 16px);
                    box-shadow: var(--shadow-sm); border: 1px solid var(--color-gray-200);
                }
                .section-inner { padding: 2rem; }
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
                .banner-actions-left, .banner-actions-right { position: relative; z-index: 20; display: flex; gap: 0.5rem; }
                .banner-btn {
                    display: flex; align-items: center; gap: 0.4rem;
                    background: white; color: #1f2937;
                    border-radius: 8px; height: 38px; padding: 0 16px;
                    font-weight: 600; font-size: 0.85rem; border: none; cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15); white-space: nowrap;
                }
                .banner-btn:hover { opacity: 0.9; }
                .banner-btn.danger { color: #EF4444; }
                .save-btn {
                    display: inline-flex; align-items: center; gap: 0.5rem;
                    background: var(--color-primary, #0052cc); color: white; border: none;
                    border-radius: 8px; height: 44px; padding: 0 24px;
                    font-weight: 700; font-size: 1rem; cursor: pointer; white-space: nowrap;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                }
                .save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
                .form-group { margin-bottom: 2rem; }
                .form-group label {
                    display: flex; align-items: center; gap: 0.5rem;
                    margin-bottom: 0.75rem; color: var(--color-gray-700);
                    font-weight: 700; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.025em;
                }
                .form-group input, .form-group select, .form-group textarea, .input-field {
                    width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--color-gray-200);
                    border-radius: 8px; font-size: 0.95rem; color: var(--color-gray-900);
                    background: var(--color-gray-50); transition: all 0.2s; box-sizing: border-box;
                }
                .form-group input:focus, .form-group select:focus, .form-group textarea:focus, .input-field:focus {
                    outline: none; border-color: var(--color-secondary); box-shadow: 0 0 0 3px rgba(255,91,0,0.1); background: white;
                }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .help-text { font-size: 0.75rem; color: var(--color-gray-500); margin-top: 0.35rem; }
                .custom-section-entry { background: #f8fafc; border: 1px solid var(--color-gray-200); border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
                .custom-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
                .custom-section-num { font-size: 0.8rem; font-weight: 600; color: var(--color-gray-500); text-transform: uppercase; }
                .team-remove { background: none; border: none; color: var(--color-gray-400); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 4px; transition: all 0.2s; }
                .team-remove:hover { color: #ef4444; background: #fee2e2; }
                .add-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.75rem; background: white; border: 2px dashed var(--color-gray-200); border-radius: 8px; color: var(--color-secondary); font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .add-btn:hover { border-color: var(--color-secondary); background: #fff7ed; }
                .visibility-options { display: flex; flex-direction: column; gap: 0.5rem; }
                .visibility-option { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border: 1px solid var(--color-gray-200); border-radius: 8px; cursor: pointer; transition: all 0.15s; background: var(--color-gray-50); }
                .visibility-option:hover { border-color: var(--color-secondary); background: #fff7ed; }
                .visibility-option.selected { border-color: var(--color-secondary); background: #fff7ed; }
                .visibility-option input[type="radio"] { display: none; }
                .vis-icon { color: var(--color-gray-500); flex-shrink: 0; }
                .visibility-option.selected .vis-icon { color: var(--color-secondary); }
                .vis-content { display: flex; flex-direction: column; }
                .vis-label { font-size: 0.9rem; font-weight: 600; color: var(--color-gray-900); }
                .vis-desc { font-size: 0.78rem; color: var(--color-gray-500); }
                .checkbox-group { display: flex; align-items: center; gap: 0.5rem; }
                .checkbox-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500; color: var(--color-gray-600); }
                .checkbox-label input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--color-secondary); }
                .official-toggle { background: #fff7ed; padding: 1rem; border-radius: 8px; border: 1px solid #fed7aa; }
                .endorsement-toggle { background: #fffbeb; padding: 1rem; border-radius: 8px; border: 1px solid #fde68a; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (max-width: 640px) {
                    .form-row { grid-template-columns: 1fr; }
                    .h1-title { font-size: 1.5rem; }
                    .cover-banner { height: 160px; }
                }
            `}</style>
        </div>
    );
};

export default EditEvent;

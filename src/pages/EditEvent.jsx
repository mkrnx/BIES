import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Upload, Calendar, MapPin, Clock, Users, Globe, Tag, ShieldCheck,
    Eye, Lock, EyeOff, Ticket, Award, UserCheck, AlertCircle, Loader2,
} from 'lucide-react';
import { eventsApi, uploadApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MemberSearchSelect from '../components/MemberSearchSelect';

const VISIBILITY_OPTIONS = [
    { value: 'PUBLIC', label: 'Public', icon: <Globe size={15} />, desc: 'Visible to everyone on BIES' },
    { value: 'LIMITED_SPACES', label: 'Limited Spaces', icon: <Users size={15} />, desc: 'Public listing — capacity is limited' },
    { value: 'INVITE_ONLY', label: 'Invite Only', icon: <UserCheck size={15} />, desc: 'Listed publicly but RSVPs require an invite' },
    { value: 'PRIVATE', label: 'Private', icon: <Lock size={15} />, desc: 'Hidden from public — share via messages or guestlist' },
    { value: 'DRAFT', label: 'Draft', icon: <EyeOff size={15} />, desc: 'Saved as draft — only you can see it' },
];

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
    const [fetchLoading, setFetchLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [form, setForm] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const event = await eventsApi.get(id);
                setForm({
                    title: event.title || '',
                    category: event.category || '',
                    description: event.description || '',
                    location: event.location || '',
                    isOnline: event.isOnline || false,
                    onlineUrl: event.onlineUrl || '',
                    startDate: toLocalDate(event.startDate),
                    startTime: toLocalTime(event.startDate),
                    endDate: toLocalDate(event.endDate),
                    endTime: toLocalTime(event.endDate),
                    maxAttendees: event.maxAttendees ? String(event.maxAttendees) : '',
                    thumbnail: event.thumbnail || null,
                    ticketUrl: event.ticketUrl || '',
                    tags: Array.isArray(event.tags) ? event.tags.join(', ') : '',
                    visibility: event.visibility || 'PUBLIC',
                    isOfficial: event.isOfficial || false,
                    endorsementRequested: event.endorsementRequested || false,
                    guestList: normalizeGuestList(event.guestList),
                });
            } catch {
                setSubmitError('Failed to load event.');
            } finally {
                setFetchLoading(false);
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
        try {
            const result = await uploadApi.media(file);
            setForm(prev => ({ ...prev, thumbnail: result.url || result.path }));
        } catch {
            setSubmitError('Failed to upload image');
        }
    };

    const buildPayload = () => {
        if (!form.startDate) throw new Error('Start date is required');
        const time = form.startTime || '00:00';
        const startDate = new Date(`${form.startDate}T${time}:00`).toISOString();
        const endDate = form.endDate
            ? new Date(`${form.endDate}T${form.endTime || '23:59'}:00`).toISOString()
            : undefined;

        const guestListArray = form.guestList || [];

        return {
            title: form.title,
            category: form.category,
            description: form.description,
            location: form.location,
            isOnline: form.isOnline,
            onlineUrl: form.onlineUrl || undefined,
            startDate,
            endDate,
            maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees) : undefined,
            thumbnail: form.thumbnail || undefined,
            ticketUrl: form.ticketUrl || undefined,
            tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            visibility: form.visibility,
            isOfficial: form.isOfficial,
            endorsementRequested: form.endorsementRequested,
            guestList: guestListArray,
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSubmitError('');
        try {
            await eventsApi.update(id, buildPayload());
            navigate('/events/my');
        } catch (err) {
            setSubmitError(err.message || 'Failed to update event');
        } finally {
            setLoading(false);
        }
    };

    const categories = ['NETWORKING', 'CONFERENCE', 'WORKSHOP', 'HACKATHON', 'MEETUP', 'DEMO_DAY', 'OTHER'];

    if (fetchLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (!form) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
                {submitError || 'Event not found.'}
            </div>
        );
    }

    const needsGuestList = form.visibility === 'PRIVATE' || form.visibility === 'INVITE_ONLY';
    const isNonOfficialCommunity = !form.isOfficial;

    return (
        <div className="create-event-page">
            <div className="container">
                <button onClick={() => navigate(-1)} className="back-link">
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="form-card">
                    <h1>Edit Event</h1>
                    <p className="subtitle">Update your event details</p>

                    <form onSubmit={handleSubmit}>
                        {submitError && (
                            <div className="error-banner">
                                <AlertCircle size={16} /> {submitError}
                            </div>
                        )}

                        {/* Cover Image */}
                        <div className="form-group">
                            <label>Cover Image</label>
                            {form.thumbnail ? (
                                <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                                    <img src={form.thumbnail} alt="Cover" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '12px' }} />
                                    <button type="button" onClick={() => setForm(prev => ({ ...prev, thumbnail: null }))}
                                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                                        &times;
                                    </button>
                                </div>
                            ) : (
                                <label className="upload-area" style={{ cursor: 'pointer' }}>
                                    <Upload size={24} />
                                    <span>Click to upload</span>
                                    <span className="upload-hint">Recommended: 1200 x 600px</span>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                                </label>
                            )}
                        </div>

                        {/* Title */}
                        <div className="form-group">
                            <label htmlFor="title"><Calendar size={16} /> Event Title</label>
                            <input type="text" id="title" name="title" value={form.title} onChange={handleChange} placeholder="e.g. Lightning Network Workshop" required />
                        </div>

                        {/* Category */}
                        <div className="form-group">
                            <label htmlFor="category"><Tag size={16} /> Category</label>
                            <select id="category" name="category" value={form.category} onChange={handleChange} required>
                                <option value="">Select a category</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>
                                        {cat.replace(/_/g, ' ').charAt(0) + cat.replace(/_/g, ' ').slice(1).toLowerCase()}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Description */}
                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea id="description" name="description" value={form.description} onChange={handleChange} placeholder="Describe your event..." rows={5} required />
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
                            <label htmlFor="location"><MapPin size={16} /> Location</label>
                            <input type="text" id="location" name="location" value={form.location} onChange={handleChange} placeholder="e.g. Bitcoin Embassy, San Salvador" required />
                        </div>

                        {/* Online */}
                        <div className="form-group checkbox-group">
                            <label className="checkbox-label">
                                <input type="checkbox" name="isOnline" checked={form.isOnline} onChange={handleChange} />
                                <Globe size={16} /> This event is online or has a virtual option
                            </label>
                        </div>
                        {form.isOnline && (
                            <div className="form-group">
                                <label htmlFor="onlineUrl">Online URL</label>
                                <input type="url" id="onlineUrl" name="onlineUrl" value={form.onlineUrl} onChange={handleChange} placeholder="https://meet.google.com/..." />
                            </div>
                        )}

                        {/* Ticket URL */}
                        <div className="form-group">
                            <label htmlFor="ticketUrl"><Ticket size={16} /> Ticket / Registration Link (optional)</label>
                            <input type="url" id="ticketUrl" name="ticketUrl" value={form.ticketUrl} onChange={handleChange} placeholder="https://lu.ma/your-event or https://satlantis.io/..." />
                        </div>

                        {/* Max Attendees */}
                        <div className="form-group">
                            <label htmlFor="maxAttendees"><Users size={16} /> Max Attendees (optional)</label>
                            <input type="number" id="maxAttendees" name="maxAttendees" value={form.maxAttendees} onChange={handleChange} placeholder="Leave blank for unlimited" min="1" />
                        </div>

                        {/* Tags */}
                        <div className="form-group">
                            <label htmlFor="tags"><Tag size={16} /> Tags</label>
                            <input type="text" id="tags" name="tags" value={form.tags} onChange={handleChange} placeholder="e.g. Bitcoin, Lightning, Workshop (comma-separated)" />
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

                        {/* Official Event Toggle (Admin Only) */}
                        {user?.role === 'ADMIN' && (
                            <div className="form-group checkbox-group official-toggle">
                                <label className="checkbox-label">
                                    <input type="checkbox" name="isOfficial" checked={form.isOfficial} onChange={handleChange} />
                                    <ShieldCheck size={16} />
                                    <span style={{ fontWeight: 700 }}>Official Build in El Salvador Event</span>
                                </label>
                                <p className="help-text">Official events appear prominently at the top of the events page.</p>
                            </div>
                        )}

                        {/* Endorsement Request */}
                        {isNonOfficialCommunity && form.visibility !== 'DRAFT' && form.visibility !== 'PRIVATE' && (
                            <div className="form-group checkbox-group endorsement-toggle">
                                <label className="checkbox-label">
                                    <input type="checkbox" name="endorsementRequested" checked={form.endorsementRequested} onChange={handleChange} />
                                    <Award size={16} style={{ color: '#d97706' }} />
                                    <span style={{ fontWeight: 600 }}>Request BIES Endorsement</span>
                                </label>
                                <p className="help-text">Ask Build in El Salvador to review and endorse your community event.</p>
                            </div>
                        )}

                        <div className="form-actions">
                            <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
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
                .form-card { background: white; border-radius: var(--radius-xl); padding: 2.5rem; box-shadow: var(--shadow-md); border: 1px solid var(--color-gray-200); }
                .form-card h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.25rem; }
                .subtitle { color: var(--color-gray-500); margin-bottom: 2rem; }
                .error-banner { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: #FEF2F2; color: #B91C1C; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
                .form-group { margin-bottom: 1.5rem; }
                .form-group label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; font-weight: 600; color: var(--color-gray-700); margin-bottom: 0.5rem; }
                .form-group input[type="text"],
                .form-group input[type="url"],
                .form-group input[type="number"],
                .form-group input[type="date"],
                .form-group input[type="time"],
                .form-group select,
                .form-group textarea {
                    width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md); font-size: 0.95rem; color: var(--color-gray-900);
                    background: var(--color-gray-50); transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box;
                }
                .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
                    outline: none; border-color: var(--color-secondary); box-shadow: 0 0 0 3px rgba(255,91,0,0.1);
                }
                .form-group textarea { resize: vertical; }
                .help-text { font-size: 0.75rem; color: var(--color-gray-500); margin-top: 0.35rem; }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .upload-area {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    gap: 0.5rem; padding: 2rem; border: 2px dashed var(--color-gray-200);
                    border-radius: var(--radius-lg); color: var(--color-gray-400); cursor: pointer;
                    transition: border-color 0.2s, background 0.2s;
                }
                .upload-area:hover { border-color: var(--color-secondary); background: #fff7ed; }
                .upload-hint { font-size: 0.75rem; color: var(--color-gray-400); }
                .visibility-options { display: flex; flex-direction: column; gap: 0.5rem; }
                .visibility-option {
                    display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
                    border: 1px solid var(--color-gray-200); border-radius: var(--radius-md);
                    cursor: pointer; transition: all 0.15s; background: var(--color-gray-50);
                    margin-bottom: 0; font-weight: normal; color: var(--color-gray-700);
                }
                .visibility-option:hover { border-color: var(--color-secondary); background: #fff7ed; }
                .visibility-option.selected { border-color: var(--color-secondary); background: #fff7ed; }
                .visibility-option input[type="radio"] { display: none; }
                .vis-icon { color: var(--color-gray-500); flex-shrink: 0; }
                .visibility-option.selected .vis-icon { color: var(--color-secondary); }
                .vis-content { display: flex; flex-direction: column; gap: 1px; }
                .vis-label { font-size: 0.9rem; font-weight: 600; color: var(--color-gray-900); }
                .vis-desc { font-size: 0.78rem; color: var(--color-gray-500); }
                .checkbox-group { margin-bottom: 1rem; }
                .checkbox-label { display: flex !important; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500 !important; color: var(--color-gray-600) !important; }
                .checkbox-label input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--color-secondary); }
                .official-toggle { background: #fff7ed; padding: 1rem; border-radius: var(--radius-md); border: 1px solid #fed7aa; margin-bottom: 1rem; }
                .official-toggle .help-text { margin-left: 1.65rem; margin-top: 0.25rem; }
                .endorsement-toggle { background: #fffbeb; padding: 1rem; border-radius: var(--radius-md); border: 1px solid #fde68a; margin-bottom: 2rem; }
                .endorsement-toggle .help-text { margin-left: 1.65rem; margin-top: 0.25rem; }
                .form-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem; }
                .btn { padding: 0.75rem 1.5rem; border-radius: var(--radius-md); font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; }
                .btn-primary { background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-dark) 100%); color: white; }
                .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(249,115,22,0.4); }
                .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
                .btn-outline { background: white; color: var(--color-gray-600); border: 1px solid var(--color-gray-200); }
                .btn-outline:hover { background: var(--color-gray-50); }
                @media (max-width: 640px) {
                    .form-card { padding: 1.5rem; }
                    .form-row { grid-template-columns: 1fr; }
                    .form-actions { flex-direction: column-reverse; }
                    .form-actions .btn { width: 100%; text-align: center; }
                }
            `}</style>
        </div>
    );
};

export default EditEvent;

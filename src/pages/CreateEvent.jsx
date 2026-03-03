import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Calendar, MapPin, Clock, Users, Globe, Tag } from 'lucide-react';
import { eventsApi, uploadApi } from '../services/api';

const CreateEvent = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        title: '',
        category: '',
        description: '',
        location: '',
        isOnline: false,
        onlineUrl: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        maxAttendees: '',
        thumbnail: null,
        tags: '',
    });

    const categories = [
        'NETWORKING',
        'CONFERENCE',
        'WORKSHOP',
        'HACKATHON',
        'MEETUP',
        'DEMO_DAY',
        'OTHER',
    ];

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const [submitError, setSubmitError] = useState('');

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSubmitError('');
        try {
            const data = {
                title: form.title,
                category: form.category,
                description: form.description,
                location: form.location,
                isOnline: form.isOnline,
                onlineUrl: form.onlineUrl || undefined,
                startDate: form.startDate,
                startTime: form.startTime,
                endDate: form.endDate || undefined,
                endTime: form.endTime || undefined,
                maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees) : undefined,
                image: form.thumbnail || undefined,
                tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            };
            await eventsApi.create(data);
            navigate('/events');
        } catch (err) {
            setSubmitError(err.message || 'Failed to create event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-event-page">
            <div className="container">
                <button onClick={() => navigate(-1)} className="back-link">
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="form-card">
                    <h1>Create Event</h1>
                    <p className="subtitle">Host an event for the BIES community</p>

                    <form onSubmit={handleSubmit}>
                        {submitError && (
                            <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', color: '#B91C1C', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                {submitError}
                            </div>
                        )}

                        {/* Thumbnail Upload */}
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
                            <label htmlFor="title">
                                <Calendar size={16} /> Event Title
                            </label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={form.title}
                                onChange={handleChange}
                                placeholder="e.g. Lightning Network Workshop"
                                required
                            />
                        </div>

                        {/* Category */}
                        <div className="form-group">
                            <label htmlFor="category">
                                <Tag size={16} /> Category
                            </label>
                            <select
                                id="category"
                                name="category"
                                value={form.category}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select a category</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>
                                        {cat.replace('_', ' ').charAt(0) + cat.replace('_', ' ').slice(1).toLowerCase()}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Description */}
                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                placeholder="Describe your event, what attendees can expect, and any requirements..."
                                rows={5}
                                required
                            />
                        </div>

                        {/* Date & Time Row */}
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="startDate">
                                    <Calendar size={16} /> Start Date
                                </label>
                                <input
                                    type="date"
                                    id="startDate"
                                    name="startDate"
                                    value={form.startDate}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="startTime">
                                    <Clock size={16} /> Start Time
                                </label>
                                <input
                                    type="time"
                                    id="startTime"
                                    name="startTime"
                                    value={form.startTime}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="endDate">End Date (optional)</label>
                                <input
                                    type="date"
                                    id="endDate"
                                    name="endDate"
                                    value={form.endDate}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="endTime">End Time (optional)</label>
                                <input
                                    type="time"
                                    id="endTime"
                                    name="endTime"
                                    value={form.endTime}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="form-group">
                            <label htmlFor="location">
                                <MapPin size={16} /> Location
                            </label>
                            <input
                                type="text"
                                id="location"
                                name="location"
                                value={form.location}
                                onChange={handleChange}
                                placeholder="e.g. Bitcoin Embassy, San Salvador"
                                required
                            />
                        </div>

                        {/* Online Toggle */}
                        <div className="form-group checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="isOnline"
                                    checked={form.isOnline}
                                    onChange={handleChange}
                                />
                                <Globe size={16} /> This event is online or has a virtual option
                            </label>
                        </div>

                        {form.isOnline && (
                            <div className="form-group">
                                <label htmlFor="onlineUrl">Online URL</label>
                                <input
                                    type="url"
                                    id="onlineUrl"
                                    name="onlineUrl"
                                    value={form.onlineUrl}
                                    onChange={handleChange}
                                    placeholder="https://meet.google.com/..."
                                />
                            </div>
                        )}

                        {/* Max Attendees */}
                        <div className="form-group">
                            <label htmlFor="maxAttendees">
                                <Users size={16} /> Max Attendees (optional)
                            </label>
                            <input
                                type="number"
                                id="maxAttendees"
                                name="maxAttendees"
                                value={form.maxAttendees}
                                onChange={handleChange}
                                placeholder="Leave blank for unlimited"
                                min="1"
                            />
                        </div>

                        {/* Tags */}
                        <div className="form-group">
                            <label htmlFor="tags">
                                <Tag size={16} /> Tags
                            </label>
                            <input
                                type="text"
                                id="tags"
                                name="tags"
                                value={form.tags}
                                onChange={handleChange}
                                placeholder="e.g. Bitcoin, Lightning, Workshop (comma-separated)"
                            />
                        </div>

                        {/* Satlantis Note */}
                        <div className="satlantis-note">
                            <p>
                                Ticket sales are managed through{' '}
                                <a href="https://satlantis.io" target="_blank" rel="noopener noreferrer">
                                    Satlantis.io
                                </a>
                                . After creating your event here, set up ticketing on Satlantis for a seamless attendee experience.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="form-actions">
                            <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Creating...' : 'Create Event'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style jsx>{`
                .create-event-page {
                    background: var(--color-gray-50);
                    min-height: 100vh;
                    padding-bottom: 4rem;
                }
                .container {
                    max-width: 720px;
                    margin: 0 auto;
                    padding: 0 1rem;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--color-gray-500);
                    font-size: 0.9rem;
                    font-weight: 500;
                    margin: 1.5rem 0;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    transition: color 0.2s;
                }
                .back-link:hover { color: var(--color-gray-900); }

                .form-card {
                    background: white;
                    border-radius: var(--radius-xl);
                    padding: 2.5rem;
                    box-shadow: var(--shadow-md);
                    border: 1px solid var(--color-gray-200);
                }

                .form-card h1 {
                    font-size: 1.75rem;
                    font-weight: 800;
                    margin-bottom: 0.25rem;
                }

                .subtitle {
                    color: var(--color-gray-500);
                    margin-bottom: 2rem;
                }

                .form-group {
                    margin-bottom: 1.5rem;
                }

                .form-group label {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-gray-700);
                    margin-bottom: 0.5rem;
                }

                .form-group input[type="text"],
                .form-group input[type="url"],
                .form-group input[type="number"],
                .form-group input[type="date"],
                .form-group input[type="time"],
                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    font-size: 0.95rem;
                    color: var(--color-gray-900);
                    background: var(--color-gray-50);
                    transition: border-color 0.2s, box-shadow 0.2s;
                    box-sizing: border-box;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--color-secondary);
                    box-shadow: 0 0 0 3px rgba(255, 91, 0, 0.1);
                }

                .form-group textarea { resize: vertical; }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .upload-area {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 2rem;
                    border: 2px dashed var(--color-gray-200);
                    border-radius: var(--radius-lg);
                    color: var(--color-gray-400);
                    cursor: pointer;
                    transition: border-color 0.2s, background 0.2s;
                }
                .upload-area:hover {
                    border-color: var(--color-secondary);
                    background: #fff7ed;
                }
                .upload-hint {
                    font-size: 0.75rem;
                    color: var(--color-gray-400);
                }

                .checkbox-group {
                    margin-bottom: 1rem;
                }

                .checkbox-label {
                    display: flex !important;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    font-weight: 500 !important;
                    color: var(--color-gray-600) !important;
                }

                .checkbox-label input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    accent-color: var(--color-secondary);
                }

                .satlantis-note {
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-radius: var(--radius-md);
                    padding: 1rem 1.25rem;
                    margin-bottom: 2rem;
                }

                .satlantis-note p {
                    color: #92400e;
                    font-size: 0.875rem;
                    line-height: 1.5;
                    margin: 0;
                }

                .satlantis-note a {
                    color: var(--color-secondary);
                    font-weight: 600;
                    text-decoration: underline;
                }

                .form-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                }

                .btn {
                    padding: 0.75rem 1.5rem;
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }

                .btn-primary {
                    background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-dark) 100%);
                    color: white;
                }
                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
                }
                .btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .btn-outline {
                    background: white;
                    color: var(--color-gray-600);
                    border: 1px solid var(--color-gray-200);
                }
                .btn-outline:hover {
                    background: var(--color-gray-50);
                    border-color: var(--color-gray-300);
                }

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

export default CreateEvent;

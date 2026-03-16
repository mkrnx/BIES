import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Save, Loader2, BookOpen } from 'lucide-react';

const CATEGORIES = ['Bitcoin', 'Lightning', 'Nostr', 'Fintech', 'Business', 'Technology', 'Other'];
const FORMATS = ['Video', 'Live', 'Text', 'Workshop'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const fieldStyle = {
  width: '100%',
  padding: '0.65rem 0.875rem',
  border: '1px solid var(--color-gray-300)',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.95rem',
  background: 'var(--color-surface)',
  color: 'var(--color-gray-800)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--color-gray-700)',
  marginBottom: '0.4rem',
};

const FormField = ({ label, required, children }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <label style={labelStyle}>
      {label}
      {required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
    </label>
    {children}
  </div>
);

const NewCourse = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    shortDescription: '',
    fullDescription: '',
    category: '',
    format: '',
    duration: '',
    level: '',
    price: '',
    coverImage: '',
    tags: '',
  });

  useEffect(() => {
    if (editId) {
      // Placeholder: load course data when API is connected
      // For now, leave form empty for edit mode too
    }
  }, [editId]);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Course title is required.');
      return;
    }
    setLoading(true);
    setError('');

    // Mock save — no real API yet
    await new Promise(res => setTimeout(res, 600));
    setLoading(false);
    setSuccess(true);

    setTimeout(() => {
      navigate('/dashboard/educator/courses');
    }, 1200);
  };

  const inputFocusHandlers = {
    onFocus: (e) => { e.target.style.borderColor = 'var(--color-primary)'; },
    onBlur: (e) => { e.target.style.borderColor = 'var(--color-gray-300)'; },
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.5rem 0.875rem',
            border: '1px solid var(--color-gray-200)',
            borderRadius: 'var(--radius-md)',
            background: 'none',
            color: 'var(--color-gray-600)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-gray-800)' }}>
            {editId ? 'Edit Course' : 'New Course'}
          </h1>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
            {editId ? 'Update your course details.' : 'Create a new educational course for the BIES community.'}
          </p>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          background: 'var(--badge-success-bg)',
          color: 'var(--badge-success-text)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          fontWeight: 600,
          fontSize: '0.95rem',
        }}>
          <BookOpen size={18} /> Course saved! Redirecting…
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '0.875rem 1.25rem',
          background: 'var(--badge-error-bg)',
          color: 'var(--badge-error-text)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          fontWeight: 500,
          fontSize: '0.9rem',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '1.5rem',
          alignItems: 'start',
        }}>

          {/* Left column — main fields */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-gray-200)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <FormField label="Course Title" required>
              <input
                type="text"
                placeholder="e.g. Bitcoin Fundamentals for Beginners"
                value={form.title}
                onChange={handleChange('title')}
                required
                style={fieldStyle}
                {...inputFocusHandlers}
              />
            </FormField>

            <FormField label="Short Description">
              <textarea
                placeholder="A brief summary of the course (2–3 sentences shown in listings)."
                value={form.shortDescription}
                onChange={handleChange('shortDescription')}
                rows={3}
                style={{ ...fieldStyle, resize: 'vertical' }}
                {...inputFocusHandlers}
              />
            </FormField>

            <FormField label="Full Description / Content">
              <textarea
                placeholder="Describe what students will learn, prerequisites, course outline, etc."
                value={form.fullDescription}
                onChange={handleChange('fullDescription')}
                rows={8}
                style={{ ...fieldStyle, resize: 'vertical' }}
                {...inputFocusHandlers}
              />
            </FormField>

            <FormField label="Tags">
              <input
                type="text"
                placeholder="bitcoin, lightning, beginner (comma-separated)"
                value={form.tags}
                onChange={handleChange('tags')}
                style={fieldStyle}
                {...inputFocusHandlers}
              />
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--color-gray-400)' }}>
                Separate tags with commas.
              </p>
            </FormField>
          </div>

          {/* Right column — metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Course Settings card */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-gray-200)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-gray-700)' }}>
                Course Settings
              </h3>

              <FormField label="Category">
                <select
                  value={form.category}
                  onChange={handleChange('category')}
                  style={fieldStyle}
                  {...inputFocusHandlers}
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>

              <FormField label="Format">
                <select
                  value={form.format}
                  onChange={handleChange('format')}
                  style={fieldStyle}
                  {...inputFocusHandlers}
                >
                  <option value="">Select a format…</option>
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </FormField>

              <FormField label="Level">
                <select
                  value={form.level}
                  onChange={handleChange('level')}
                  style={fieldStyle}
                  {...inputFocusHandlers}
                >
                  <option value="">Select a level…</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </FormField>

              <FormField label="Duration">
                <input
                  type="text"
                  placeholder='e.g. "4 weeks" or "2 hours"'
                  value={form.duration}
                  onChange={handleChange('duration')}
                  style={fieldStyle}
                  {...inputFocusHandlers}
                />
              </FormField>

              <FormField label="Price">
                <input
                  type="text"
                  placeholder='e.g. "Free" or "50,000 sats"'
                  value={form.price}
                  onChange={handleChange('price')}
                  style={fieldStyle}
                  {...inputFocusHandlers}
                />
              </FormField>
            </div>

            {/* Cover image card */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-gray-200)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-gray-700)' }}>
                Cover Image
              </h3>
              {form.coverImage && (
                <img
                  src={form.coverImage}
                  alt="Cover preview"
                  style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.875rem' }}
                />
              )}
              <input
                type="text"
                placeholder="https://example.com/cover.jpg"
                value={form.coverImage}
                onChange={handleChange('coverImage')}
                style={fieldStyle}
                {...inputFocusHandlers}
              />
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--color-gray-400)' }}>
                Paste a direct image URL for the course cover.
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={loading || success}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '0.75rem 1.5rem',
                  background: loading || success ? 'var(--color-gray-300)' : 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: loading || success ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  width: '100%',
                }}
              >
                {loading ? (
                  <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                ) : (
                  <><Save size={18} /> {editId ? 'Update Course' : 'Save Course'}</>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/educator/courses')}
                style={{
                  padding: '0.7rem 1.5rem',
                  border: '1px solid var(--color-gray-300)',
                  borderRadius: 'var(--radius-md)',
                  background: 'none',
                  color: 'var(--color-gray-600)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          form > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default NewCourse;

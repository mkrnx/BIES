import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { feedbackApi } from '../services/api';
import { Bug, Lightbulb, Heart, MessageSquare, CheckCircle, Loader2, Send } from 'lucide-react';

const TYPES = [
    { value: 'BUG', label: 'Report a Bug', icon: Bug, color: '#dc2626' },
    { value: 'FEATURE', label: 'Request a Feature', icon: Lightbulb, color: '#f59e0b' },
    { value: 'LOVE', label: 'Send Some Love', icon: Heart, color: '#ec4899' },
    { value: 'GENERAL', label: 'General Feedback', icon: MessageSquare, color: 'var(--color-primary)' },
];

const Feedback = () => {
    const { t } = useTranslation();
    const [type, setType] = useState('GENERAL');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() || message.trim().length < 5) {
            setError('Please write at least 5 characters.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await feedbackApi.submit({ type, message: message.trim() });
            setSubmitted(true);
        } catch (err) {
            setError(err.message || 'Failed to submit feedback. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setSubmitted(false);
        setMessage('');
        setType('GENERAL');
        setError('');
    };

    if (submitted) {
        return (
            <div className="feedback-page">
                <div className="feedback-card success-card">
                    <CheckCircle size={48} color="#16a34a" />
                    <h2>Thank you!</h2>
                    <p>Your feedback has been received. We read every message and appreciate you taking the time.</p>
                    <button onClick={reset} className="btn-primary">Send More Feedback</button>
                </div>
                <style jsx>{styles}</style>
            </div>
        );
    }

    return (
        <div className="feedback-page">
            <div className="feedback-card">
                <h1>Feedback</h1>
                <p className="subtitle">Help us improve BIES. Report bugs, request features, or just let us know how we're doing.</p>

                <div className="type-grid">
                    {TYPES.map((t) => {
                        const Icon = t.icon;
                        const selected = type === t.value;
                        return (
                            <button
                                key={t.value}
                                className={`type-btn ${selected ? 'selected' : ''}`}
                                onClick={() => setType(t.value)}
                                style={selected ? { borderColor: t.color, color: t.color } : {}}
                            >
                                <Icon size={20} />
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit}>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={
                            type === 'BUG' ? 'Describe the bug. What happened? What did you expect?' :
                            type === 'FEATURE' ? 'What feature would make BIES better for you?' :
                            type === 'LOVE' ? 'Tell us what you love about BIES!' :
                            'Share your thoughts with us...'
                        }
                        rows={5}
                        maxLength={5000}
                        className="feedback-textarea"
                    />
                    <div className="char-count">{message.length} / 5000</div>

                    {error && <p className="error-text">{error}</p>}

                    <button type="submit" disabled={loading || !message.trim()} className="btn-primary submit-btn">
                        {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                        <span>{loading ? 'Sending...' : 'Send Feedback'}</span>
                    </button>
                </form>
            </div>
            <style jsx>{styles}</style>
        </div>
    );
};

const styles = `
    .feedback-page {
        max-width: 600px;
        margin: 0 auto;
        padding: 2rem 1rem;
    }
    .feedback-card {
        background: var(--color-surface);
        border: 1px solid var(--color-gray-200);
        border-radius: 1.5rem;
        padding: 2rem;
    }
    .feedback-card h1 {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
    }
    .subtitle {
        color: var(--color-gray-500);
        font-size: 0.9rem;
        margin-bottom: 1.5rem;
    }
    .type-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }
    .type-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0.75rem 1rem;
        border: 2px solid var(--color-gray-200);
        border-radius: 0.75rem;
        background: var(--color-surface);
        color: var(--color-gray-500);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }
    .type-btn:hover {
        border-color: var(--color-gray-400);
        color: var(--color-text);
    }
    .type-btn.selected {
        font-weight: 600;
        background: var(--color-gray-50);
    }
    .feedback-textarea {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid var(--color-gray-200);
        border-radius: 0.75rem;
        font-size: 0.9rem;
        font-family: inherit;
        resize: vertical;
        min-height: 120px;
        outline: none;
        background: var(--color-surface);
        color: var(--color-text);
        transition: border-color 0.2s;
    }
    .feedback-textarea:focus {
        border-color: var(--color-primary);
    }
    .feedback-textarea::placeholder {
        color: var(--color-gray-400);
    }
    .char-count {
        text-align: right;
        font-size: 0.75rem;
        color: var(--color-gray-400);
        margin-top: 0.25rem;
        margin-bottom: 1rem;
    }
    .error-text {
        color: var(--color-error);
        font-size: 0.85rem;
        margin-bottom: 0.75rem;
    }
    .submit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 0.75rem 1.5rem;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: 9999px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .submit-btn:hover { opacity: 0.9; }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .success-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 1rem;
        padding: 3rem 2rem;
    }
    .success-card h2 {
        font-size: 1.5rem;
        font-weight: 700;
    }
    .success-card p {
        color: var(--color-gray-500);
        font-size: 0.95rem;
        max-width: 400px;
    }
    .btn-primary {
        padding: 0.75rem 2rem;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: 9999px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @media (max-width: 768px) {
        .feedback-card h1 { display: none; }
    }
    @media (max-width: 480px) {
        .type-grid { grid-template-columns: 1fr; }
        .feedback-card { padding: 1.25rem; }
    }
`;

export default Feedback;

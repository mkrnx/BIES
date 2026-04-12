import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { feedbackApi } from '../services/api';
import { Bug, Lightbulb, Heart, MessageSquare, CheckCircle, Loader2, Send } from 'lucide-react';
import './Feedback.css';

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
                <div className="feedback-card feedback-success-card">
                    <CheckCircle size={48} color="#16a34a" />
                    <h2>Thank you!</h2>
                    <p>Your feedback has been received. We read every message and appreciate you taking the time.</p>
                    <button onClick={reset} className="feedback-btn-primary">Send More Feedback</button>
                </div>
            </div>
        );
    }

    return (
        <div className="feedback-page">
            <div className="feedback-card">
                <h1>Feedback</h1>
                <p className="feedback-subtitle">Help us improve BIES. Report bugs, request features, or just let us know how we're doing.</p>

                <div className="feedback-type-grid">
                    {TYPES.map((t) => {
                        const Icon = t.icon;
                        const selected = type === t.value;
                        return (
                            <button
                                key={t.value}
                                className={`feedback-type-btn ${selected ? 'selected' : ''}`}
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
                    <div className="feedback-char-count">{message.length} / 5000</div>

                    {error && <p className="feedback-error-text">{error}</p>}

                    <button type="submit" disabled={loading || !message.trim()} className="feedback-submit-btn">
                        {loading ? <Loader2 size={18} className="feedback-spin" /> : <Send size={18} />}
                        <span>{loading ? 'Sending...' : 'Send Feedback'}</span>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Feedback;

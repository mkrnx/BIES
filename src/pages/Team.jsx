import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MapPin, Loader2, CheckCircle } from 'lucide-react';

const Team = () => {
    const { t } = useTranslation();
    const [form, setForm] = useState({ name: '', email: '', role: 'Builder', message: '' });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
            setError(t('team.fillFields'));
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            setError(t('team.validEmail'));
            return;
        }

        setSubmitting(true);
        try {
            const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${BASE_URL}/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error('Failed to send message');
            setSubmitted(true);
            setForm({ name: '', email: '', role: 'Builder', message: '' });
        } catch (err) {
            setError(err.message || t('team.somethingWrong'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="about-page">
            {/* Mission */}
            <section className="mission-section">
                <div className="container text-center">
                    <h1 className="mb-4 page-header">{t('team.title')}</h1>
                    <p className="lead">
                        {t('team.mission')}
                    </p>
                </div>
            </section>

            {/* Stats */}
            <section className="bg-white py-12 border-y">
                <div className="container grid grid-cols-3 text-center">
                    <div>
                        <div className="text-3xl font-bold text-primary mb-2">150+</div>
                        <div className="text-gray-500">{t('team.verifiedProjects')}</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-secondary mb-2">$400M+</div>
                        <div className="text-gray-500">{t('team.capitalDeployed')}</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-neutral-dark mb-2">2,000+</div>
                        <div className="text-gray-500">{t('team.jobsCreated')}</div>
                    </div>
                </div>
            </section>

            {/* Team */}
            <section className="py-16 container">
                <h2 className="text-center mb-12">{t('team.leadershipTeam')}</h2>
                <div className="grid grid-cols-3 gap-lg">
                    <div className="team-card">
                        <div className="team-img"></div>
                        <h3>Elena Castillo</h3>
                        <p className="role">{t('team.teamMembers.elena.role')}</p>
                        <p className="bio">{t('team.teamMembers.elena.bio')}</p>
                    </div>
                    <div className="team-card">
                        <div className="team-img"></div>
                        <h3>Marcus Green</h3>
                        <p className="role">{t('team.teamMembers.marcus.role')}</p>
                        <p className="bio">{t('team.teamMembers.marcus.bio')}</p>
                    </div>
                    <div className="team-card">
                        <div className="team-img"></div>
                        <h3>Roberto Diaz</h3>
                        <p className="role">{t('team.teamMembers.roberto.role')}</p>
                        <p className="bio">{t('team.teamMembers.roberto.bio')}</p>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section className="contact-section py-16 bg-white">
                <div className="container max-w-2xl">
                    <h2 className="text-center mb-8">{t('team.getInTouch')}</h2>

                    {submitted ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <CheckCircle size={48} style={{ color: 'var(--color-success)', margin: '0 auto 1rem' }} />
                            <h3>{t('common.messageSent')}</h3>
                            <p style={{ color: 'var(--color-gray-500)', marginTop: '0.5rem' }}>{t('common.thankYouMessage')}</p>
                            <button className="btn btn-outline" style={{ marginTop: '1.5rem' }} onClick={() => setSubmitted(false)}>{t('common.sendAnother')}</button>
                        </div>
                    ) : (
                        <form className="contact-form" onSubmit={handleSubmit}>
                            {error && (
                                <div style={{ padding: '0.75rem 1rem', background: 'var(--color-red-tint, #FEF2F2)', color: 'var(--badge-error-text, #B91C1C)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                    {error}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-md mb-4">
                                <input type="text" name="name" placeholder={t('team.namePlaceholder')} className="input" value={form.name} onChange={handleChange} required />
                                <input type="email" name="email" placeholder={t('team.emailPlaceholder')} className="input" value={form.email} onChange={handleChange} required />
                            </div>
                            <select name="role" className="input mb-4" value={form.role} onChange={handleChange}>
                                <option value="Builder">{t('team.iAmBuilder')}</option>
                                <option value="Investor">{t('team.iAmInvestor')}</option>
                                <option value="Media">{t('team.mediaInquiry')}</option>
                                <option value="Other">{t('team.other')}</option>
                            </select>
                            <textarea name="message" placeholder={t('team.messagePlaceholder')} className="input textarea mb-4" rows="5" value={form.message} onChange={handleChange} required></textarea>
                            <button className="btn btn-primary w-full" type="submit" disabled={submitting}>
                                {submitting ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> {t('common.sending')}</> : t('common.sendMessage')}
                            </button>
                        </form>
                    )}

                    <div className="flex justify-center gap-lg mt-8 text-gray-500">
                        <div className="flex items-center gap-2">
                            <Mail size={18} /> contact@bies.sv
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={18} /> San Benito, San Salvador
                        </div>
                    </div>
                </div>
            </section>

            <style jsx>{`
        .mission-section {
          padding: 6rem 0;
          background: var(--color-neutral-light);
        }
        .lead {
          font-size: 1.25rem;
          color: var(--color-gray-500);
          max-width: 800px;
          margin: 0 auto;
          line-height: 1.8;
        }

        .text-neutral-dark { color: var(--color-neutral-dark); }

        .team-card {
           text-align: center;
           padding: 2rem;
        }
        .team-card h3 {
          color: var(--color-gray-900);
        }
        .team-img {
          width: 120px;
          height: 120px;
          background: var(--color-gray-200);
          border-radius: 50%;
          margin: 0 auto 1.5rem;
        }
        .role {
          color: var(--color-primary);
          font-weight: 600;
          margin-bottom: 1rem;
        }
        .bio {
          font-size: 0.9rem;
          color: var(--color-gray-500);
          line-height: 1.5;
        }

        .textarea { resize: vertical; }

        [data-theme="dark"] .contact-section {
          background: var(--color-gray-100);
        }
        [data-theme="dark"] .contact-section .input {
          background: var(--color-gray-200);
          border-color: var(--color-gray-400);
          color: var(--color-gray-900);
        }
        [data-theme="dark"] .contact-section .btn-primary {
          background-color: var(--color-primary);
          border-color: var(--color-primary);
          color: #0F172A;
        }

        @media (max-width: 768px) {
          .page-header { display: none !important; }
        }
      `}</style>
        </div>
    );
};

export default Team;

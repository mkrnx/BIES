import React, { useState } from 'react';
import { Mail, MapPin, Loader2, CheckCircle } from 'lucide-react';

const Team = () => {
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
            setError('Please fill in all required fields.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            setError('Please enter a valid email address.');
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
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="about-page">
            {/* Mission */}
            <section className="mission-section">
                <div className="container text-center">
                    <h1 className="mb-4 page-header">Orchestrating the Future</h1>
                    <p className="lead">
                        BIES (Build In El Salvador) is the digital bridge between global capital
                        and the builders of the first Bitcoin nation. We are dedicated to accelerating the hyperbitcoinization
                        of El Salvador through transparency, connection, and trusted infrastructure.
                    </p>
                </div>
            </section>

            {/* Stats */}
            <section className="bg-white py-12 border-y">
                <div className="container grid grid-cols-3 text-center">
                    <div>
                        <div className="text-3xl font-bold text-primary mb-2">150+</div>
                        <div className="text-gray-500">Verified Projects</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-secondary mb-2">$400M+</div>
                        <div className="text-gray-500">Capital Deployed</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-neutral-dark mb-2">2,000+</div>
                        <div className="text-gray-500">Jobs Created</div>
                    </div>
                </div>
            </section>

            {/* Team */}
            <section className="py-16 container">
                <h2 className="text-center mb-12">Leadership Team</h2>
                <div className="grid grid-cols-3 gap-lg">
                    <div className="team-card">
                        <div className="team-img"></div>
                        <h3>Elena Castillo</h3>
                        <p className="role">Executive Director</p>
                        <p className="bio">Former FinTech regulator turned Bitcoin advocate. Leading the strategic vision of BIES.</p>
                    </div>
                    <div className="team-card">
                        <div className="team-img"></div>
                        <h3>Marcus Green</h3>
                        <p className="role">Head of Investment</p>
                        <p className="bio">20 years in VC. Focused on bridging Silicon Valley capital with Salvadoran opportunity.</p>
                    </div>
                    <div className="team-card">
                        <div className="team-img"></div>
                        <h3>Roberto Diaz</h3>
                        <p className="role">Chief Technology Officer</p>
                        <p className="bio">Building the digital rails for the new economy. Open source contributor.</p>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section className="contact-section py-16 bg-white">
                <div className="container max-w-2xl">
                    <h2 className="text-center mb-8">Get in Touch</h2>

                    {submitted ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <CheckCircle size={48} style={{ color: 'var(--color-success)', margin: '0 auto 1rem' }} />
                            <h3>Message Sent!</h3>
                            <p style={{ color: 'var(--color-gray-500)', marginTop: '0.5rem' }}>Thank you for reaching out. We'll get back to you shortly.</p>
                            <button className="btn btn-outline" style={{ marginTop: '1.5rem' }} onClick={() => setSubmitted(false)}>Send Another</button>
                        </div>
                    ) : (
                        <form className="contact-form" onSubmit={handleSubmit}>
                            {error && (
                                <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', color: '#B91C1C', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                    {error}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-md mb-4">
                                <input type="text" name="name" placeholder="Name *" className="input" value={form.name} onChange={handleChange} required />
                                <input type="email" name="email" placeholder="Email *" className="input" value={form.email} onChange={handleChange} required />
                            </div>
                            <select name="role" className="input mb-4" value={form.role} onChange={handleChange}>
                                <option value="Builder">I am a Builder</option>
                                <option value="Investor">I am an Investor</option>
                                <option value="Media">Media Inquiry</option>
                                <option value="Other">Other</option>
                            </select>
                            <textarea name="message" placeholder="Message *" className="input textarea mb-4" rows="5" value={form.message} onChange={handleChange} required></textarea>
                            <button className="btn btn-primary w-full" type="submit" disabled={submitting}>
                                {submitting ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Sending...</> : 'Send Message'}
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

        @media (max-width: 768px) {
          .page-header { display: none !important; }
        }
      `}</style>
        </div>
    );
};

export default Team;

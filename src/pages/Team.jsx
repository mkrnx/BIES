import React from 'react';
import { Mail, MapPin } from 'lucide-react';

const Team = () => {
    return (
        <div className="about-page">
            {/* Mission */}
            <section className="mission-section">
                <div className="container text-center">
                    <h1 className="mb-4">Orchestrating the Future</h1>
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
                    <form className="contact-form">
                        <div className="grid grid-cols-2 gap-md mb-4">
                            <input type="text" placeholder="Name" className="input" />
                            <input type="email" placeholder="Email" className="input" />
                        </div>
                        <select className="input mb-4">
                            <option>I am a Builder</option>
                            <option>I am an Investor</option>
                            <option>Media Inquiry</option>
                        </select>
                        <textarea placeholder="Message" className="input textarea mb-4" rows="5"></textarea>
                        <button className="btn btn-primary w-full">Send Message</button>
                    </form>

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

        .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
        .py-16 { padding-top: 4rem; padding-bottom: 4rem; }
        .border-y { border-top: 1px solid var(--color-gray-200); border-bottom: 1px solid var(--color-gray-200); }
        .bg-white { background: white; }
        
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mb-12 { margin-bottom: 3rem; }
        .text-center { text-align: center; }
        .text-3xl { font-size: 2.5rem; }
        .text-gray-500 { color: var(--color-gray-500); }
        .text-primary { color: var(--color-primary); }
        .text-secondary { color: var(--color-secondary); }

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

        .max-w-2xl { max-width: 600px; margin: 0 auto; }
        
        .input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-md);
          outline: none;
          font-family: inherit;
        }
        .input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(0, 71, 171, 0.1); }
        .w-full { width: 100%; }

        @media (max-width: 768px) {
          .grid-cols-3 { grid-template-columns: 1fr; gap: 2rem; }
        }
      `}</style>
        </div>
    );
};

export default Team;

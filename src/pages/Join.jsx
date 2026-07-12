import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Rocket, Zap } from 'lucide-react';
import { voucherApi } from '../services/api';
import logoIcon from '../assets/logo-icon.svg';

/**
 * Join — public onboarding landing page (/join/:code).
 *
 * Warm welcome for invited newcomers. Stashes the invite code in
 * localStorage so the signup / first nostr-login request can attribute the
 * registration to the voucher (see authApi in services/api.js). If the code
 * turns out to be invalid we silently drop it — the page still renders.
 */
const Join = () => {
    const { code } = useParams();
    const { t } = useTranslation();
    const isMember = !!localStorage.getItem('bies_token');

    useEffect(() => {
        if (!code) return;
        localStorage.setItem('bies_onboarding_code', code);
        // Only clear if the stored value is still ours — the user may have
        // opened a different invite link in the meantime.
        const clearIfCurrent = () => {
            if (localStorage.getItem('bies_onboarding_code') === code) {
                localStorage.removeItem('bies_onboarding_code');
            }
        };
        voucherApi.info(code)
            .then((res) => { if (!res.valid) clearIfCurrent(); })
            .catch(clearIfCurrent);
    }, [code]);

    const benefits = [
        { icon: Users, title: t('join.benefit1Title'), text: t('join.benefit1Text') },
        { icon: Rocket, title: t('join.benefit2Title'), text: t('join.benefit2Text') },
        { icon: Zap, title: t('join.benefit3Title'), text: t('join.benefit3Text') },
    ];

    return (
        <div className="join-page">
            <div className="join-card">
                <div className="join-hero">
                    <img src={logoIcon} alt="BIES" style={{ height: '72px', width: 'auto' }} />
                    <h1 className="join-title">{t('join.welcome')}</h1>
                    <p className="join-tagline">{t('join.tagline')}</p>
                </div>

                <div className="join-benefits">
                    {benefits.map(({ icon: Icon, title, text }, i) => (
                        <div key={i} className="join-benefit">
                            <div className="join-benefit-icon">
                                <Icon size={22} />
                            </div>
                            <div className="join-benefit-body">
                                <h3 className="join-benefit-title">{title}</h3>
                                <p className="join-benefit-text">{text}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="join-actions">
                    {isMember ? (
                        <Link to="/feed" className="join-cta">{t('join.goToFeed')}</Link>
                    ) : (
                        <>
                            <Link to="/signup" className="join-cta">{t('join.cta')}</Link>
                            <p className="join-alt">
                                {t('join.haveAccount')}{' '}
                                <Link to="/login" className="join-login-link">{t('join.login')}</Link>
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/*
              Benefit cards are rendered from a .map — following the repo's
              styled-jsx convention, all descendant rules use the
              `.join-page :global(...)` pattern (see Leaderboard.jsx).
            */}
            <style jsx>{`
                .join-page {
                    min-height: 100vh;
                    min-height: 100dvh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(160deg, var(--color-gray-50) 0%, var(--color-blue-tint) 100%);
                    padding: clamp(1rem, 4vh, 3rem) clamp(0.5rem, 2vh, 1rem);
                }

                .join-page :global(.join-card) {
                    background: var(--color-surface);
                    color: var(--color-text, inherit);
                    padding: clamp(1.5rem, 3.5vh, 2.75rem);
                    border-radius: 1.5rem;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
                    border: 1px solid var(--color-gray-200);
                    width: 100%;
                    max-width: 520px;
                    display: flex;
                    flex-direction: column;
                    gap: clamp(1.25rem, 3vh, 2rem);
                }

                .join-page :global(.join-hero) {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    text-align: center;
                }

                .join-page :global(.join-title) {
                    font-family: var(--font-display, inherit);
                    font-size: clamp(1.5rem, 4vh, 2rem);
                    font-weight: 800;
                    margin: 0;
                    color: var(--color-text, inherit);
                }

                .join-page :global(.join-tagline) {
                    font-size: 0.95rem;
                    color: var(--color-gray-500);
                    margin: 0;
                    max-width: 380px;
                    line-height: 1.5;
                }

                .join-page :global(.join-benefits) {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .join-page :global(.join-benefit) {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.85rem;
                    background: var(--color-gray-50);
                    border: 1px solid var(--color-gray-200);
                    border-radius: 1rem;
                    padding: 0.85rem 1rem;
                }

                .join-page :global(.join-benefit-icon) {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    background: var(--color-blue-tint);
                    color: var(--color-primary);
                    flex-shrink: 0;
                }

                .join-page :global(.join-benefit-body) {
                    min-width: 0;
                }

                .join-page :global(.join-benefit-title) {
                    font-size: 0.95rem;
                    font-weight: 700;
                    margin: 0 0 0.2rem;
                    color: var(--color-text, inherit);
                }

                .join-page :global(.join-benefit-text) {
                    font-size: 0.82rem;
                    color: var(--color-gray-500);
                    margin: 0;
                    line-height: 1.5;
                }

                .join-page :global(.join-actions) {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                }

                .join-page :global(.join-cta) {
                    display: block;
                    width: 100%;
                    padding: clamp(0.75rem, 2vh, 1rem) 1.5rem;
                    background: var(--color-primary);
                    color: white;
                    font-size: 1rem;
                    font-weight: 600;
                    text-decoration: none;
                    text-align: center;
                    border-radius: 9999px;
                    transition: opacity 0.2s;
                }
                .join-page :global(.join-cta:hover) { opacity: 0.9; }

                .join-page :global(.join-alt) {
                    font-size: 0.875rem;
                    color: var(--color-gray-500);
                    margin: 0;
                }

                .join-page :global(.join-login-link) {
                    color: var(--color-primary);
                    font-weight: 600;
                    text-decoration: none;
                }
                .join-page :global(.join-login-link:hover) {
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
};

export default Join;

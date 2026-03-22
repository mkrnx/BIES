import React from 'react';
import { Moon, Bell, Lock, Globe, Eye, Zap } from 'lucide-react';
import WalletConnect from '../components/WalletConnect';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { investorApi } from '../services/api';

const Settings = () => {
    const { theme, setTheme } = useTheme();
    const { t, i18n } = useTranslation();

    const handleLanguageChange = (e) => {
        i18n.changeLanguage(e.target.value);
    };

    const { user } = useAuth();
    const [investorMessage, setInvestorMessage] = React.useState('');
    const [submittingInvestor, setSubmittingInvestor] = React.useState(false);
    const [investorRequested, setInvestorRequested] = React.useState(false);
    const [investorError, setInvestorError] = React.useState('');

    const handleApplyInvestor = async () => {
        if (!user) return;
        setSubmittingInvestor(true);
        setInvestorError('');
        try {
            await investorApi.requestRole({ message: investorMessage });
            setInvestorRequested(true);
        } catch (err) {
            setInvestorError(err.message || 'Failed to submit application.');
        } finally {
            setSubmittingInvestor(false);
        }
    };

    return (
        <div className="container py-8 max-w-3xl">
            <h1 className="mb-8">{t('settings.title')}</h1>

            <div className="settings-section">
                <h2><Zap size={16} /> {t('settings.lightningWallet')}</h2>
                <div className="setting-item">
                    <WalletConnect />
                </div>
            </div>

            <div className="settings-section">
                <h2>{t('settings.preferences')}</h2>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Moon size={20} /></div>
                        <div>
                            <p className="setting-label">{t('settings.darkMode')}</p>
                            <p className="setting-desc">{t('settings.darkModeDesc')}</p>
                        </div>
                    </div>
                    <select
                        className="select-input"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                    >
                        <option value="light">{t('settings.light')}</option>
                        <option value="dark">{t('settings.dark')}</option>
                        <option value="system">{t('settings.system')}</option>
                    </select>
                </div>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Globe size={20} /></div>
                        <div>
                            <p className="setting-label">{t('settings.language')}</p>
                            <p className="setting-desc">{t('settings.languageDesc')}</p>
                        </div>
                    </div>
                    <select
                        className="select-input"
                        value={i18n.language?.startsWith('es') ? 'es' : 'en'}
                        onChange={handleLanguageChange}
                    >
                        <option value="en">English</option>
                        <option value="es">Espanol</option>
                    </select>
                </div>
            </div>

            <div className="settings-section">
                <h2>{t('settings.notifications')}</h2>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Bell size={20} /></div>
                        <div>
                            <p className="setting-label">{t('settings.emailNotifications')}</p>
                            <p className="setting-desc">{t('settings.emailNotificationsDesc')}</p>
                        </div>
                    </div>
                    <button className="toggle-btn active">{t('common.on')}</button>
                </div>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Eye size={20} /></div>
                        <div>
                            <p className="setting-label">{t('settings.profileVisibility')}</p>
                            <p className="setting-desc">{t('settings.profileVisibilityDesc')}</p>
                        </div>
                    </div>
                    <button className="toggle-btn active">{t('common.on')}</button>
                </div>
            </div>

            <div className="settings-section">
                <h2>Account Roles</h2>
                {user?.role === 'INVESTOR' ? (
                    <div className="setting-item">
                        <div className="setting-info">
                            <div className="icon-box" style={{ background: 'var(--color-primary-light)', color: 'white' }}><Globe size={20} /></div>
                            <div>
                                <p className="setting-label">Investor Status</p>
                                <p className="setting-desc">You are currently verified as an Investor.</p>
                            </div>
                        </div>
                        <span className="badge-shield" style={{ position: 'static', padding: '4px 12px', background: 'var(--color-primary)', color: 'white', borderRadius: '99px', fontSize: '0.85rem' }}>Verified</span>
                    </div>
                ) : (
                    <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                        <div className="setting-info" style={{ width: '100%' }}>
                            <div className="icon-box"><Globe size={20} /></div>
                            <div>
                                <p className="setting-label">Apply for Investor Role</p>
                                <p className="setting-desc">Investors must be vetted. Submit an application to gain the Investor badge.</p>
                            </div>
                        </div>
                        {investorRequested ? (
                            <div style={{ background: 'var(--color-green-tint)', color: 'var(--color-green-700)', padding: '0.75rem 1rem', borderRadius: '12px', width: '100%', fontSize: '0.9rem', fontWeight: 500 }}>
                                Your application has been submitted and is pending review!
                            </div>
                        ) : (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <textarea
                                    className="select-input"
                                    placeholder="Briefly describe your investment focus or background (optional)"
                                    value={investorMessage}
                                    onChange={(e) => setInvestorMessage(e.target.value)}
                                    rows={3}
                                    style={{ width: '100%', resize: 'none', fontFamily: 'inherit' }}
                                />
                                {investorError && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', margin: 0 }}>{investorError}</p>}
                                <button
                                    onClick={handleApplyInvestor}
                                    disabled={submittingInvestor}
                                    className="btn btn-outline btn-sm"
                                    style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}
                                >
                                    {submittingInvestor ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>


            <div className="settings-section">
                <h2>{t('settings.security')}</h2>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Lock size={20} /></div>
                        <div>
                            <p className="setting-label">{t('settings.changePassword')}</p>
                            <p className="setting-desc">{t('settings.changePasswordDesc')}</p>
                        </div>
                    </div>
                    <button className="btn btn-outline btn-sm">{t('common.update')}</button>
                </div>
            </div>

            <style jsx>{`
                .max-w-3xl { max-width: 48rem; }

                .settings-section { background: var(--color-surface); border: 1px solid var(--color-gray-200); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 2rem; }
                .settings-section h2 { padding: 1rem 1.5rem; background: var(--color-gray-50); border-bottom: 1px solid var(--color-gray-200); font-size: 1rem; color: var(--color-gray-600); }

                .setting-item { padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-gray-100); }
                .setting-item:last-child { border-bottom: none; }

                .setting-info { display: flex; align-items: center; gap: 1rem; }
                .icon-box { width: 40px; height: 40px; background: var(--color-gray-100); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--color-gray-600); }

                .setting-label { font-weight: 600; margin-bottom: 2px; }
                .setting-desc { font-size: 0.85rem; color: var(--color-gray-500); }

                .toggle-btn {
                    padding: 0.5rem 1rem;
                    border-radius: 99px;
                    border: 1px solid var(--color-gray-300);
                    background: var(--color-surface);
                    color: var(--color-gray-500);
                    font-size: 0.85rem;
                    cursor: pointer;
                    width: 60px;
                }
                .toggle-btn.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

                .select-input { padding: 0.5rem; border-radius: var(--radius-md); border: 1px solid var(--color-gray-300); }
                .btn-sm { font-size: 0.85rem; padding: 0.5rem 1rem; }
            `}</style>
        </div>
    );
};

export default Settings;

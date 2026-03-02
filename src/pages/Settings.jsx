import React from 'react';
import { Moon, Bell, Lock, Globe, Eye } from 'lucide-react';

const Settings = () => {
    return (
        <div className="container py-8 max-w-3xl">
            <h1 className="mb-8">Settings</h1>

            <div className="settings-section">
                <h2>Preferences</h2>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Moon size={20} /></div>
                        <div>
                            <p className="setting-label">Dark Mode</p>
                            <p className="setting-desc">Switch between light and dark themes</p>
                        </div>
                    </div>
                    <button className="toggle-btn">Off</button>
                </div>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Globe size={20} /></div>
                        <div>
                            <p className="setting-label">Language</p>
                            <p className="setting-desc">Select your preferred language</p>
                        </div>
                    </div>
                    <select className="select-input">
                        <option>English</option>
                        <option>Español</option>
                    </select>
                </div>
            </div>

            <div className="settings-section">
                <h2>Notifications</h2>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Bell size={20} /></div>
                        <div>
                            <p className="setting-label">Email Notifications</p>
                            <p className="setting-desc">Receive updates about your projects</p>
                        </div>
                    </div>
                    <button className="toggle-btn active">On</button>
                </div>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Eye size={20} /></div>
                        <div>
                            <p className="setting-label">Profile Visibility</p>
                            <p className="setting-desc">Allow others to see your profile activity</p>
                        </div>
                    </div>
                    <button className="toggle-btn active">On</button>
                </div>
            </div>

            <div className="settings-section">
                <h2>Security</h2>
                <div className="setting-item">
                    <div className="setting-info">
                        <div className="icon-box"><Lock size={20} /></div>
                        <div>
                            <p className="setting-label">Change Password</p>
                            <p className="setting-desc">Update your account password</p>
                        </div>
                    </div>
                    <button className="btn btn-outline btn-sm">Update</button>
                </div>
            </div>

            <style jsx>{`
                .max-w-3xl { max-width: 48rem; }

                .settings-section { background: white; border: 1px solid var(--color-gray-200); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 2rem; }
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
                    background: white;
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

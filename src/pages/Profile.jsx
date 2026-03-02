import React from 'react';
import { User, Mail, Globe, MapPin, Shield } from 'lucide-react';

const Profile = () => {
    return (
        <div className="container py-8 max-w-3xl">
            <h1>User Profile</h1>
            <p className="text-gray-500 mb-8">Manage your personal information and preferences.</p>

            <div className="card-section">
                <div className="profile-header">
                    <div className="avatar-large">AM</div>
                    <div>
                        <h2>Alex M.</h2>
                        <span className="badge-role">Builder</span>
                    </div>
                </div>

                <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" defaultValue="Alex Mendoza" className="input-field" />
                </div>
                <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" defaultValue="alex@volcanoenergy.sv" className="input-field" />
                </div>
                <div className="form-group">
                    <label>Location</label>
                    <input type="text" defaultValue="San Salvador, El Salvador" className="input-field" />
                </div>
                <div className="form-group">
                    <label>Bio</label>
                    <textarea rows="4" className="input-field" defaultValue="Building the future of energy in El Salvador. Passionate about Bitcoin and renewable infrastructure."></textarea>
                </div>

                <div className="mt-4 flex gap-4">
                    <button className="btn btn-primary">Save Changes</button>
                    <button className="btn btn-outline">Cancel</button>
                </div>
            </div>

            <div className="card-section mt-8">
                <h3>Verification Status</h3>
                <div className="verification-box">
                    <Shield size={24} className="text-success" />
                    <div>
                        <p className="font-bold">Identity Verified</p>
                        <p className="text-sm text-gray-500">Your account is fully verified for fundraising.</p>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .max-w-3xl { max-width: 48rem; }
                .card-section { background: white; padding: 2rem; border-radius: var(--radius-lg); border: 1px solid var(--color-gray-200); }

                .profile-header { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; }
                .avatar-large { width: 80px; height: 80px; background: var(--color-primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 700; }

                .badge-role { background: var(--color-secondary); color: white; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; text-transform: uppercase; font-weight: 600; margin-top: 4px; display: inline-block; }

                .form-group { margin-bottom: 1.5rem; }
                .form-group label { display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-gray-700); }
                .input-field { width: 100%; padding: 0.75rem; border: 1px solid var(--color-gray-300); border-radius: var(--radius-md); font-size: 1rem; outline: none; transition: border-color 0.2s; }
                .input-field:focus { border-color: var(--color-primary); }

                .verification-box { background: #F0FDF4; border: 1px solid #BBF7D0; padding: 1rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 1rem; margin-top: 1rem; }
                .text-success { color: var(--color-success); }
                .font-bold { font-weight: 700; }
                .gap-4 { gap: 1rem; }
            `}</style>
        </div>
    );
};

export default Profile;

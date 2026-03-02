import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Briefcase, Tag, ArrowLeft, Globe, Twitter, Linkedin, MessageSquare, Loader2, User } from 'lucide-react';
import { profilesApi } from '../services/api';

const PublicProfile = ({ type }) => {
    const { id } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await profilesApi.get(id);
                setProfile(data);
            } catch (err) {
                setError('Profile not found');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [id]);

    if (loading) {
        return <div className="p-10 text-center"><Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>;
    }

    if (error || !profile) {
        return <div className="p-10 text-center">{error || 'Profile not found'}</div>;
    }

    return (
        <div className="profile-page">
            <div className="container py-8 max-w-4xl">
                <Link to={type === 'builder' ? '/builders' : '/investors'} className="back-link mb-6 flex items-center gap-2 text-gray-500 hover:text-primary">
                    <ArrowLeft size={18} /> Back to {type === 'builder' ? 'Builders' : 'Investors'}
                </Link>

                <div className="profile-card">
                    <div className="profile-header flex flex-col md:flex-row gap-8 items-start">
                        <div className="avatar-wrapper">
                            {profile.avatar ? (
                                <img src={profile.avatar} alt={profile.name} className="avatar-img" />
                            ) : (
                                <div className="avatar-placeholder"><User size={48} /></div>
                            )}
                        </div>

                        <div className="profile-info flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-3xl font-bold mb-1">{profile.name}</h1>
                                    <p className="text-xl text-gray-600 mb-2">{profile.title || type} {profile.company ? <>at <span className="text-primary font-semibold">{profile.company}</span></> : ''}</p>

                                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
                                        <MapPin size={16} /> {profile.location}
                                    </div>
                                </div>
                                <button className="btn btn-primary flex items-center gap-2">
                                    <MessageSquare size={18} /> Connect
                                </button>
                            </div>

                            {profile.skills && profile.skills.length > 0 && (
                                <div className="tags flex gap-2 mb-6">
                                    {profile.skills.map((tag, index) => (
                                        <span key={index} className="tag">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="bio mb-8">
                                <h3 className="text-lg font-semibold mb-2">About</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    {profile.bio}
                                </p>
                            </div>

                            <div className="social-links flex gap-4 border-t pt-6">
                                {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="social-icon"><Globe size={20} /></a>}
                                {profile.twitter && <a href={`https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="social-icon"><Twitter size={20} /></a>}
                                {profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="social-icon"><Linkedin size={20} /></a>}
                                {!profile.website && !profile.twitter && !profile.linkedin && (
                                    <span className="text-gray-400 text-sm">No social links added yet.</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .profile-page {
                    min-height: 100vh;
                    background: var(--color-gray-50);
                }
                .container { margin: 0 auto; padding: 0 1rem; }
                .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
                .mb-6 { margin-bottom: 1.5rem; }
                .mb-8 { margin-bottom: 2rem; }

                .profile-card {
                    background: white;
                    padding: 2.5rem;
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-md);
                    border: 1px solid var(--color-gray-200);
                }

                .avatar-wrapper {
                    width: 150px;
                    height: 150px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 4px solid white;
                    box-shadow: var(--shadow-lg);
                    flex-shrink: 0;
                }
                .avatar-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .avatar-placeholder {
                    width: 100%;
                    height: 100%;
                    background: var(--color-gray-200);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-gray-400);
                }

                .tag {
                    padding: 4px 12px;
                    background: var(--color-gray-100);
                    color: var(--color-gray-700);
                    border-radius: 99px;
                    font-size: 0.85rem;
                    font-weight: 500;
                }

                .social-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: var(--color-gray-100);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-gray-500);
                    transition: all 0.2s;
                }
                .social-icon:hover {
                    background: var(--color-primary);
                    color: white;
                }

                @media (max-width: 768px) {
                    .profile-header { flex-direction: column; align-items: center; text-align: center; }
                    .profile-info { width: 100%; }
                    .flex.justify-between { flex-direction: column; align-items: center; gap: 1rem; }
                     .tags { justify-content: center; flex-wrap: wrap; }
                     .social-links { justify-content: center; }
                }
            `}</style>
        </div>
    );
};

export default PublicProfile;

import { useState, useEffect, useRef } from 'react';
import { Globe, MapPin, Linkedin, Briefcase, Plus, Hash, Camera, Loader2, CheckCircle, Save, Search, X, RefreshCw, Send, AtSign, Zap, HelpCircle, ChevronDown, ChevronUp, User, Link as LinkIcon, Trash2, GripVertical, Upload, Image as ImageIcon, Layout as LayoutIcon, LineChart as LineChartIcon, AlignLeft as AlignLeftIcon } from 'lucide-react';
import NostrIcon from '../components/NostrIcon';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import { profilesApi, uploadApi, projectsApi } from '../services/api';
import { nostrService } from '../services/nostrService';
import { Link, useNavigate } from 'react-router-dom';
import NostrFeed from '../components/NostrFeed';
import ImageCropModal from '../components/ImageCropModal';
import RichTextEditor from '../components/RichTextEditor';
import { useSectionDrag, reorderArray } from '../hooks/useSectionDrag';

// Defined outside component to prevent re-mount on every render (which causes input focus loss)
const SectionHeader = ({ icon, title, children }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--color-gray-200, #e5e7eb)',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {icon}
            <h3 style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                margin: 0,
                color: 'var(--color-gray-900, #1f2937)',
            }}>{title}</h3>
        </div>
        {children}
    </div>
);

const CollapsibleSub = ({ title, icon, open, onToggle, children }) => (
    <div style={{
        border: '1px solid var(--color-gray-200, #e5e7eb)',
        borderRadius: 'var(--radius-md, 6px)',
        marginBottom: '0.5rem',
        overflow: 'hidden',
    }}>
        <button
            type="button"
            onClick={onToggle}
            style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0.875rem',
                background: 'var(--color-surface-raised, #fafbfc)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--color-gray-800, #1f2937)',
                transition: 'background 0.15s',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {icon}
                <span>{title}</span>
            </div>
            {open
                ? <ChevronUp size={16} style={{ color: 'var(--color-gray-400)', flexShrink: 0 }} />
                : <ChevronDown size={16} style={{ color: 'var(--color-gray-400)', flexShrink: 0 }} />
            }
        </button>
        {open && (
            <div style={{
                padding: '0.875rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                borderTop: '1px solid var(--color-gray-200, #e5e7eb)',
            }}>
                {children}
            </div>
        )}
    </div>
);

const ProfileEdit = () => {
    const { user, refreshUser, updateRole } = useAuth();
    const navigate = useNavigate();
    const searchRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [avatarImageLoading, setAvatarImageLoading] = useState(false);
    const [bannerImageLoading, setBannerImageLoading] = useState(false);
    const [cropImage, setCropImage] = useState(null); // { src, type: 'avatar'|'banner' }
    const [error, setError] = useState('');
    const [hasExistingProfile, setHasExistingProfile] = useState(false);
    const [memberRole, setMemberRole] = useState('');

    // BIES profile form
    const [form, setForm] = useState({
        name: '',
        bio: '',
        location: '',
        website: '',
        twitter: '',
        linkedin: '',
        company: '',
        title: '',
        avatar: '',
        banner: '',
        tags: [],
        showExperience: true,
        showNostrFeed: true,
        nostrFeedSource: 'private',
        experience: [],
        biesProjects: [],
        nostrNpub: '',
        nip05Name: '',
        lightningAddress: '',
        customSections: [],
    });

    // NIP-05 availability check
    const [nip05Available, setNip05Available] = useState(null);
    const [nip05Checking, setNip05Checking] = useState(false);

    // Nostr profile form
    const [nostrProfile, setNostrProfile] = useState(null);
    const [loadingNostr, setLoadingNostr] = useState(false);
    const [savingNostr, setSavingNostr] = useState(false);
    const [nostrSaved, setNostrSaved] = useState(false);
    const [nostrForm, setNostrForm] = useState({
        display_name: '', name: '', about: '', picture: '', website: '', nip05: '', lud16: '', banner: ''
    });
    const [publishMode, setPublishMode] = useState('bies'); // 'bies' or 'all'
    const [showPublishHelp, setShowPublishHelp] = useState(false);
    const [showFeedHelp, setShowFeedHelp] = useState(false);

    // Collapsible section state
    const [nostrIdentityOpen, setNostrIdentityOpen] = useState(true);
    const [nostrProfileOpen, setNostrProfileOpen] = useState(false);
    const [nostrPublishOpen, setNostrPublishOpen] = useState(false);

    // Project search
    const [projectSearch, setProjectSearch] = useState('');
    const [projectResults, setProjectResults] = useState([]);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [newProjectRole, setNewProjectRole] = useState('');
    const [autoProjects, setAutoProjects] = useState([]); // projects the builder owns or is team member of

    // ─── Data Loading ───

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        if (user?.nostrPubkey) {
            fetchNostrProfile();
        }
    }, [user?.nostrPubkey]);

    // Auto-apply Nostr profile fields to BIES form when BIES profile is missing them
    useEffect(() => {
        if (!nostrProfile) return;
        setForm(prev => {
            const updates = {};
            if (!prev.banner && nostrProfile.banner) updates.banner = nostrProfile.banner;
            if (!prev.avatar && nostrProfile.picture) updates.avatar = nostrProfile.picture;
            if (!prev.name && (nostrProfile.display_name || nostrProfile.name)) {
                updates.name = nostrProfile.display_name || nostrProfile.name;
            }
            if (!prev.bio && nostrProfile.about) updates.bio = nostrProfile.about;
            if (!prev.website && nostrProfile.website) updates.website = nostrProfile.website;
            if (Object.keys(updates).length === 0) return prev;
            return { ...prev, ...updates };
        });
    }, [nostrProfile]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowProjectDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!projectSearch.trim()) {
            setProjectResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await projectsApi.list({ search: projectSearch, limit: 5 });
                const rawList = res?.data || res || [];
                setProjectResults(rawList.map(p => ({ ...p, name: p.title || p.name, image: p.thumbnail || p.coverImage || p.image })));
                setShowProjectDropdown(true);
            } catch (err) {
                console.error('Failed to search projects', err);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [projectSearch]);

    // Debounced NIP-05 availability check
    useEffect(() => {
        const name = form.nip05Name.trim().toLowerCase();
        if (!name || name.length < 3) {
            setNip05Available(null);
            return;
        }
        setNip05Checking(true);
        const timer = setTimeout(async () => {
            try {
                const res = await profilesApi.checkNip05(name);
                setNip05Available(res.available);
            } catch {
                setNip05Available(null);
            } finally {
                setNip05Checking(false);
            }
        }, 500);
        return () => { clearTimeout(timer); setNip05Checking(false); };
    }, [form.nip05Name]);

    // Auto-fetch projects the user owns or is a team member of
    useEffect(() => {
        if (!user?.id) return;
        const fetchMyProjects = async () => {
            try {
                const res = await projectsApi.list({ ownerId: user.id, limit: 50 });
                const list = (res?.data || res || []).map(p => ({
                    id: p.id,
                    name: p.title || p.name,
                    role: 'Founder',
                    status: p.stage || 'Active',
                    image: p.thumbnail || p.coverImage || '',
                }));
                setAutoProjects(list);
            } catch {
                // ignore
            }
        };
        fetchMyProjects();
    }, [user?.id]);

    const loadProfile = async () => {
        try {
            const profile = await profilesApi.me();
            if (profile) {
                setHasExistingProfile(true);
                setMemberRole(user?.role || 'BUILDER');
                setForm(prev => ({
                    ...prev,
                    name: profile.name || '',
                    bio: profile.bio || '',
                    location: profile.location || '',
                    website: profile.website || '',
                    twitter: profile.twitter || '',
                    linkedin: profile.linkedin || '',
                    company: profile.company || '',
                    title: profile.title || profile.role || '',
                    avatar: profile.avatar || profile.image || '',
                    banner: profile.banner || '',
                    tags: profile.tags || [],
                    showExperience: profile.showExperience ?? true,
                    showNostrFeed: profile.showNostrFeed ?? true,
                    nostrFeedSource: profile.nostrFeedSource || 'private',
                    experience: (profile.experience || []).map(exp => {
                        // Parse fromYear/toYear from existing date string like "2020 - Present"
                        let fromYear = exp.fromYear || '';
                        let toYear = exp.toYear || '';
                        if (!fromYear && exp.date) {
                            const parts = exp.date.split(/\s*[-–]\s*/);
                            if (parts[0] && /^\d{4}$/.test(parts[0].trim())) fromYear = parts[0].trim();
                            if (parts[1] && /^\d{4}$/.test(parts[1].trim())) toYear = parts[1].trim();
                        }
                        return { ...exp, fromYear, toYear };
                    }),
                    biesProjects: profile.biesProjects || [],
                    customSections: Array.isArray(profile.customSections)
                        ? profile.customSections.map(s => ({
                            title: s.title || '',
                            type: s.type || 'TEXT',
                            placement: s.placement || 'LEFT',
                            body: s.body || s.content || '',
                            imageUrl: s.imageUrl || '',
                            images: s.images || [],
                            graphType: s.graphType || 'BAR',
                            xAxisLabel: s.xAxisLabel || '',
                            yAxisLabel: s.yAxisLabel || '',
                            dataPoints: s.dataPoints || [],
                        }))
                        : [],
                    nostrNpub: profile.nostrNpub || (user?.nostrPubkey ? nip19.npubEncode(user.nostrPubkey) : ''),
                    nip05Name: profile.nip05Name || '',
                    lightningAddress: profile.lightningAddress || '',
                }));
            }
        } catch {
            // New user — form stays with defaults
        } finally {
            setLoading(false);
        }
    };

    const fetchNostrProfile = async () => {
        setLoadingNostr(true);
        try {
            const profile = await nostrService.getProfile(user.nostrPubkey);
            setNostrProfile(profile);
            if (profile) {
                setNostrForm({
                    display_name: profile.display_name || '',
                    name: profile.name || '',
                    about: profile.about || '',
                    picture: profile.picture || '',
                    website: profile.website || '',
                    nip05: profile.nip05 || '',
                    lud16: profile.lud16 || '',
                    banner: profile.banner || '',
                });
            }
        } catch (err) {
            console.error('Failed to fetch Nostr profile:', err);
        } finally {
            setLoadingNostr(false);
        }
    };

    // ─── Handlers ───

    const handleChange = (field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    };

    const handleSave = async (e) => {
        e?.preventDefault();
        setSaving(true);
        setError('');
        try {
            // Only send fields the backend accepts
            const payload = {
                name: form.name || undefined,
                bio: form.bio,
                location: form.location,
                website: form.website || undefined,
                twitter: form.twitter,
                linkedin: form.linkedin,
                company: form.company,
                title: form.title,
                avatar: form.avatar || undefined,
                banner: form.banner || undefined,
                tags: form.tags,
                experience: form.experience,
                biesProjects: form.biesProjects,
                customSections: form.customSections,
                showExperience: form.showExperience,
                showNostrFeed: form.showNostrFeed,
                nostrFeedSource: form.nostrFeedSource,
                nostrNpub: form.nostrNpub,
                nip05Name: form.nip05Name || undefined,
                lightningAddress: form.lightningAddress,
            };
            // Remove undefined values so Zod doesn't see them
            Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
            await profilesApi.update(payload);
            if (memberRole && memberRole !== user?.role) {
                await updateRole(memberRole);
            }
            await refreshUser();
            navigate('/profile');
        } catch (err) {
            console.error('Save profile error:', err);
            setError(err.data?.details?.map(d => `${d.field}: ${d.message}`).join(', ') || err.message || 'Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    // Avatar & Banner uploads — open crop modal first
    const handleAvatarSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const src = URL.createObjectURL(file);
        setCropImage({ src, type: 'avatar' });
        e.target.value = ''; // reset so same file can be re-selected
    };

    const handleBannerSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const src = URL.createObjectURL(file);
        setCropImage({ src, type: 'banner' });
        e.target.value = '';
    };

    const handleCropConfirm = async (croppedFile) => {
        const type = cropImage.type;
        URL.revokeObjectURL(cropImage.src);
        setCropImage(null);

        if (type === 'avatar') {
            setUploadingAvatar(true);
        } else {
            setUploadingBanner(true);
        }
        setError('');

        try {
            const result = await uploadApi.media(croppedFile);
            // Preload the image before showing it, so it doesn't flash white
            if (type === 'avatar') {
                setAvatarImageLoading(true);
                setUploadingAvatar(false);
            } else {
                setBannerImageLoading(true);
                setUploadingBanner(false);
            }
            const img = new Image();
            img.onload = () => {
                setForm(prev => ({ ...prev, [type]: result.url }));
                if (type === 'avatar') setAvatarImageLoading(false);
                else setBannerImageLoading(false);
            };
            img.onerror = () => {
                // Still set the URL even if preload fails
                setForm(prev => ({ ...prev, [type]: result.url }));
                if (type === 'avatar') setAvatarImageLoading(false);
                else setBannerImageLoading(false);
            };
            img.src = result.url;
        } catch (err) {
            console.error(`${type} upload error:`, err);
            setError(`Failed to upload ${type}. Make sure the backend server is running.`);
            if (type === 'avatar') setUploadingAvatar(false);
            else setUploadingBanner(false);
        }
    };

    const handleCropCancel = () => {
        if (cropImage) URL.revokeObjectURL(cropImage.src);
        setCropImage(null);
    };

    // Tags
    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            e.preventDefault();
            const newTag = e.target.value.trim();
            if (!form.tags.includes(newTag)) {
                setForm(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
            }
            e.target.value = '';
        }
    };

    const removeTag = (tag) => {
        setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
    };

    // Year options for experience date dropdowns
    const currentYear = new Date().getFullYear();
    const yearOptions = [];
    for (let y = currentYear; y >= 1970; y--) yearOptions.push(y);

    // Experience
    const handleAddExperience = () => {
        setForm(prev => ({
            ...prev,
            experience: [...prev.experience, { title: '', company: '', fromYear: '', toYear: '', date: '', description: '' }]
        }));
    };

    const handleExperienceChange = (index, field) => (e) => {
        const updated = [...form.experience];
        updated[index] = { ...updated[index], [field]: e.target.value };
        setForm(prev => ({ ...prev, experience: updated }));
    };

    const handleRemoveExperience = (index) => {
        setForm(prev => ({ ...prev, experience: prev.experience.filter((_, i) => i !== index) }));
    };

    // Projects
    const handleAddProject = (project) => {
        if (!form.biesProjects.find(p => p.id === project.id)) {
            setForm(prev => ({
                ...prev,
                biesProjects: [...prev.biesProjects, {
                    id: project.id,
                    name: project.name,
                    role: newProjectRole || 'Contributor',
                    status: project.status || 'Active',
                    image: project.image || project.coverImage
                }]
            }));
        }
        setProjectSearch('');
        setNewProjectRole('');
        setShowProjectDropdown(false);
    };

    const handleRemoveProject = (projectId) => {
        setForm(prev => ({ ...prev, biesProjects: prev.biesProjects.filter(p => p.id !== projectId) }));
    };

    // ─── Custom Sections ─────────────────────────────────────────────────────

    const addSection = (type = 'TEXT', placement = 'LEFT') => {
        const extra = {
            TEXT: { body: '' },
            PHOTO: { imageUrl: '' },
            CAROUSEL: { images: [] },
            GRAPH: { graphType: 'BAR', xAxisLabel: '', yAxisLabel: '', dataPoints: [{ label: 'Data 1', value: '100' }] },
        }[type] || { body: '' };
        setForm(prev => ({ ...prev, customSections: [...prev.customSections, { title: '', type, placement, ...extra }] }));
    };

    const updateSection = (index, field, value) =>
        setForm(prev => ({ ...prev, customSections: prev.customSections.map((s, i) => i === index ? { ...s, [field]: value } : s) }));

    const removeSection = (index) =>
        setForm(prev => ({ ...prev, customSections: prev.customSections.filter((_, i) => i !== index) }));

    const moveSection = (fromIdx, toIdx) =>
        setForm(prev => ({ ...prev, customSections: reorderArray(prev.customSections, fromIdx, toIdx) }));

    const { draggingIdx, getSectionDragProps } = useSectionDrag(moveSection);

    const handleSectionImageUpload = async (index, file) => {
        if (!file) return;
        try {
            const result = await uploadApi.media(file);
            updateSection(index, 'imageUrl', result.url);
        } catch { setError('Failed to upload image.'); }
    };

    const handleCarouselImageUpload = async (index, file) => {
        if (!file) return;
        try {
            const result = await uploadApi.media(file);
            setForm(prev => {
                const updated = [...prev.customSections];
                updated[index] = { ...updated[index], images: [...(updated[index].images || []), result.url] };
                return { ...prev, customSections: updated };
            });
        } catch { setError('Failed to upload carousel image.'); }
    };

    const removeCarouselImage = (sIdx, iIdx) =>
        setForm(prev => ({ ...prev, customSections: prev.customSections.map((s, i) => i === sIdx ? { ...s, images: s.images.filter((_, j) => j !== iIdx) } : s) }));

    const addGraphDataPoint = (index) =>
        setForm(prev => ({ ...prev, customSections: prev.customSections.map((s, i) => i === index ? { ...s, dataPoints: [...(s.dataPoints || []), { label: '', value: '' }] } : s) }));

    const updateGraphDataPoint = (sIdx, pIdx, field, value) =>
        setForm(prev => ({ ...prev, customSections: prev.customSections.map((s, i) => {
            if (i !== sIdx) return s;
            const pts = [...s.dataPoints];
            pts[pIdx] = { ...pts[pIdx], [field]: value };
            return { ...s, dataPoints: pts };
        }) }));

    const removeGraphDataPoint = (sIdx, pIdx) =>
        setForm(prev => ({ ...prev, customSections: prev.customSections.map((s, i) => i === sIdx ? { ...s, dataPoints: s.dataPoints.filter((_, j) => j !== pIdx) } : s) }));

    const renderSection = (section, idx) => {
        const stype = section.type || 'TEXT';
        const typeConfig = {
            TEXT:     { icon: <AlignLeftIcon size={12} />,  label: 'Text',     color: '#2563eb', bg: 'var(--color-blue-tint)', border: '#bfdbfe' },
            PHOTO:    { icon: <ImageIcon size={12} />,       label: 'Photo',    color: '#16a34a', bg: 'var(--color-green-tint)', border: '#bbf7d0' },
            CAROUSEL: { icon: <LayoutIcon size={12} />,      label: 'Carousel', color: '#a78bfa', bg: 'var(--color-surface-raised, #f5f3ff)', border: 'var(--color-gray-200, #ddd6fe)' },
            GRAPH:    { icon: <LineChartIcon size={12} />,   label: 'Graph',    color: '#ea580c', bg: 'var(--color-orange-tint)', border: '#fed7aa' },
        }[stype] || { icon: null, label: stype, color: 'var(--color-gray-500)', bg: 'var(--color-gray-100)', border: 'var(--color-gray-200)' };

        const isBeingDragged = draggingIdx === idx;
        return (
            <div key={idx} {...getSectionDragProps(idx)} style={{ marginBottom: '0.75rem', background: 'var(--color-surface)', border: `1px solid ${typeConfig.border}`, borderRadius: '12px', overflow: 'hidden', boxShadow: isBeingDragged ? '0 4px 16px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.06)', opacity: isBeingDragged ? 0.5 : 1, transition: 'box-shadow 0.2s, opacity 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: typeConfig.bg, borderBottom: `1px solid ${typeConfig.border}` }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: typeConfig.color }}>
                        <GripVertical size={14} style={{ cursor: 'grab', color: 'var(--color-gray-400)', marginRight: '0.2rem', flexShrink: 0 }} />
                        {typeConfig.icon} {typeConfig.label} Section
                    </span>
                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--color-gray-400)', borderRadius: '6px' }} onClick={() => removeSection(idx)}><Trash2 size={15} /></button>
                </div>
                <div style={{ padding: '0.75rem' }}>
                    <input
                        type="text" value={section.title}
                        onChange={(e) => updateSection(idx, 'title', e.target.value)}
                        className="pe-input" placeholder="Section Title"
                        style={{ fontWeight: 700, marginBottom: '0.625rem', fontFamily: 'var(--font-display)' }}
                    />
                    {stype === 'TEXT' && (
                        <RichTextEditor value={section.body} onChange={val => updateSection(idx, 'body', val)} placeholder="Section content..." minHeight="80px" />
                    )}
                    {stype === 'PHOTO' && (
                        section.imageUrl
                            ? <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img src={section.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px' }} />
                                <button type="button" onClick={() => updateSection(idx, 'imageUrl', '')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}><X size={12} /> Remove</button>
                              </div>
                            : <label style={{ border: '2px dashed var(--color-gray-300)', borderRadius: '12px', padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--color-gray-50)' }}>
                                <Upload size={24} style={{ color: 'var(--color-gray-400)', marginBottom: '0.4rem' }} />
                                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#22c55e', margin: '0 0 0.2rem' }}>Upload Photo</p>
                                <p style={{ fontSize: '0.72rem', color: 'var(--color-gray-400)', margin: 0 }}>JPG, PNG, WebP</p>
                                <input type="file" accept="image/*" onChange={e => handleSectionImageUpload(idx, e.target.files?.[0])} style={{ display: 'none' }} />
                              </label>
                    )}
                    {stype === 'CAROUSEL' && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {(section.images || []).map((img, iIdx) => (
                                <div key={iIdx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-gray-200)' }}>
                                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button type="button" onClick={() => removeCarouselImage(idx, iIdx)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer' }}><X size={10} /></button>
                                </div>
                            ))}
                            <label style={{ width: '80px', height: '80px', border: '2px dashed var(--color-gray-300)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2px', cursor: 'pointer', background: 'var(--color-gray-50)' }}>
                                <Plus size={20} style={{ color: 'var(--color-gray-400)' }} />
                                <span style={{ fontSize: '0.6rem', color: 'var(--color-gray-400)' }}>Add</span>
                                <input type="file" accept="image/*" onChange={e => handleCarouselImageUpload(idx, e.target.files?.[0])} style={{ display: 'none' }} />
                            </label>
                        </div>
                    )}
                    {stype === 'GRAPH' && (
                        <div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.6rem', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-gray-700)', whiteSpace: 'nowrap' }}>Chart Type</label>
                                <select value={section.graphType || 'BAR'} onChange={e => updateSection(idx, 'graphType', e.target.value)} className="pe-input pe-input-sm" style={{ width: '120px' }}>
                                    <option value="BAR">Bar Chart</option>
                                    <option value="LINE">Line Chart</option>
                                    <option value="PIE">Pie Chart</option>
                                </select>
                            </div>
                            {section.graphType !== 'PIE' && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
                                    <input type="text" value={section.xAxisLabel || ''} onChange={e => updateSection(idx, 'xAxisLabel', e.target.value)} className="pe-input pe-input-sm" placeholder="X-Axis Label" style={{ flex: 1 }} />
                                    <input type="text" value={section.yAxisLabel || ''} onChange={e => updateSection(idx, 'yAxisLabel', e.target.value)} className="pe-input pe-input-sm" placeholder="Y-Axis Label" style={{ flex: 1 }} />
                                </div>
                            )}
                            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: '0.35rem' }}>Data Points</p>
                            {(section.dataPoints || []).map((pt, pIdx) => (
                                <div key={pIdx} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
                                    <GripVertical size={12} style={{ color: 'var(--color-gray-400)', flexShrink: 0 }} />
                                    <input type="text" value={pt.label} onChange={e => updateGraphDataPoint(idx, pIdx, 'label', e.target.value)} className="pe-input pe-input-sm" placeholder="Label" style={{ flex: 1 }} />
                                    <input type="number" value={pt.value} onChange={e => updateGraphDataPoint(idx, pIdx, 'value', e.target.value)} className="pe-input pe-input-sm" placeholder="Value" style={{ width: '80px' }} />
                                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-gray-400)' }} onClick={() => removeGraphDataPoint(idx, pIdx)}><Trash2 size={13} /></button>
                                </div>
                            ))}
                            <button type="button" onClick={() => addGraphDataPoint(idx)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px dashed var(--color-gray-300)', background: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', marginTop: '0.2rem' }}><Plus size={12} /> Add Point</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderCustomSections = (placement) =>
        form.customSections
            .map((s, idx) => ({ ...s, _idx: idx }))
            .filter(s => placement === 'LEFT' ? (s.placement === 'LEFT' || !s.placement) : s.placement === 'RIGHT')
            .map(s => renderSection(s, s._idx));

    // Nostr
    const handleNostrFormChange = (field) => (e) => {
        setNostrForm(prev => ({ ...prev, [field]: e.target.value }));
        setNostrSaved(false);
    };

    const handleSaveToNostr = async () => {
        setSavingNostr(true);
        setError('');
        try {
            const data = {};
            Object.entries(nostrForm).forEach(([k, v]) => { if (v) data[k] = v; });
            if (publishMode === 'bies') {
                await nostrService.updateProfileToBiesRelay(data);
            } else {
                await nostrService.updateProfile(data);
            }
            setNostrSaved(true);
            setTimeout(() => setNostrSaved(false), 3000);
            await fetchNostrProfile();
        } catch (err) {
            setError(err.message || 'Failed to publish to Nostr.');
        } finally {
            setSavingNostr(false);
        }
    };

    const handleSyncFromNostr = () => {
        if (!nostrProfile) return;
        setForm(prev => ({
            ...prev,
            name: nostrProfile.display_name || nostrProfile.name || prev.name,
            bio: nostrProfile.about || prev.bio,
            avatar: nostrProfile.picture || prev.avatar,
            banner: nostrProfile.banner || prev.banner,
            website: nostrProfile.website || prev.website,
        }));
    };

    const handlePushBiesToNostr = async () => {
        setSavingNostr(true);
        setError('');
        try {
            const data = {};
            if (form.name) data.display_name = form.name;
            if (form.name) data.name = form.name;
            if (form.bio) data.about = form.bio;
            if (form.avatar) data.picture = form.avatar;
            if (form.website) data.website = form.website;
            if (form.banner) data.banner = form.banner;
            await nostrService.updateProfile(data);
            setNostrSaved(true);
            setTimeout(() => setNostrSaved(false), 3000);
            await fetchNostrProfile();
        } catch (err) {
            setError(err.message || 'Failed to push BIES profile to Nostr.');
        } finally {
            setSavingNostr(false);
        }
    };

    // ─── Render ───

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    const projectsTitle = user?.role === 'INVESTOR' ? 'Invested In' : 'Working On';

    return (
        <div className="pe-page">
            <div className="pe-container">

                {/* Top bar */}
                <div className="pe-topbar">
                    <h1 className="pe-page-title">Edit Profile</h1>
                </div>

                {error && (
                    <div className="pe-error">{error}</div>
                )}

                {/* Banner + Avatar card */}
                <div className="pe-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="pe-banner" style={{
                        background: (form.banner || nostrProfile?.banner)
                            ? `url(${form.banner || nostrProfile?.banner}) center/cover no-repeat`
                            : 'linear-gradient(135deg, #0052cc, #0a192f)'
                    }}>
                        {(uploadingBanner || bannerImageLoading) && (
                            <div className="pe-banner-overlay">
                                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'white' }} />
                                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.8rem' }}>
                                    {uploadingBanner ? 'Uploading...' : 'Loading...'}
                                </span>
                            </div>
                        )}
                        <label className="pe-banner-edit">
                            {uploadingBanner ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={14} />}
                            <span className="pe-banner-edit-text">Edit</span>
                            <input type="file" accept="image/*" onChange={handleBannerSelect} style={{ display: 'none' }} />
                        </label>
                        <button onClick={handleSave} type="button" disabled={saving} className="pe-save-btn pe-banner-save">
                            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>

                    <div className="pe-avatar-row">
                        <div className="pe-avatar-wrapper">
                            <div className="pe-avatar">
                                {(form.avatar || nostrProfile?.picture) ? (
                                    <img src={form.avatar || nostrProfile?.picture} alt={form.name} />
                                ) : (
                                    <div className="pe-avatar-placeholder">
                                        {(form.name || user?.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            {(uploadingAvatar || avatarImageLoading) && (
                                <div className="pe-avatar-loading">
                                    <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
                                </div>
                            )}
                            <label className="pe-avatar-edit">
                                <Camera size={14} style={{ color: 'var(--color-gray-700)' }} />
                                <input type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Two-Column Grid - Main + Sidebar */}
                <div className="pe-grid">
                    {/* LEFT COLUMN - Main */}
                    <div className="pe-main-col">

                        {/* Basic Info */}
                        <div className="pe-card">
                    <SectionHeader icon={<User size={18} style={{ color: 'var(--color-gray-400)' }} />} title="Basic Info" />
                    <div className="pe-field-grid">
                        <div className="pe-field">
                            <label className="pe-label">Name</label>
                            <input type="text" value={form.name} onChange={handleChange('name')} className="pe-input" placeholder="Your Name" />
                        </div>
                        <div className="pe-field">
                            <label className="pe-label">Current Role / Title</label>
                            <input type="text" value={form.title} onChange={handleChange('title')} className="pe-input" placeholder="e.g. Founder, CTO, Angel Investor" />
                        </div>
                        <div className="pe-field">
                            <label className="pe-label">Member Type</label>
                            <div className="role-selector">
                                {[
                                    { value: 'BUILDER', label: 'Builder', desc: 'Building a project or startup' },
                                    { value: 'INVESTOR', label: 'Investor', desc: 'Funding and supporting projects' },
                                    { value: 'EDUCATOR', label: 'Educator', desc: 'Teaching and sharing knowledge' },
                                    { value: 'MEMBER', label: 'Member', desc: 'Exploring and connecting with the ecosystem' },
                                ].map(r => (
                                    <button
                                        key={r.value}
                                        type="button"
                                        className={`role-option ${memberRole === r.value ? 'active' : ''}`}
                                        onClick={() => setMemberRole(r.value)}
                                    >
                                        <span className="role-option-label">{r.label}</span>
                                        <span className="role-option-desc">{r.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="pe-field">
                            <label className="pe-label">Company</label>
                            <input type="text" value={form.company} onChange={handleChange('company')} className="pe-input" placeholder="Company" />
                        </div>
                        <div className="pe-field">
                            <label className="pe-label">Location</label>
                            <div className="pe-input-icon">
                                <MapPin size={16} className="pe-icon" />
                                <input type="text" value={form.location} onChange={handleChange('location')} className="pe-input pe-input-with-icon" placeholder="City, Country" />
                            </div>
                        </div>
                    </div>
                    <div className="pe-field" style={{ marginTop: '0.25rem' }}>
                        <label className="pe-label">Bio</label>
                        <textarea
                            rows="3"
                            className="pe-input"
                            style={{ resize: 'vertical', minHeight: '80px' }}
                            value={form.bio}
                            onChange={handleChange('bio')}
                            placeholder="Tell us about yourself..."
                        />
                    </div>
                    <div className="pe-field" style={{ marginTop: '0.75rem' }}>
                        <label className="pe-label">Tags</label>
                        <input type="text" className="pe-input" placeholder="Add tag (press Enter)" onKeyDown={handleTagKeyDown} />
                        {form.tags.length > 0 && (
                            <div className="pe-tags">
                                {form.tags.map((tag, idx) => (
                                    <span key={idx} className="pe-tag">
                                        {tag}
                                        <button onClick={() => removeTag(tag)} type="button"><X size={11} /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Links & Social */}
                <div className="pe-card">
                    <SectionHeader icon={<LinkIcon size={18} style={{ color: 'var(--color-gray-400)' }} />} title="Links & Social" />
                    <div className="pe-field-grid">
                        <div className="pe-field">
                            <label className="pe-label">Website</label>
                            <div className="pe-input-icon">
                                <Globe size={16} className="pe-icon" />
                                <input type="url" value={form.website} onChange={handleChange('website')} className="pe-input pe-input-with-icon" placeholder="https://" />
                            </div>
                        </div>
                        <div className="pe-field">
                            <label className="pe-label">X (Twitter)</label>
                            <div className="pe-input-icon">
                                <div className="pe-icon" style={{ display: 'flex', alignItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                                </div>
                                <input type="text" value={form.twitter} onChange={handleChange('twitter')} className="pe-input pe-input-with-icon" placeholder="@handle" />
                            </div>
                        </div>
                        <div className="pe-field pe-field-full">
                            <label className="pe-label">LinkedIn</label>
                            <div className="pe-input-icon">
                                <Linkedin size={16} className="pe-icon" />
                                <input type="text" value={form.linkedin} onChange={handleChange('linkedin')} className="pe-input pe-input-with-icon" placeholder="LinkedIn URL" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Experience */}
                <div className="pe-card">
                    <SectionHeader icon={<Briefcase size={18} style={{ color: 'var(--color-gray-400)' }} />} title="Experience">
                        <div className="pe-toggle-row">
                            <span className="pe-toggle-label">Show</span>
                            <label className="toggle-switch">
                                <input type="checkbox" checked={form.showExperience} onChange={handleChange('showExperience')} />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </SectionHeader>

                    {form.showExperience && (
                        <div className="pe-experience-list">
                            {form.experience.map((exp, idx) => (
                                <div key={idx} className="pe-exp-item">
                                    <div className="pe-exp-dot" />
                                    <div className="pe-exp-content">
                                        <button onClick={() => handleRemoveExperience(idx)} type="button" className="pe-exp-remove">
                                            <X size={14} />
                                        </button>
                                        <div className="pe-field-grid pe-field-grid-tight">
                                            <div className="pe-field">
                                                <label className="pe-label-sm">Role</label>
                                                <input type="text" value={exp.title} onChange={handleExperienceChange(idx, 'title')} placeholder="Job Title" className="pe-input pe-input-sm" />
                                            </div>
                                            <div className="pe-field">
                                                <label className="pe-label-sm">Company</label>
                                                <input type="text" value={exp.company} onChange={handleExperienceChange(idx, 'company')} placeholder="Company Name" className="pe-input pe-input-sm" />
                                            </div>
                                        </div>
                                        <div className="pe-date-row">
                                            <select
                                                value={exp.fromYear || ''}
                                                onChange={(e) => {
                                                    const updated = [...form.experience];
                                                    updated[idx] = { ...updated[idx], fromYear: e.target.value, date: `${e.target.value} - ${updated[idx].toYear || 'Present'}` };
                                                    setForm(prev => ({ ...prev, experience: updated }));
                                                }}
                                                className="pe-input pe-input-sm"
                                            >
                                                <option value="">From</option>
                                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                            <span className="pe-date-sep">-</span>
                                            <select
                                                value={exp.toYear || ''}
                                                onChange={(e) => {
                                                    const updated = [...form.experience];
                                                    updated[idx] = { ...updated[idx], toYear: e.target.value, date: `${updated[idx].fromYear || ''} - ${e.target.value || 'Present'}` };
                                                    setForm(prev => ({ ...prev, experience: updated }));
                                                }}
                                                className="pe-input pe-input-sm"
                                            >
                                                <option value="">Present</option>
                                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                        <textarea rows="2" value={exp.description} onChange={handleExperienceChange(idx, 'description')} placeholder="Details..." className="pe-input pe-input-sm" style={{ resize: 'vertical' }} />
                                    </div>
                                </div>
                            ))}
                            <button onClick={handleAddExperience} type="button" className="pe-add-btn">
                                <Plus size={16} /> Add Experience
                            </button>
                        </div>
                    )}
                </div>

                {/* Custom Sections */}
                <div className="pe-card">
                    <SectionHeader icon={<LayoutIcon size={18} style={{ color: 'var(--color-gray-400)' }} />} title="Custom Sections" />
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-gray-500)', marginTop: '-0.5rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                        Add custom content blocks to your profile. Drag to reorder.
                    </p>

                    {form.customSections.length > 0 && (
                        <div style={{ marginBottom: '0.75rem' }}>
                            {renderCustomSections('LEFT')}
                            {renderCustomSections('RIGHT')}
                        </div>
                    )}

                    <div style={{ padding: '1rem', background: 'var(--color-gray-50, #f9fafb)', border: '1px dashed var(--color-gray-300)', borderRadius: '10px' }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-gray-500)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add Section</p>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => addSection('TEXT', 'LEFT')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '2px dashed var(--color-gray-300)', background: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}><AlignLeftIcon size={13} /> + Text</button>
                            <button type="button" onClick={() => addSection('PHOTO', 'LEFT')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '2px dashed var(--color-gray-300)', background: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}><ImageIcon size={13} /> + Photo</button>
                            <button type="button" onClick={() => addSection('CAROUSEL', 'LEFT')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '2px dashed var(--color-gray-300)', background: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}><LayoutIcon size={13} /> + Carousel</button>
                            <button type="button" onClick={() => addSection('GRAPH', 'LEFT')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '2px dashed var(--color-gray-300)', background: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}><LineChartIcon size={13} /> + Graph</button>
                        </div>
                    </div>
                        </div>

                    </div>
                    {/* END LEFT COLUMN */}

                    {/* RIGHT COLUMN - Sidebar */}
                    <div className="pe-sidebar-col">

                        {/* Projects */}
                        <div className="pe-card">
                            <SectionHeader icon={<Hash size={18} style={{ color: 'var(--color-gray-400)' }} />} title={projectsTitle} />

                            {autoProjects.length > 0 && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <p className="pe-hint" style={{ marginBottom: '0.75rem' }}>Your projects (auto-detected):</p>
                                    <div className="pe-project-grid">
                                        {autoProjects.map(project => {
                                            const alreadyAdded = form.biesProjects.some(bp => bp.id === project.id);
                                            return (
                                                <div key={project.id} className={`pe-project-item ${alreadyAdded ? 'pe-project-added' : ''}`}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                                        {project.image ? (
                                                            <img src={project.image} alt="" className="pe-project-img" />
                                                        ) : (
                                                            <div className="pe-project-img pe-project-img-placeholder">{project.name.charAt(0)}</div>
                                                        )}
                                                        <div style={{ minWidth: 0 }}>
                                                            <p className="pe-project-name">{project.name}</p>
                                                            <p className="pe-project-role">{project.role}</p>
                                                        </div>
                                                    </div>
                                                    {!alreadyAdded ? (
                                                        <button onClick={() => handleAddProject({ ...project, coverImage: project.image })} className="pe-project-add-btn">+ Add</button>
                                                    ) : (
                                                        <span className="pe-project-added-label">Added</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="pe-field">
                                <label className="pe-label">Add Other Projects</label>
                                <input type="text" placeholder="Your Role / Contribution" className="pe-input pe-input-sm" value={newProjectRole} onChange={(e) => setNewProjectRole(e.target.value)} />
                                <div ref={searchRef} style={{ position: 'relative', marginTop: '0.5rem' }}>
                                    <div className="pe-input-icon">
                                        <Search size={16} className="pe-icon" />
                                        <input
                                            type="text"
                                            className="pe-input pe-input-with-icon"
                                            placeholder="Search projects..."
                                            value={projectSearch}
                                            onChange={(e) => { setProjectSearch(e.target.value); setShowProjectDropdown(true); }}
                                            onFocus={() => setShowProjectDropdown(true)}
                                        />
                                        {projectSearch && (
                                            <button onClick={() => setProjectSearch('')} type="button" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {showProjectDropdown && projectSearch.length > 0 && (
                                        <div className="pe-dropdown">
                                            {projectResults.filter(p =>
                                                (p.name || p.title || '').toLowerCase().includes(projectSearch.toLowerCase()) &&
                                                !form.biesProjects.some(bp => bp.id === p.id)
                                            ).map(project => (
                                                <button
                                                    key={project.id}
                                                    className="pe-dropdown-item"
                                                    onClick={() => handleAddProject({ ...project, name: project.name || project.title })}
                                                >
                                                    {(project.image || project.thumbnail) && <img src={project.image || project.thumbnail} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />}
                                                    <div style={{ minWidth: 0 }}>
                                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-gray-900)' }}>{project.name || project.title}</p>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--color-gray-500)' }}>{project.status || project.stage}</p>
                                                    </div>
                                                </button>
                                            ))}
                                            {projectResults.filter(p => (p.name || p.title || '').toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                                                <div className="pe-dropdown-empty">No projects found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {form.biesProjects.length > 0 && (
                                <div className="pe-project-grid" style={{ marginTop: '1rem' }}>
                                    {form.biesProjects.map(project => (
                                        <div key={project.id} className="pe-project-item">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                                {project.image && <img src={project.image} alt="" className="pe-project-img" />}
                                                <div style={{ minWidth: 0 }}>
                                                    <p className="pe-project-name">{project.name}</p>
                                                    <p className="pe-project-role">{project.role}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveProject(project.id)} type="button" style={{ padding: '0.25rem', color: 'var(--color-gray-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                {/* Nostr */}
                <div className="pe-card pe-nostr-card">
                    <SectionHeader
                        icon={<NostrIcon size={18} color="#8b5cf6" />}
                        title="Nostr"
                    />
                    <p className="pe-section-desc">Manage your Nostr identity, profile, and relay publishing.</p>

                    {/* Identity & Lightning */}
                    <CollapsibleSub
                        title="Identity & Lightning"
                        icon={<Zap size={15} style={{ color: '#f59e0b' }} />}
                        open={nostrIdentityOpen}
                        onToggle={() => setNostrIdentityOpen(v => !v)}
                    >
                        {user?.nostrPubkey && (
                            <div className="pe-field">
                                <label className="pe-label">Public Key (npub)</label>
                                <input
                                    type="text" readOnly
                                    value={nip19.npubEncode(user.nostrPubkey)}
                                    className="pe-input pe-input-readonly"
                                />
                            </div>
                        )}
                        <div className="pe-nostr-fields">
                            <div className="pe-field">
                                <label className="pe-label">NIP-05 Identity</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    <div className="pe-input-icon" style={{ flex: 1 }}>
                                        <AtSign size={14} className="pe-icon" />
                                        <input
                                            type="text"
                                            value={form.nip05Name}
                                            onChange={handleChange('nip05Name')}
                                            className="pe-input pe-input-with-icon pe-input-sm"
                                            placeholder="alice"
                                        />
                                    </div>
                                    {nip05Checking && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-gray-400)' }} />}
                                    {!nip05Checking && nip05Available === true && <CheckCircle size={14} style={{ color: '#16a34a' }} />}
                                    {!nip05Checking && nip05Available === false && <X size={14} style={{ color: '#ef4444' }} />}
                                </div>
                                {form.nip05Name && (
                                    <p className="pe-hint" style={{ color: nip05Available === false ? '#ef4444' : undefined }}>
                                        {nip05Available === false ? 'Taken' : `${form.nip05Name.toLowerCase()}@bies.sovit.xyz`}
                                    </p>
                                )}
                            </div>
                            <div className="pe-field">
                                <label className="pe-label">Lightning</label>
                                <div className="pe-input-icon">
                                    <Zap size={14} className="pe-icon" />
                                    <input
                                        type="text"
                                        value={form.lightningAddress}
                                        onChange={handleChange('lightningAddress')}
                                        className="pe-input pe-input-with-icon pe-input-sm"
                                        placeholder="you@getalby.com"
                                    />
                                </div>
                                <p className="pe-hint">For zaps — Alby, WoS, Strike, etc.</p>
                            </div>
                        </div>
                    </CollapsibleSub>

                    {/* Nostr Profile Editor */}
                    <CollapsibleSub
                        title="Profile Editor"
                        icon={<User size={15} style={{ color: '#8b5cf6' }} />}
                        open={nostrProfileOpen}
                        onToggle={() => setNostrProfileOpen(v => !v)}
                    >
                        {loadingNostr ? (
                            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block' }} />
                                <p className="pe-hint" style={{ marginTop: '0.5rem' }}>Fetching from relays...</p>
                            </div>
                        ) : (
                            <>
                                <div className="pe-field-grid">
                                    <div className="pe-field">
                                        <label className="pe-label">Display Name</label>
                                        <input type="text" value={nostrForm.display_name} onChange={handleNostrFormChange('display_name')} className="pe-input" placeholder="Display name" />
                                    </div>
                                    <div className="pe-field">
                                        <label className="pe-label">@Name</label>
                                        <div className="pe-input-icon">
                                            <AtSign size={14} className="pe-icon" />
                                            <input type="text" value={nostrForm.name} onChange={handleNostrFormChange('name')} className="pe-input pe-input-with-icon" placeholder="username" />
                                        </div>
                                    </div>
                                </div>
                                <div className="pe-field">
                                    <label className="pe-label">About</label>
                                    <textarea rows="2" className="pe-input" style={{ resize: 'vertical' }} value={nostrForm.about} onChange={handleNostrFormChange('about')} placeholder="Bio on Nostr" />
                                </div>
                                <div className="pe-field-grid">
                                    <div className="pe-field">
                                        <label className="pe-label">Picture URL</label>
                                        <input type="url" value={nostrForm.picture} onChange={handleNostrFormChange('picture')} className="pe-input" placeholder="https://..." />
                                    </div>
                                    <div className="pe-field">
                                        <label className="pe-label">Banner URL</label>
                                        <input type="url" value={nostrForm.banner} onChange={handleNostrFormChange('banner')} className="pe-input" placeholder="https://..." />
                                    </div>
                                    <div className="pe-field">
                                        <label className="pe-label">Website</label>
                                        <input type="url" value={nostrForm.website} onChange={handleNostrFormChange('website')} className="pe-input" placeholder="https://..." />
                                    </div>
                                    <div className="pe-field">
                                        <label className="pe-label">NIP-05</label>
                                        <input type="text" value={nostrForm.nip05} onChange={handleNostrFormChange('nip05')} className="pe-input" placeholder="you@domain.com" />
                                    </div>
                                    <div className="pe-field pe-field-full">
                                        <label className="pe-label">LUD-16 (Lightning)</label>
                                        <input type="text" value={nostrForm.lud16} onChange={handleNostrFormChange('lud16')} className="pe-input" placeholder="you@wallet.com" />
                                    </div>
                                </div>
                            </>
                        )}
                    </CollapsibleSub>

                    {/* Publishing & Feed */}
                    <CollapsibleSub
                        title="Publishing & Feed"
                        icon={<Send size={15} style={{ color: '#16a34a' }} />}
                        open={nostrPublishOpen}
                        onToggle={() => setNostrPublishOpen(v => !v)}
                    >
                        <div className="pe-publish-section">
                            <div className="pe-segmented">
                                <button type="button" onClick={() => setPublishMode('bies')} className={publishMode === 'bies' ? 'active' : ''}>
                                    BIES relay only
                                </button>
                                <button type="button" onClick={() => setPublishMode('all')} className={publishMode === 'all' ? 'active' : ''}>
                                    BIES + public relays
                                </button>
                                <button type="button" onClick={() => setShowPublishHelp(prev => !prev)} className="pe-help-btn-inline">
                                    <HelpCircle size={15} />
                                </button>
                            </div>

                            {showPublishHelp && (
                                <div className="pe-help-box">
                                    <p><strong>BIES relay only</strong> — Saves to the private BIES relay. Only visible within BIES.</p>
                                    <p><strong>BIES + public relays</strong> — Broadcasts to BIES relay + public relays (Damus, Primal, etc).</p>
                                    <p style={{ marginTop: '0.5rem' }}><strong>Fetch</strong> — Pull latest Nostr profile from relays. <strong>Apply</strong> — Copy Nostr data to BIES form. <strong>Push</strong> — Publish BIES data to all relays.</p>
                                </div>
                            )}

                            <button type="button" onClick={handleSaveToNostr} disabled={savingNostr} className="pe-publish-btn">
                                {savingNostr ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
                                {savingNostr ? 'Publishing...' : nostrSaved ? 'Published!' : publishMode === 'bies' ? 'Publish to BIES relay' : 'Publish to all relays'}
                                {nostrSaved && <CheckCircle size={15} />}
                            </button>

                            <div className="pe-action-row">
                                <button type="button" onClick={fetchNostrProfile} className="pe-action-btn pe-action-purple">
                                    <RefreshCw size={14} /> Fetch
                                </button>
                                <button type="button" onClick={handleSyncFromNostr} className="pe-action-btn pe-action-blue">
                                    Apply to BIES
                                </button>
                                <button type="button" onClick={handlePushBiesToNostr} disabled={savingNostr} className="pe-action-btn pe-action-green">
                                    <Send size={14} /> Push to relays
                                </button>
                            </div>

                            <div className="pe-feed-toggle">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    <span className="pe-label" style={{ padding: 0 }}>Show Nostr feed on profile</span>
                                    <button type="button" onClick={() => setShowFeedHelp(prev => !prev)} className="pe-help-btn-inline" style={{ borderLeft: 'none', padding: '0.25rem' }}>
                                        <HelpCircle size={14} />
                                    </button>
                                </div>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={form.showNostrFeed} onChange={handleChange('showNostrFeed')} />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            {showFeedHelp && (
                                <div className="pe-help-box">
                                    <p>When enabled, your recent Nostr notes are shown on your BIES profile.</p>
                                    <p><strong>Private only</strong> — BIES relay notes. <strong>Private + public</strong> — All Nostr activity.</p>
                                </div>
                            )}

                            {form.showNostrFeed && (
                                <div className="pe-segmented" style={{ marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setForm(prev => ({ ...prev, nostrFeedSource: 'private' }))} className={form.nostrFeedSource === 'private' ? 'active' : ''}>
                                        Private relay only
                                    </button>
                                    <button type="button" onClick={() => setForm(prev => ({ ...prev, nostrFeedSource: 'all' }))} className={form.nostrFeedSource === 'all' ? 'active' : ''}>
                                        Private + public
                                    </button>
                                </div>
                            )}
                        </div>
                    </CollapsibleSub>
                </div>

                    </div>
                    {/* END RIGHT COLUMN */}
                </div>
                {/* END GRID */}

                {/* Bottom save */}
                <div className="pe-bottom-save">
                    <button onClick={handleSave} type="button" disabled={saving} className="pe-save-btn pe-save-btn-full">
                        {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

            </div>

            {cropImage && (
                <ImageCropModal
                    imageSrc={cropImage.src}
                    aspect={cropImage.type === 'avatar' ? 1 : 16 / 5}
                    shape={cropImage.type === 'avatar' ? 'round' : 'rect'}
                    onCrop={handleCropConfirm}
                    onCancel={handleCropCancel}
                />
            )}

            <style jsx global>{`
                /* ── Page Layout ── */
                .pe-page { background: var(--color-surface-overlay, #f8fafc); min-height: 100vh; }
                .pe-container {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 1rem 1rem 3rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .pe-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 1.5rem;
                    align-items: start;
                }
                .pe-main-col, .pe-sidebar-col {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                @media (max-width: 768px) {
                    .pe-grid { grid-template-columns: 1fr; }
                }
                .pe-topbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.25rem 0;
                }
                .pe-page-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    font-family: var(--font-display);
                    color: var(--color-gray-900);
                }
                .pe-error {
                    background: var(--color-red-tint, #FEF2F2);
                    color: var(--badge-error-text, #EF4444);
                    padding: 0.6rem 0.875rem;
                    border-radius: 8px;
                    font-size: 0.8rem;
                }

                /* ── Cards ── */
                .pe-card {
                    background: var(--color-surface, white);
                    padding: 1.25rem;
                    border-radius: var(--radius-xl, 12px);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                }
                .pe-nostr-card {
                    border-left: 3px solid #8b5cf6;
                    background: var(--color-surface, white);
                }
                .pe-nostr-card .pe-section-desc {
                    color: var(--color-gray-500, #6b7280);
                }

                /* ── Section Headers ── */
                .pe-section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid var(--color-gray-200, #e5e7eb);
                }
                .pe-section-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .pe-section-title h3 {
                    font-size: 1.05rem;
                    font-weight: 700;
                    font-family: var(--font-display);
                    margin: 0;
                }
                .pe-section-desc {
                    font-size: 0.8rem;
                    color: var(--color-gray-500, #6b7280);
                    margin: -0.5rem 0 0.75rem;
                    line-height: 1.4;
                }

                /* ── Form Fields ── */
                .pe-field { display: flex; flex-direction: column; gap: 0.3rem; }
                .pe-field-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.75rem;
                }
                .pe-field-grid-tight { gap: 0.5rem; }
                .pe-field-full { grid-column: 1 / -1; }
                .pe-label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--color-gray-600, #4b5563);
                }
                .pe-label-sm {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--color-gray-500, #6b7280);
                }
                .pe-input {
                    width: 100%;
                    padding: 0.55rem 0.75rem;
                    border: 1px solid var(--color-gray-300, #d1d5db);
                    background: var(--color-surface, white);
                    border-radius: var(--radius-md, 6px);
                    outline: none;
                    font-size: 0.875rem;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .pe-input:focus {
                    border-color: var(--color-primary, #0052cc);
                    box-shadow: 0 0 0 2px rgba(0, 82, 204, 0.1);
                }
                .pe-input-sm { padding: 0.45rem 0.65rem; font-size: 0.825rem; }
                .pe-input-readonly {
                    background: var(--color-gray-100, #f9fafb);
                    cursor: default;
                    font-family: monospace;
                    font-size: 0.8rem;
                }
                .pe-input-icon { position: relative; display: flex; align-items: center; }
                .pe-icon {
                    position: absolute;
                    left: 0.65rem;
                    color: var(--color-gray-400, #9ca3af);
                    pointer-events: none;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                }
                .pe-input-with-icon { padding-left: 2.1rem; flex: 1; min-width: 0; }
                .pe-hint {
                    font-size: 0.72rem;
                    color: var(--color-gray-500, #6b7280);
                    line-height: 1.3;
                    margin-top: 0.15rem;
                }

                /* ── Tags ── */
                .pe-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.375rem; }
                .pe-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.25rem 0.6rem;
                    background: var(--color-green-tint, #dcfce7);
                    color: #22c55e;
                    border-radius: 9999px;
                    font-size: 0.72rem;
                    font-weight: 500;
                }
                .pe-tag button {
                    color: inherit;
                    opacity: 0.6;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    display: flex;
                }

                /* ── Banner / Avatar ── */
                .pe-banner {
                    height: 160px;
                    position: relative;
                }
                .pe-banner-overlay {
                    position: absolute;
                    inset: 0;
                    z-index: 5;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,0,0,0.45);
                    gap: 0.375rem;
                }
                .pe-banner-edit {
                    position: absolute;
                    top: 0.75rem;
                    left: 0.75rem;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    background: var(--color-surface, white);
                    color: var(--color-gray-900, #1f2937);
                    border-radius: var(--radius-md, 6px);
                    padding: 0.4rem 0.75rem;
                    font-weight: 600;
                    font-size: 0.78rem;
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                    border: none;
                }
                .pe-banner-save {
                    position: absolute;
                    top: 0.75rem;
                    right: 0.75rem;
                    z-index: 10;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                }
                .pe-avatar-row {
                    padding: 0 1.25rem 1rem;
                    position: relative;
                    z-index: 5;
                }
                .pe-avatar-wrapper {
                    margin-top: -48px;
                    position: relative;
                    width: fit-content;
                }
                .pe-avatar {
                    width: 96px;
                    height: 96px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid var(--color-surface, white);
                    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
                }
                .pe-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .pe-avatar-placeholder {
                    width: 100%;
                    height: 100%;
                    background: var(--color-gray-100, #f3f4f6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--color-gray-400, #9ca3af);
                }
                .pe-avatar-loading {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.7);
                    border-radius: 50%;
                }
                .pe-avatar-edit {
                    position: absolute;
                    bottom: 2px;
                    right: 2px;
                    width: 30px;
                    height: 30px;
                    background: var(--color-surface, white);
                    border-radius: 50%;
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }

                /* ── Save Button ── */
                .pe-save-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    background: var(--color-primary, #0052cc);
                    color: white;
                    border: none;
                    border-radius: var(--radius-full, 9999px);
                    height: 36px;
                    padding: 0 1.25rem;
                    font-weight: 600;
                    font-size: 0.85rem;
                    cursor: pointer;
                    white-space: nowrap;
                }
                .pe-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .pe-save-btn-full { width: 100%; justify-content: center; height: 40px; }
                .pe-bottom-save { padding-top: 0.25rem; }

                /* ── Toggle ── */
                .pe-toggle-row { display: flex; align-items: center; gap: 0.5rem; }
                .pe-toggle-label { font-size: 0.78rem; font-weight: 500; color: var(--color-gray-500, #6b7280); }
                .toggle-switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .toggle-slider {
                    position: absolute; cursor: pointer; inset: 0;
                    background: var(--color-surface-raised, #cbd5e1); border: 1px solid var(--color-gray-200, #e5e7eb); transition: .3s; border-radius: 22px;
                }
                .toggle-slider:before {
                    content: ""; position: absolute;
                    height: 16px; width: 16px; left: 3px; bottom: 3px;
                    background: var(--color-surface, white); transition: .3s; border-radius: 50%;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                .toggle-switch input:checked + .toggle-slider { background: var(--color-primary, #0052cc); }
                .toggle-switch input:checked + .toggle-slider:before { transform: translateX(18px); }

                /* ── Experience ── */
                .pe-experience-list { display: flex; flex-direction: column; gap: 0.75rem; }
                .pe-exp-item {
                    padding-left: 1.25rem;
                    border-left: 2px solid var(--color-gray-200, #e5e7eb);
                    position: relative;
                }
                .pe-exp-dot {
                    position: absolute;
                    width: 10px; height: 10px;
                    background: var(--color-primary, #0052cc);
                    border-radius: 50%;
                    left: -6px; top: 4px;
                }
                .pe-exp-content {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                }
                .pe-exp-remove {
                    position: absolute;
                    top: -2px; right: 0;
                    color: var(--color-gray-400);
                    background: none; border: none; cursor: pointer;
                    padding: 2px;
                }
                .pe-date-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .pe-date-row select { flex: 1; appearance: auto; cursor: pointer; }
                .pe-date-sep { color: var(--color-gray-400); font-weight: 500; font-size: 0.85rem; }
                .pe-add-btn {
                    width: 100%;
                    padding: 0.6rem;
                    border: 2px dashed var(--color-gray-300, #d1d5db);
                    border-radius: var(--radius-md, 6px);
                    background: none;
                    color: var(--color-gray-500, #6b7280);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                /* ── Collapsible Sections ── */
                .pe-collapsible {
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: var(--radius-md, 6px);
                    margin-bottom: 0.5rem;
                    overflow: hidden;
                }
                .pe-collapsible-trigger {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.7rem 0.875rem;
                    background: var(--color-surface-raised, #fafbfc);
                    border: none;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--color-gray-700, #374151);
                    transition: background 0.15s;
                }
                .pe-collapsible-trigger:hover { background: var(--color-gray-100, #f5f6f8); }
                .pe-collapsible-label { display: flex; align-items: center; gap: 0.5rem; }
                .pe-collapsible-body {
                    padding: 0.875rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    border-top: 1px solid var(--color-gray-200, #e5e7eb);
                }

                /* ── Nostr Publishing ── */
                .pe-publish-section { display: flex; flex-direction: column; gap: 0.75rem; }
                .pe-segmented {
                    display: flex;
                    border-radius: var(--radius-md, 6px);
                    overflow: hidden;
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                }
                .pe-segmented button {
                    flex: 1;
                    padding: 0.45rem 0.5rem;
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 0.78rem;
                    background: transparent;
                    color: var(--color-gray-500, #6b7280);
                    transition: all 0.15s;
                    white-space: nowrap;
                }
                .pe-segmented button + button { border-left: 1px solid var(--color-gray-200, #e5e7eb); }
                .pe-segmented button.active { background: #7c3aed; color: white; }
                .pe-help-btn-inline {
                    flex: 0 0 auto;
                    padding: 0.25rem 0.5rem;
                    background: none;
                    border: none;
                    border-left: 1px solid var(--color-gray-200, #e5e7eb);
                    color: var(--color-gray-400, #9ca3af);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }
                .pe-help-box {
                    background: var(--color-gray-100, #f9fafb);
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: var(--radius-md, 6px);
                    padding: 0.65rem 0.85rem;
                    font-size: 0.75rem;
                    color: var(--color-gray-600, #4b5563);
                    line-height: 1.5;
                }
                .pe-help-box p { margin: 0 0 0.25rem; }
                .pe-help-box strong { color: var(--color-gray-800, #1f2937); }
                .pe-publish-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    padding: 0.65rem 0.75rem;
                    background: #7c3aed;
                    color: white;
                    border: none;
                    border-radius: var(--radius-full, 9999px);
                    font-weight: 600;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .pe-publish-btn:hover { background: #6d28d9; }
                .pe-publish-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .pe-action-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
                .pe-action-btn {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.3rem;
                    padding: 0.5rem 0.5rem;
                    border-radius: var(--radius-md, 6px);
                    background: none;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 0.78rem;
                    white-space: nowrap;
                    transition: background 0.15s;
                }
                .pe-action-purple { border: 1px solid var(--color-gray-200, #e9d5ff); color: #a78bfa; }
                .pe-action-purple:hover { background: rgba(139, 92, 246, 0.08); }
                .pe-action-blue { border: 1px solid var(--color-gray-200, #bfdbfe); color: var(--color-primary, #2563eb); }
                .pe-action-blue:hover { background: rgba(37, 99, 235, 0.08); }
                .pe-action-green { border: 1px solid var(--color-gray-200, #bbf7d0); color: #22c55e; }
                .pe-action-green:hover { background: rgba(22, 163, 106, 0.08); }
                .pe-feed-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 0.75rem;
                    border-top: 1px solid var(--color-gray-200, #e5e7eb);
                    margin-top: 0.25rem;
                }

                /* ── Projects ── */
                .pe-project-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 0.5rem;
                }
                .pe-project-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.65rem 0.75rem;
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: var(--radius-md, 6px);
                    background: var(--color-surface, white);
                }
                .pe-project-added { background: var(--color-blue-tint, #f0f7ff); border-color: #bfdbfe; opacity: 0.7; }
                .pe-project-img { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
                .pe-project-img-placeholder {
                    background: var(--color-gray-100, #f3f4f6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    color: var(--color-gray-400, #9ca3af);
                    font-size: 0.85rem;
                }
                .pe-project-name { font-size: 0.8rem; font-weight: 700; color: var(--color-gray-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .pe-project-role { font-size: 0.7rem; font-weight: 600; color: var(--color-primary, #0052cc); }

                .role-selector {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .role-option {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    padding: 0.75rem 1rem;
                    border: 2px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.15s;
                    width: 100%;
                }
                .role-option:hover {
                    border-color: var(--color-primary);
                    background: var(--color-blue-tint);
                }
                .role-option.active {
                    border-color: var(--color-primary);
                    background: var(--color-blue-tint);
                }
                .role-option-label {
                    font-weight: 700;
                    font-size: 0.9rem;
                    color: var(--color-gray-700);
                }
                .role-option.active .role-option-label {
                    color: var(--color-primary);
                }
                .role-option-desc {
                    font-size: 0.78rem;
                    color: var(--color-gray-500);
                    margin-top: 2px;
                }
                .pe-project-add-btn {
                    padding: 0.3rem 0.6rem;
                    color: var(--color-primary, #0052cc);
                    background: none;
                    border: 1px solid var(--color-primary, #0052cc);
                    cursor: pointer;
                    border-radius: var(--radius-md, 6px);
                    font-size: 0.72rem;
                    font-weight: 600;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .pe-project-added-label { font-size: 0.7rem; color: var(--color-primary, #0052cc); font-weight: 600; flex-shrink: 0; }

                /* ── Dropdown ── */
                .pe-dropdown {
                    position: absolute;
                    z-index: 20;
                    margin-top: 0.35rem;
                    width: 100%;
                    background: var(--color-surface, white);
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: var(--radius-md, 6px);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
                    max-height: 200px;
                    overflow-y: auto;
                    padding: 0.25rem 0;
                }
                .pe-dropdown-item {
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    border: none;
                    background: none;
                    cursor: pointer;
                }
                .pe-dropdown-item:hover { background: var(--color-gray-100, #f9fafb); }
                .pe-dropdown-empty {
                    padding: 1rem 0.75rem;
                    text-align: center;
                    color: var(--color-gray-500, #6b7280);
                    font-size: 0.8rem;
                    font-style: italic;
                }

                /* ── Responsive ── */
                @media (max-width: 600px) {
                    .pe-container { padding: 0.75rem 0.75rem 2.5rem; gap: 0.75rem; }
                    .pe-card { padding: 1rem; }
                    .pe-field-grid { grid-template-columns: 1fr; gap: 0.6rem; }
                    .pe-banner { height: 120px; }
                    .pe-avatar { width: 72px; height: 72px; }
                    .pe-avatar-wrapper { margin-top: -36px; }
                    .pe-avatar-placeholder { font-size: 1.5rem; }
                    .pe-avatar-edit { width: 26px; height: 26px; }
                    .pe-banner-edit-text { display: none; }
                    .pe-action-row { flex-direction: column; }
                    .pe-action-btn { min-width: 100%; }
                    .pe-page-title { font-size: 1.25rem; }
                    .pe-segmented button { font-size: 0.72rem; padding: 0.35rem 0.25rem; }
                }

                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes progress-indeterminate {
                    0% { width: 0%; margin-left: 0%; }
                    50% { width: 60%; margin-left: 20%; }
                    100% { width: 0%; margin-left: 100%; }
                }

                /* ── Nostr sidebar fields ── */
                .pe-nostr-fields {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                    align-items: start;
                }
                .pe-nostr-fields .pe-label {
                    font-size: 0.72rem;
                    white-space: nowrap;
                }
                .pe-nostr-fields .pe-hint {
                    font-size: 0.68rem;
                }

                /* ── Dark Mode Overrides ── */
                [data-theme="dark"] .pe-page-title { color: #F8FAFC; }
                [data-theme="dark"] .pe-section-desc { color: #94A3B8; }
                [data-theme="dark"] .pe-label,
                [data-theme="dark"] .pe-label-sm { color: #CBD5E1; }
                [data-theme="dark"] .pe-hint { color: #94A3B8; }
                [data-theme="dark"] .pe-input {
                    background: #253349;
                    border-color: #475569;
                    color: #F8FAFC;
                }
                [data-theme="dark"] .pe-input-readonly {
                    background: #1E293B;
                    color: #CBD5E1;
                }
                [data-theme="dark"] .pe-card {
                    background: #1E293B;
                    border-color: #334155;
                }
                [data-theme="dark"] .pe-segmented {
                    border-color: #475569;
                }
                [data-theme="dark"] .pe-segmented button {
                    color: #94A3B8;
                }
                [data-theme="dark"] .pe-segmented button + button {
                    border-left-color: #475569;
                }
                [data-theme="dark"] .pe-help-box {
                    background: #253349;
                    border-color: #334155;
                    color: #CBD5E1;
                }
                [data-theme="dark"] .pe-help-box strong { color: #F1F5F9; }
                [data-theme="dark"] .pe-help-btn-inline {
                    color: #64748B;
                    border-left-color: #475569;
                }
                [data-theme="dark"] .pe-action-purple { border-color: #4c1d95; color: #a78bfa; }
                [data-theme="dark"] .pe-action-blue { border-color: #1e3a5f; color: #93C5FD; }
                [data-theme="dark"] .pe-action-green { border-color: #064E3B; color: #6EE7B7; }
                [data-theme="dark"] .pe-feed-toggle { border-top-color: #334155; }
                [data-theme="dark"] .pe-toggle-label { color: #94A3B8; }
                [data-theme="dark"] .pe-icon { color: #64748B; }
                [data-theme="dark"] .pe-tag { background: #052E16; color: #6EE7B7; }
                [data-theme="dark"] .pe-exp-item { border-left-color: #334155; }
                [data-theme="dark"] .pe-add-btn { border-color: #475569; color: #94A3B8; }
                [data-theme="dark"] .pe-project-item { border-color: #334155; background: #1E293B; }
                [data-theme="dark"] .pe-project-name { color: #F8FAFC; }
                [data-theme="dark"] .pe-dropdown { background: #1E293B; border-color: #334155; }
                [data-theme="dark"] .pe-dropdown-item:hover { background: #253349; }
                [data-theme="dark"] .pe-banner-edit { background: #253349; color: #E2E8F0; }
                [data-theme="dark"] .pe-avatar-edit { background: #253349; border-color: #334155; }
                [data-theme="dark"] .toggle-slider { background: #475569; border-color: #334155; }
                [data-theme="dark"] .pe-error { background: #450A0A; }
            `}</style>
        </div>
    );
};

export default ProfileEdit;

import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, MapPin, Phone, Instagram, Globe, Mail, ChevronRight,
    Loader2, Leaf, ShieldCheck, Edit3, AlertCircle,
    Sprout, RefreshCw, WheatOff, HeartHandshake,
} from 'lucide-react';
import { directoryApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getAssetUrl } from '../../utils/assets';
import TranslatableText from '../../components/TranslatableText';
import { getProduceIcon } from './produceIcons';

const PRACTICE_META = {
    'regenerative': { Icon: Sprout, tKey: 'directory.practices.regenerative' },
    'rotational-grazing': { Icon: RefreshCw, tKey: 'directory.practices.rotationalGrazing' },
    'no-gmo-feed': { Icon: WheatOff, tKey: 'directory.practices.noGmoFeed' },
    'animal-welfare': { Icon: HeartHandshake, tKey: 'directory.practices.animalWelfare' },
};

const sectionTitleStyle = {
    fontSize: '1.15rem',
    fontWeight: 700,
    margin: '0 0 0.85rem',
};

/**
 * Directory listing detail page per the mockup: full-width hero photo,
 * overlapping circular logo, name + location + WhatsApp rows, produce chips,
 * about text, practices row, and "Learn More" link rows.
 */
const ListingDetail = () => {
    const { id } = useParams();
    const location = useLocation();
    const { t } = useTranslation();
    const { user, isStaff } = useAuth();

    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const fetchListing = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await directoryApi.get(id);
                if (!cancelled) setListing(result?.data || result);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load listing');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchListing();
        return () => { cancelled = true; };
    }, [id]);

    const isProviderPath = location.pathname.startsWith('/discover/certified');
    const isFarm = listing ? listing.type === 'FARM' : !isProviderPath;
    const backPath = isFarm ? '/discover/farms' : '/discover/certified';

    if (loading) {
        return (
            <div className="listing-detail-page">
                <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', color: 'var(--color-gray-500)' }} />
                </div>
            </div>
        );
    }

    if (error || !listing) {
        return (
            <div className="listing-detail-page">
                <div className="container">
                    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                        <h2>{t('directory.notFound')}</h2>
                        <p style={{ color: 'var(--color-gray-500)', margin: '0.5rem 0' }}>
                            {t('directory.notFoundDesc')}
                        </p>
                        <Link
                            to={backPath}
                            style={{
                                marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: 8,
                                textDecoration: 'none', fontWeight: 500, color: 'var(--color-primary)',
                            }}
                        >
                            <ArrowLeft size={16} /> {t('directory.backToDirectory')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const isOwner = !!user?.id && listing.ownerId === user.id;
    const canEdit = isOwner || isStaff;
    const isPending = listing.status === 'pending-review';

    // WhatsApp link — digits only per wa.me requirements
    const contactNumber = listing.whatsapp || listing.phone || '';
    const waDigits = contactNumber.replace(/\D/g, '');

    const products = Array.isArray(listing.products) ? listing.products.filter((p) => p?.label) : [];
    const practices = (Array.isArray(listing.practices) ? listing.practices : []).filter((p) => PRACTICE_META[p]);
    const skills = Array.isArray(listing.skills) ? listing.skills.filter(Boolean) : [];

    // Learn More rows — only render entries with values
    const instagramValue = (listing.instagram || '').trim();
    const websiteValue = (listing.website || '').trim();
    const emailValue = (listing.email || '').trim();
    const learnMoreRows = [
        instagramValue && {
            key: 'instagram',
            Icon: Instagram,
            label: instagramValue.startsWith('http')
                ? instagramValue.replace(/^https?:\/\/(www\.)?/, '')
                : `@${instagramValue.replace(/^@/, '')}`,
            href: instagramValue.startsWith('http')
                ? instagramValue
                : `https://instagram.com/${encodeURIComponent(instagramValue.replace(/^@/, ''))}`,
            external: true,
        },
        websiteValue && {
            key: 'website',
            Icon: Globe,
            label: websiteValue.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
            href: /^https?:\/\//i.test(websiteValue) ? websiteValue : `https://${websiteValue}`,
            external: true,
        },
        emailValue && {
            key: 'email',
            Icon: Mail,
            label: emailValue,
            href: `mailto:${emailValue}`,
            external: false,
        },
    ].filter(Boolean);

    return (
        <div className="listing-detail-page">
            {/* Hero — full-bleed on mobile, 760px rounded column on desktop */}
            <div className="dir-hero-wrap">
                <div className="dir-hero">
                    {listing.photo ? (
                        <img src={getAssetUrl(listing.photo)} alt={listing.name} className="dir-hero-img" />
                    ) : (
                        <div className="dir-hero-fallback">
                            {isFarm ? <Leaf size={56} /> : <ShieldCheck size={56} />}
                        </div>
                    )}
                    <Link
                        to={backPath}
                        aria-label={t('directory.backToDirectory')}
                        style={{
                            position: 'absolute', top: 16, left: 16,
                            width: 42, height: 42, borderRadius: '50%',
                            background: 'var(--color-surface)', border: '1px solid var(--color-gray-200)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            textDecoration: 'none', color: 'var(--color-gray-700)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)', zIndex: 5,
                        }}
                    >
                        <ArrowLeft size={20} />
                    </Link>
                </div>
            </div>

            <div className="container">
                <div className="dir-content">
                    {/* Header — overlapping logo, name, location, WhatsApp */}
                    <div className="dir-detail-head">
                        {listing.logo && (
                            <div className="dir-detail-logo">
                                <img src={getAssetUrl(listing.logo)} alt={`${listing.name} logo`} />
                            </div>
                        )}

                        {isPending && (
                            <div className="dir-pending-banner">
                                <AlertCircle size={16} />
                                <span>{t('directory.pendingBanner')}</span>
                            </div>
                        )}

                        <div className="dir-head-row">
                            <h1 className="dir-detail-name">{listing.name}</h1>
                            {canEdit && (
                                <Link
                                    to={`/discover/directory/${listing.id}/edit`}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)',
                                        border: '1px solid var(--color-gray-300)', background: 'var(--color-surface)',
                                        color: 'var(--color-gray-700)', textDecoration: 'none',
                                        fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                                    }}
                                >
                                    <Edit3 size={14} /> {t('directory.editListing')}
                                </Link>
                            )}
                        </div>

                        {listing.location && (
                            <div className="dir-detail-meta">
                                <MapPin size={17} />
                                <span>{listing.location}</span>
                            </div>
                        )}
                        {contactNumber && waDigits && (
                            <a
                                className="dir-detail-meta dir-detail-wa"
                                href={`https://wa.me/${waDigits}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Phone size={17} />
                                <span>{contactNumber}</span>
                            </a>
                        )}
                    </div>

                    {isFarm ? (
                        <>
                            {/* What They Produce */}
                            {products.length > 0 && (
                                <section className="dir-detail-section">
                                    <h2 style={sectionTitleStyle}>{t('directory.whatTheyProduce')}</h2>
                                    <div className="dir-produce-chips">
                                        {products.map((product, i) => {
                                            const ProduceIcon = getProduceIcon(product);
                                            return (
                                                <span key={`${product.label}-${i}`} className="dir-produce-chip">
                                                    <ProduceIcon size={16} />
                                                    {product.label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* About the Farm */}
                            {listing.about && (
                                <section className="dir-detail-section">
                                    <TranslatableText
                                        title={t('directory.aboutFarm')}
                                        titleTag="h2"
                                        titleStyle={sectionTitleStyle}
                                        text={listing.about}
                                        style={{
                                            fontSize: '0.95rem', lineHeight: 1.7,
                                            color: 'var(--color-gray-700)', whiteSpace: 'pre-wrap',
                                        }}
                                    />
                                </section>
                            )}

                            {/* Practices row — icon above label, evenly spaced */}
                            {practices.length > 0 && (
                                <section className="dir-detail-section">
                                    <div className="dir-practices-row">
                                        {practices.map((p) => {
                                            const { Icon, tKey } = PRACTICE_META[p];
                                            return (
                                                <div key={p} className="dir-practice-item">
                                                    <div className="dir-practice-icon">
                                                        <Icon size={22} />
                                                    </div>
                                                    <span className="dir-practice-label">{t(tKey)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                        </>
                    ) : (
                        <>
                            {/* PROVIDER branch — minimal in A5, completed in Session A6 */}
                            {skills.length > 0 && (
                                <section className="dir-detail-section">
                                    <h2 style={sectionTitleStyle}>{t('directory.skillsLabel')}</h2>
                                    <div className="dir-produce-chips">
                                        {skills.map((skill) => (
                                            <span key={skill} className="dir-produce-chip">{skill}</span>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {listing.about && (
                                <section className="dir-detail-section">
                                    <TranslatableText
                                        title={t('directory.about')}
                                        titleTag="h2"
                                        titleStyle={sectionTitleStyle}
                                        text={listing.about}
                                        style={{
                                            fontSize: '0.95rem', lineHeight: 1.7,
                                            color: 'var(--color-gray-700)', whiteSpace: 'pre-wrap',
                                        }}
                                    />
                                </section>
                            )}

                            {/* A6: provider reputation/endorsements/zap */}
                        </>
                    )}

                    {/* Learn More */}
                    {learnMoreRows.length > 0 && (
                        <section className="dir-detail-section">
                            <h2 style={sectionTitleStyle}>{t('directory.learnMore')}</h2>
                            <div className="dir-learn-list">
                                {learnMoreRows.map(({ key, Icon, label, href, external }) => (
                                    <a
                                        key={key}
                                        className="dir-learn-row"
                                        href={href}
                                        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    >
                                        <span className="dir-learn-icon"><Icon size={18} /></span>
                                        <span className="dir-learn-label">{label}</span>
                                        <ChevronRight size={18} className="dir-learn-chevron" />
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            <style jsx>{`
                .listing-detail-page {
                    padding-bottom: 4rem;
                }

                .dir-hero-wrap {
                    max-width: 760px;
                    margin: 0 auto;
                }

                .dir-hero {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    overflow: hidden;
                    background: var(--color-blue-tint);
                }

                .dir-hero-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .dir-hero-fallback {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-primary);
                    opacity: 0.55;
                    background: linear-gradient(135deg, var(--color-blue-tint), var(--color-green-tint));
                }

                .dir-content {
                    max-width: 760px;
                    margin: 0 auto;
                }

                .dir-detail-head {
                    position: relative;
                    padding-top: 0.75rem;
                }

                .dir-detail-logo {
                    width: 88px;
                    height: 88px;
                    border-radius: 50%;
                    border: 4px solid var(--color-surface);
                    background: var(--color-surface);
                    overflow: hidden;
                    margin-top: -56px;
                    margin-bottom: 0.5rem;
                    position: relative;
                    z-index: 2;
                    box-shadow: var(--shadow-sm);
                }
                .dir-detail-logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .dir-pending-banner {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.65rem 0.9rem;
                    border-radius: var(--radius-md);
                    background: var(--color-orange-tint);
                    color: var(--badge-warning-text, #9a3412);
                    font-size: 0.85rem;
                    font-weight: 500;
                    margin-bottom: 0.85rem;
                }

                .dir-head-row {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 0.75rem;
                    margin-bottom: 0.5rem;
                }

                .dir-detail-name {
                    font-size: 1.75rem;
                    font-weight: 800;
                    margin: 0;
                    line-height: 1.2;
                    min-width: 0;
                    overflow-wrap: break-word;
                }

                .dir-detail-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--color-gray-600);
                    font-size: 0.95rem;
                    margin-bottom: 0.4rem;
                    min-width: 0;
                }
                .dir-detail-meta span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .dir-detail-wa {
                    color: var(--color-primary);
                    text-decoration: none;
                    font-weight: 500;
                    width: fit-content;
                }
                .dir-detail-wa:hover {
                    text-decoration: underline;
                }

                .dir-detail-section {
                    margin-top: 1.75rem;
                }

                .dir-produce-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.6rem;
                }

                .dir-produce-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    padding: 0.45rem 0.95rem;
                    border-radius: var(--radius-full);
                    background: var(--color-blue-tint);
                    color: var(--color-primary);
                    font-size: 0.87rem;
                    font-weight: 600;
                }

                .dir-practices-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                }

                .dir-practice-item {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    gap: 0.5rem;
                }

                .dir-practice-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: var(--color-green-tint);
                    color: var(--color-success, #16a34a);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .dir-practice-label {
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--color-gray-700);
                    line-height: 1.3;
                }

                .dir-learn-list {
                    display: flex;
                    flex-direction: column;
                }

                .dir-learn-row {
                    display: flex;
                    align-items: center;
                    gap: 0.85rem;
                    padding: 0.9rem 0.25rem;
                    text-decoration: none;
                    color: inherit;
                }
                .dir-learn-row + .dir-learn-row {
                    border-top: 1px solid var(--color-gray-200);
                }
                .dir-learn-row:hover .dir-learn-label {
                    color: var(--color-primary);
                }

                .dir-learn-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    background: var(--color-blue-tint);
                    color: var(--color-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .dir-learn-label {
                    flex: 1;
                    min-width: 0;
                    font-size: 0.92rem;
                    font-weight: 500;
                    color: var(--color-gray-700);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    transition: color 0.15s;
                }

                .dir-learn-chevron {
                    color: var(--color-gray-400);
                    flex-shrink: 0;
                }

                @media (min-width: 769px) {
                    .dir-hero-wrap {
                        padding-top: 1.5rem;
                    }
                    .dir-hero {
                        border-radius: var(--radius-lg);
                    }
                }

                @media (max-width: 360px) {
                    .dir-practices-row {
                        flex-wrap: wrap;
                    }
                    .dir-practice-item {
                        flex: 1 1 40%;
                        margin-bottom: 0.75rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default ListingDetail;

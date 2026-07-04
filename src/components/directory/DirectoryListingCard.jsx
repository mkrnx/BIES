import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, ChevronRight, Leaf, ShieldCheck, Bitcoin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAssetUrl } from '../../utils/assets';

/**
 * Directory listing card (list row) per the mockup:
 * rounded photo left, bold name, produce/skills summary in primary blue,
 * MapPin + Phone rows in gray, chevron at the right edge.
 * PROVIDER cards additionally show score pill / certified pill / BTC / pricing.
 *
 * @param {object} listing - parsed listing from directoryApi
 * @param {'FARM'|'PROVIDER'} type
 */
const DirectoryListingCard = ({ listing, type = 'FARM' }) => {
    const { t } = useTranslation();
    const isProvider = type === 'PROVIDER';
    const basePath = isProvider ? '/discover/certified' : '/discover/farms';

    const summary = isProvider
        ? (listing.skills || []).join(', ')
        : (listing.products || []).map((p) => p?.label).filter(Boolean).join(', ');

    const FallbackIcon = isProvider ? ShieldCheck : Leaf;

    return (
        /* styled-jsx only scopes DOM elements, so link resets are inline; the visual card is the div */
        <Link
            to={`${basePath}/${listing.id}`}
            className="dir-card-link"
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
            <div className="dir-card">
                <div className="dir-card-photo">
                    {listing.photo ? (
                        <img src={getAssetUrl(listing.photo)} alt={listing.name} />
                    ) : (
                        <div className="dir-card-photo-fallback">
                            <FallbackIcon size={28} />
                        </div>
                    )}
                </div>

                <div className="dir-card-info">
                    <h3 className="dir-card-name">{listing.name}</h3>
                    {summary && <p className="dir-card-summary">{summary}</p>}
                    {listing.location && (
                        <div className="dir-card-meta">
                            <MapPin size={14} />
                            <span>{listing.location}</span>
                        </div>
                    )}
                    {listing.phone && (
                        <div className="dir-card-meta">
                            <Phone size={14} />
                            <span>{listing.phone}</span>
                        </div>
                    )}

                    {isProvider && (
                        <div className="dir-card-pills">
                            {typeof listing.reputationScore === 'number' && (
                                <span className="dir-score-pill">{listing.reputationScore}%</span>
                            )}
                            {listing.isCertified && (
                                /* Placeholder pill — replaced by <CertifiedBadge/> in Session A6 */
                                <span className="dir-certified-pill">
                                    <ShieldCheck size={12} />
                                    {t('directory.certifiedBadge')}
                                </span>
                            )}
                            {listing.btcAccepted && (
                                <Bitcoin size={15} className="dir-btc-icon" aria-label={t('directory.btcAccepted')} />
                            )}
                            {listing.pricing && <span className="dir-card-pricing">{listing.pricing}</span>}
                        </div>
                    )}
                </div>

                <ChevronRight size={20} className="dir-card-chevron" />
            </div>

            <style jsx>{`
                .dir-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--color-surface);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
                }
                .dir-card:hover {
                    transform: translateY(-1px);
                    box-shadow: var(--shadow-md);
                    border-color: var(--color-primary);
                }
                .dir-card-photo {
                    width: 80px;
                    height: 80px;
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    flex-shrink: 0;
                    background: var(--color-blue-tint);
                }
                .dir-card-photo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                .dir-card-photo-fallback {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-primary);
                }
                .dir-card-info {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .dir-card-name {
                    font-size: 1.05rem;
                    font-weight: 700;
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .dir-card-summary {
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--color-primary);
                    margin: 0;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .dir-card-meta {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    color: var(--color-gray-500);
                    min-width: 0;
                }
                .dir-card-meta span {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .dir-card-chevron {
                    color: var(--color-gray-400);
                    flex-shrink: 0;
                }
                .dir-card-pills {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 2px;
                }
                .dir-score-pill {
                    background: var(--color-blue-tint);
                    color: var(--color-primary);
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                }
                .dir-certified-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: var(--color-primary);
                    color: white;
                    font-size: 0.7rem;
                    font-weight: 600;
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                }
                .dir-btc-icon {
                    color: #f7931a;
                    flex-shrink: 0;
                }
                .dir-card-pricing {
                    font-size: 0.75rem;
                    color: var(--color-gray-500);
                }
            `}</style>
        </Link>
    );
};

export default DirectoryListingCard;

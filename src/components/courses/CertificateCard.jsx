import React from 'react';
import { Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAssetUrl } from '../../utils/assets';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return String(dateStr);
    }
};

const CertificateCard = ({ courseTitle, coverImage, issuedAt, certificateEventId }) => {
    const { t } = useTranslation();

    return (
        <div className="cert-card">
            {coverImage && (
                <div className="cert-cover">
                    <img src={getAssetUrl(coverImage)} alt={courseTitle || ''} />
                </div>
            )}

            <div className="cert-body">
                <div className="cert-badge">
                    <Award size={26} />
                </div>
                <div className="cert-info">
                    <span className="cert-eyebrow">{t('courses.certificate.title')}</span>
                    <h3 className="cert-title">{courseTitle}</h3>
                    {issuedAt && (
                        <p className="cert-issued">
                            {t('courses.certificate.issuedOn', { date: formatDate(issuedAt) })}
                        </p>
                    )}
                    {certificateEventId && (
                        <span className="cert-nip" title={certificateEventId}>
                            NIP-58 · {certificateEventId.slice(0, 12)}…
                        </span>
                    )}
                </div>
            </div>

            <style jsx>{`
                .cert-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    box-shadow: var(--shadow-sm);
                    border-top: 3px solid var(--color-warning);
                }
                .cert-cover {
                    width: 100%;
                    height: 110px;
                    overflow: hidden;
                }
                .cert-cover img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                .cert-body {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    padding: 1.25rem 1.5rem;
                }
                .cert-badge {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 52px;
                    height: 52px;
                    border-radius: 50%;
                    background: var(--color-amber-tint);
                    color: var(--color-warning);
                }
                .cert-info {
                    min-width: 0;
                }
                .cert-eyebrow {
                    display: inline-block;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--color-warning);
                    margin-bottom: 0.25rem;
                }
                .cert-title {
                    margin: 0 0 0.35rem;
                    font-size: 1.1rem;
                    font-weight: 700;
                    line-height: 1.3;
                    color: var(--color-gray-900);
                    overflow-wrap: break-word;
                }
                .cert-issued {
                    margin: 0;
                    font-size: 0.85rem;
                    color: var(--color-gray-500);
                }
                .cert-nip {
                    display: inline-block;
                    margin-top: 0.5rem;
                    padding: 0.15rem 0.5rem;
                    border-radius: var(--radius-full);
                    background: var(--color-gray-100);
                    color: var(--color-gray-400);
                    font-family: var(--font-mono);
                    font-size: 0.7rem;
                    white-space: nowrap;
                }
            `}</style>
        </div>
    );
};

export default CertificateCard;

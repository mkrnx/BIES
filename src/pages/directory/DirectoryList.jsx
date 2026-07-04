import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal, Plus, Leaf, ShieldCheck, Loader2 } from 'lucide-react';
import { directoryApi } from '../../services/api';
import DirectoryListingCard from '../../components/directory/DirectoryListingCard';

const FARM_PRACTICES = [
    { id: 'regenerative', tKey: 'directory.practices.regenerative' },
    { id: 'rotational-grazing', tKey: 'directory.practices.rotationalGrazing' },
    { id: 'no-gmo-feed', tKey: 'directory.practices.noGmoFeed' },
    { id: 'animal-welfare', tKey: 'directory.practices.animalWelfare' },
];

/**
 * Directory list page per the mockup: search row with filter toggle and
 * circular "+" button, tinted section header, listing cards.
 *
 * @param {'FARM'|'PROVIDER'} type
 */
const DirectoryList = ({ type = 'FARM' }) => {
    const { t } = useTranslation();
    const isFarm = type === 'FARM';

    const [searchQuery, setSearchQuery] = useState('');
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Farm filters
    const [selectedPractices, setSelectedPractices] = useState([]);
    // Shared / provider filters
    const [certifiedOnly, setCertifiedOnly] = useState(false);
    const [btcOnly, setBtcOnly] = useState(false);
    const [minScore, setMinScore] = useState('');

    // Reset state when switching between /discover/farms and /discover/certified
    useEffect(() => {
        setSearchQuery('');
        setSelectedPractices([]);
        setCertifiedOnly(false);
        setBtcOnly(false);
        setMinScore('');
        setFiltersOpen(false);
    }, [type]);

    // Fetch listings (same 300ms debounce pattern as Discover)
    useEffect(() => {
        const fetchListings = async () => {
            setLoading(true);
            try {
                const params = { type };
                if (searchQuery) params.search = searchQuery;
                const result = await directoryApi.list(params);
                const list = result?.data || result || [];
                setListings(Array.isArray(list) ? list : []);
            } catch {
                setListings([]);
            } finally {
                setLoading(false);
            }
        };
        const debounce = setTimeout(fetchListings, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery, type]);

    // Client-side filtering (minimal drawer for now)
    const filtered = listings.filter((l) => {
        if (certifiedOnly && !l.isCertified) return false;
        if (isFarm) {
            if (selectedPractices.length > 0) {
                const practices = l.practices || [];
                if (!selectedPractices.some((p) => practices.includes(p))) return false;
            }
        } else {
            if (btcOnly && !l.btcAccepted) return false;
            if (minScore && (l.reputationScore || 0) < Number(minScore)) return false;
        }
        return true;
    });

    const activeFilterCount = (isFarm ? selectedPractices.length : (btcOnly ? 1 : 0) + (minScore ? 1 : 0)) + (certifiedOnly ? 1 : 0);

    const togglePractice = (id) => {
        setSelectedPractices((prev) =>
            prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        );
    };

    return (
        <div className="directory-page container">
            {/* Desktop-only header — navbar shows the title on mobile */}
            <h1 className="page-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                {isFarm ? t('pageTitles.farmDirectory') : t('pageTitles.certifiedDirectory')}
            </h1>

            <div className="dir-content">
                {/* Search row */}
                <div className="dir-search-row">
                    <div className="dir-search-bar">
                        <Search size={20} className="dir-search-icon" />
                        <input
                            type="text"
                            className="dir-search-input"
                            placeholder={isFarm ? t('directory.searchFarms') : t('directory.searchProviders')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            className="dir-filter-toggle"
                            onClick={() => setFiltersOpen(!filtersOpen)}
                            aria-label={t('common.filters')}
                        >
                            <SlidersHorizontal size={20} />
                            {activeFilterCount > 0 && <span className="dir-filter-badge">{activeFilterCount}</span>}
                        </button>
                    </div>
                    <Link
                        to={`/discover/directory/new?type=${isFarm ? 'farm' : 'provider'}`}
                        className="directory-add-btn"
                        title={t('directory.addListing')}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 44, height: 44, minWidth: 44, borderRadius: '50%',
                            background: 'var(--color-primary)', color: 'white', textDecoration: 'none', flexShrink: 0
                        }}
                    >
                        <Plus size={24} strokeWidth={2.5} />
                    </Link>
                </div>

                {/* Filter drawer (minimal for now) */}
                {filtersOpen && (
                    <div className="dir-filters">
                        {isFarm ? (
                            <>
                                <div className="dir-filter-group">
                                    <span className="dir-filter-label">{t('directory.practicesLabel')}</span>
                                    <div className="dir-checkbox-list">
                                        {FARM_PRACTICES.map((p) => (
                                            <label key={p.id}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPractices.includes(p.id)}
                                                    onChange={() => togglePractice(p.id)}
                                                />
                                                {t(p.tKey)}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="dir-checkbox-list">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={certifiedOnly}
                                            onChange={() => setCertifiedOnly(!certifiedOnly)}
                                        />
                                        {t('directory.certifiedOnly')}
                                    </label>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="dir-checkbox-list">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={btcOnly}
                                            onChange={() => setBtcOnly(!btcOnly)}
                                        />
                                        {t('directory.acceptsBitcoin')}
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={certifiedOnly}
                                            onChange={() => setCertifiedOnly(!certifiedOnly)}
                                        />
                                        {t('directory.certifiedOnly')}
                                    </label>
                                </div>
                                <div className="dir-filter-group">
                                    <span className="dir-filter-label">{t('directory.minScore')}</span>
                                    <select
                                        className="dir-score-select"
                                        value={minScore}
                                        onChange={(e) => setMinScore(e.target.value)}
                                    >
                                        <option value="">{t('directory.anyScore')}</option>
                                        <option value="50">50%+</option>
                                        <option value="70">70%+</option>
                                        <option value="90">90%+</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Section header */}
                <div className="dir-section-header">
                    <div className="dir-section-icon">
                        {isFarm ? <Leaf size={20} /> : <ShieldCheck size={20} />}
                    </div>
                    <div className="dir-section-text">
                        <h2>{isFarm ? t('directory.sectionFarms') : t('directory.sectionCertified')}</h2>
                        <p>{isFarm ? t('directory.sectionFarmsSub') : t('directory.sectionCertifiedSub')}</p>
                    </div>
                </div>

                {/* Listing cards */}
                {loading ? (
                    <div className="dir-loading">
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="dir-list">
                        {filtered.map((listing) => (
                            <DirectoryListingCard key={listing.id} listing={listing} type={type} />
                        ))}
                    </div>
                ) : (
                    <div className="dir-empty">
                        {searchQuery
                            ? t('directory.noResultsSearch', { query: searchQuery })
                            : isFarm ? t('directory.noFarms') : t('directory.noProviders')}
                    </div>
                )}
            </div>

            <style jsx>{`
                .directory-page {
                    padding-top: 2rem;
                    padding-bottom: 4rem;
                    box-sizing: border-box;
                }

                .dir-content {
                    max-width: 760px;
                    margin: 0 auto;
                }

                .dir-search-row {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }

                .dir-search-bar {
                    display: flex;
                    align-items: center;
                    flex: 1;
                    min-width: 0;
                    background: var(--color-surface-raised);
                    padding: 0.5rem;
                    border-radius: var(--radius-full);
                    border: 1px solid var(--color-gray-200);
                    box-shadow: var(--shadow-sm);
                    transition: all 0.2s;
                }
                .dir-search-bar:focus-within {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(0, 71, 171, 0.1);
                }

                .dir-search-icon {
                    margin-left: 0.75rem;
                    color: var(--color-gray-400);
                    flex-shrink: 0;
                }

                .dir-search-input {
                    flex: 1;
                    min-width: 0;
                    border: none;
                    background: none;
                    padding: 0.5rem 0.75rem;
                    outline: none;
                    font-size: 1rem;
                    color: inherit;
                }

                .dir-filter-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: none;
                    background: none;
                    color: var(--color-gray-500);
                    cursor: pointer;
                    flex-shrink: 0;
                    position: relative;
                }
                .dir-filter-badge {
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: var(--color-secondary);
                    color: white;
                    font-size: 0.65rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .dir-filters {
                    background: var(--color-surface);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-lg);
                    padding: 1rem 1.25rem;
                    margin-bottom: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .dir-filter-label {
                    display: block;
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }

                .dir-checkbox-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    align-items: flex-start;
                }
                .dir-checkbox-list label {
                    font-weight: normal;
                    font-size: 0.9rem;
                    color: var(--color-gray-600);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    margin: 0;
                }
                .dir-checkbox-list input[type='checkbox'] {
                    width: 16px;
                    height: 16px;
                    margin: 0;
                    accent-color: var(--color-primary);
                    cursor: pointer;
                }

                .dir-score-select {
                    padding: 0.5rem;
                    border-radius: var(--radius-md);
                    border: 1px solid var(--color-gray-300);
                    background: var(--color-surface);
                    color: inherit;
                    font-size: 0.85rem;
                    max-width: 200px;
                }

                .dir-section-header {
                    display: flex;
                    align-items: center;
                    gap: 0.85rem;
                    margin-bottom: 1.25rem;
                }
                .dir-section-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: var(--color-blue-tint);
                    color: var(--color-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .dir-section-text {
                    min-width: 0;
                }
                .dir-section-text h2 {
                    font-size: 1.15rem;
                    font-weight: 700;
                    margin: 0;
                }
                .dir-section-text p {
                    font-size: 0.85rem;
                    color: var(--color-gray-500);
                    margin: 2px 0 0;
                }

                .dir-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .dir-loading {
                    display: flex;
                    justify-content: center;
                    padding: 3rem;
                    color: var(--color-gray-500);
                }

                .dir-empty {
                    text-align: center;
                    padding: 3rem 1rem;
                    color: var(--color-gray-500);
                }

                @media (max-width: 768px) {
                    .page-header {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default DirectoryList;

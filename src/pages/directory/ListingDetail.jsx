import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Directory listing detail page.
 * Placeholder — the full detail page (hero, produce chips, practices,
 * Learn More rows, provider reputation block) arrives in Session A5.
 */
const ListingDetail = () => {
    const { t } = useTranslation();

    return (
        <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
            {t('directory.comingSoon')}
        </div>
    );
};

export default ListingDetail;

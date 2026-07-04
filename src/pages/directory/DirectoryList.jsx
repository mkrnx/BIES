import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Directory list page (FARM | PROVIDER).
 * Stub — full mockup implementation lands in the next commit.
 */
const DirectoryList = ({ type = 'FARM' }) => {
    const { t } = useTranslation();

    return (
        <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
            {type === 'FARM' ? t('pageTitles.farmDirectory') : t('pageTitles.certifiedDirectory')}
        </div>
    );
};

export default DirectoryList;

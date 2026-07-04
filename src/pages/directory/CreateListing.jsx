import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Directory listing create/edit form.
 * Placeholder — the full form (uploads, produce-chip editor, practices,
 * provider fields, review confirmation) arrives in Session A5.
 *
 * @param {boolean} editMode - true when mounted at /discover/directory/:id/edit
 */
const CreateListing = ({ editMode = false }) => {
    const { t } = useTranslation();

    return (
        <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
            {t('directory.comingSoon')}
            {editMode ? ' (edit)' : ''}
        </div>
    );
};

export default CreateListing;

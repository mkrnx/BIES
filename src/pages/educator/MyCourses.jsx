import React from 'react';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MyCourses = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="page-title-block" style={{
        margin: '0 0 2rem',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: 'var(--color-gray-800)',
      }}>
        {t('dashboard.myCourses')}
      </h1>

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-gray-200)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '4rem 2rem',
        textAlign: 'center',
        color: 'var(--color-gray-500)',
      }}>
        <BookOpen size={48} style={{ color: 'var(--color-gray-300)', marginBottom: '1rem' }} />
        <h2 style={{
          margin: '0 0 0.5rem',
          fontSize: '1.15rem',
          fontWeight: 600,
          color: 'var(--color-gray-700)',
        }}>
          Coming Soon
        </h2>
        <p style={{ margin: 0, fontSize: '0.95rem', maxWidth: '360px', marginInline: 'auto' }}>
          We're building something great. Courses will be available here soon — stay tuned!
        </p>
      </div>
    </div>
  );
};

export default MyCourses;

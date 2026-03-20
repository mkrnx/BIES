import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Eye, Plus, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const EducatorOverview = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const displayName = user?.profile?.name || 'Educator';

  const stats = [
    {
      label: t('dashboard.totalCourses'),
      value: 0,
      icon: BookOpen,
      color: 'var(--color-primary)',
      tint: 'var(--color-blue-tint)',
    },
    {
      label: t('dashboard.totalStudents'),
      value: 0,
      icon: Users,
      color: '#16a34a',
      tint: 'rgba(22, 163, 74, 0.08)',
    },
    {
      label: t('dashboard.totalViews'),
      value: 0,
      icon: Eye,
      color: '#7c3aed',
      tint: 'rgba(124, 58, 237, 0.08)',
    },
  ];

  return (
    <>
      {/* Welcome Card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        marginBottom: '2rem',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
      }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <GraduationCap size={26} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
            {t('dashboard.educatorWelcome', { name: displayName })}
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem' }}>
            {t('dashboard.shareKnowledge')}
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.5rem',
        marginBottom: '2.5rem',
      }}>
        {stats.map(({ label, value, icon: Icon, color, tint }) => (
          <div key={label} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-gray-200)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', fontWeight: 500 }}>
                {label}
              </span>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
              }}>
                <Icon size={18} />
              </div>
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-gray-800)',
            }}>
              {value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* My Courses Section */}
      <section>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-gray-800)' }}>
            {t('dashboard.myCourses')}
          </h2>
          <Link
            to="/dashboard/educator/new-course"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 1rem',
              background: 'var(--color-primary)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <Plus size={16} /> {t('dashboard.newCourse')}
          </Link>
        </div>

        {/* Empty state */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-gray-200)',
          borderRadius: 'var(--radius-lg)',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--color-gray-500)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <BookOpen size={40} style={{ color: 'var(--color-gray-300)', marginBottom: '1rem' }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            {t('dashboard.noCourses')}
          </p>
          <Link
            to="/dashboard/educator/new-course"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '1.25rem',
              padding: '0.6rem 1.25rem',
              background: 'var(--color-primary)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <Plus size={16} /> {t('dashboard.createFirstCourse')}
          </Link>
        </div>
      </section>

      <style>{`
        @media (max-width: 768px) {
          .edu-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
};

export default EducatorOverview;

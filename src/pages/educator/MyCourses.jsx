import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Edit, Trash2, Eye, Users, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const MyCourses = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock: no real API yet — start with empty list
    const timer = setTimeout(() => {
      setCourses([]);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [user?.id]);

  const handleDelete = (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--color-gray-800)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            {t('dashboard.myCourses')}
            {/* Mobile icon button */}
            <Link
              to="/dashboard/educator/new-course"
              className="hide-on-desktop"
              title={t('dashboard.newCourse')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--color-primary)',
                color: 'white',
                textDecoration: 'none',
                marginLeft: 'auto',
              }}
            >
              <Plus size={18} />
            </Link>
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-gray-500)' }}>
            {t('dashboard.manageContent')}
          </p>
        </div>
        {/* Desktop button */}
        <Link
          to="/dashboard/educator/new-course"
          className="hide-on-mobile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.25rem',
            background: 'var(--color-primary)',
            color: 'white',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <Plus size={18} /> {t('dashboard.newCourse')}
        </Link>
      </div>

      {/* Content */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-gray-200)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}>
        {courses.length === 0 ? (
          <div style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: 'var(--color-gray-500)',
          }}>
            <BookOpen size={44} style={{ color: 'var(--color-gray-300)', marginBottom: '1rem' }} />
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.95rem' }}>
              {t('dashboard.noCoursesYet')}
            </p>
            <Link
              to="/dashboard/educator/new-course"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.6rem 1.25rem',
                background: 'var(--color-primary)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              <Plus size={16} /> {t('dashboard.createCourse')}
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 0 }}>
            {courses.map((course, idx) => (
              <div
                key={course.id}
                style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: idx < courses.length - 1 ? '1px solid var(--color-gray-100)' : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                }}
              >
                {/* Cover thumbnail */}
                <div style={{
                  width: '80px',
                  height: '56px',
                  borderRadius: '8px',
                  background: 'var(--color-gray-100)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gray-300)',
                }}>
                  {course.coverImage ? (
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <BookOpen size={22} />
                  )}
                </div>

                {/* Course info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      color: 'var(--color-gray-800)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {course.title}
                    </span>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '99px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      background: course.status === 'published'
                        ? 'var(--badge-success-bg)'
                        : 'var(--badge-draft-bg)',
                      color: course.status === 'published'
                        ? 'var(--badge-success-text)'
                        : 'var(--badge-draft-text)',
                    }}>
                      {course.status || 'draft'}
                    </span>
                  </div>
                  <p style={{
                    margin: '0 0 0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--color-gray-500)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {course.description || t('admin.noDescription')}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-gray-400)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={13} /> {course.studentCount || 0} {t('dashboard.students')}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    onClick={() => navigate(`/dashboard/educator/new-course?edit=${course.id}`)}
                    title={t('common.edit')}
                    style={{
                      width: '34px',
                      height: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--color-gray-200)',
                      borderRadius: '8px',
                      background: 'none',
                      color: 'var(--color-gray-500)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-gray-100)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-gray-500)'; }}
                  >
                    <Edit size={15} />
                  </button>
                  <Link
                    to={`/course/${course.id}`}
                    title={t('admin.view')}
                    style={{
                      width: '34px',
                      height: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--color-gray-200)',
                      borderRadius: '8px',
                      color: 'var(--color-gray-500)',
                      textDecoration: 'none',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-gray-100)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    <Eye size={15} />
                  </Link>
                  <button
                    onClick={() => handleDelete(course.id, course.title)}
                    title={t('common.delete')}
                    style={{
                      width: '34px',
                      height: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid transparent',
                      borderRadius: '8px',
                      background: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-red-tint)'; e.currentTarget.style.borderColor = '#fecaca'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .hide-on-desktop { display: flex !important; }
          .hide-on-mobile { display: none !important; }
        }
        @media (min-width: 769px) {
          .hide-on-desktop { display: none !important; }
          .hide-on-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default MyCourses;

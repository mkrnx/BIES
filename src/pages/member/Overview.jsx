import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Heart, CalendarDays, MessageSquare, Compass, ArrowRight, BookOpen, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { MOCK_COURSES } from './MyCourses';

const ENROLLED_IDS = ['c1', 'c2'];

const MemberOverview = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const statCards = [
    { label: t('dashboard.coursesEnrolled'), value: ENROLLED_IDS.length, icon: BookOpen, color: '#7c3aed', tint: 'rgba(124,58,237,0.1)' },
    { label: t('dashboard.following'), value: 0, icon: Heart, color: 'var(--color-primary)', tint: 'var(--color-blue-tint)' },
    { label: t('dashboard.eventsAttended'), value: 0, icon: CalendarDays, color: '#16a34a', tint: 'var(--color-green-tint)' },
    { label: t('dashboard.messages'), value: 0, icon: MessageSquare, color: 'var(--color-secondary)', tint: 'var(--color-orange-tint)' },
  ];

  const quickActions = [
    {
      to: '/discover',
      label: t('dashboard.discoverProjects'),
      description: t('dashboard.browseProjects'),
      icon: Compass,
    },
    {
      to: '/members',
      label: t('dashboard.meetMembers'),
      description: t('dashboard.connectWithMembers'),
      icon: Heart,
    },
    {
      to: '/events',
      label: t('dashboard.upcomingEvents'),
      description: t('dashboard.attendEvents'),
      icon: CalendarDays,
    },
  ];
  const displayName = user?.profile?.name || 'Member';
  const enrolledCourses = MOCK_COURSES.filter(c => ENROLLED_IDS.includes(c.id));
  const inProgress = enrolledCourses.filter(c => {
    const done = c.lessons.filter(l => l.completed).length;
    return done > 0 && done < c.lessons.length;
  });

  return (
    <div className="member-overview">
      {/* Welcome Card */}
      <div className="welcome-card">
        <div className="welcome-icon">
          <LayoutDashboard size={28} />
        </div>
        <div className="welcome-text">
          <h2 className="welcome-title">{t('dashboard.memberWelcome', { name: displayName })}</h2>
          <p className="welcome-body">
            {t('dashboard.memberWelcomeBody')}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {statCards.map(({ label, value, icon: Icon, color, tint }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: tint, color }}>
              <Icon size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{value}</span>
              <span className="stat-label">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* In-Progress Courses */}
      {inProgress.length > 0 && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title">{t('dashboard.continueLearning')}</h3>
            <Link to="/dashboard/member/courses" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>{t('common.viewAll')} →</Link>
          </div>
          <div className="actions-grid">
            {inProgress.map(course => {
              const done = course.lessons.filter(l => l.completed).length;
              const pct = Math.round((done / course.lessons.length) * 100);
              const next = course.lessons.find(l => !l.completed);
              return (
                <Link key={course.id} to="/dashboard/member/courses" className="action-card">
                  <div className="action-icon" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                    <BookOpen size={20} />
                  </div>
                  <div className="action-text">
                    <span className="action-label">{course.title}</span>
                    <div style={{ marginTop: '0.3rem' }}>
                      <div style={{ height: 4, background: 'var(--color-gray-200)', borderRadius: 99, overflow: 'hidden', marginBottom: '0.25rem' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#7c3aed', borderRadius: 99 }} />
                      </div>
                      <span className="action-desc">{pct}% · Next: {next?.title}</span>
                    </div>
                  </div>
                  <PlayCircle size={18} className="action-arrow" style={{ color: '#7c3aed' }} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="section">
        <h3 className="section-title">{t('dashboard.explorePlatform')}</h3>
        <div className="actions-grid">
          {quickActions.map(({ to, label, description, icon: Icon }) => (
            <Link key={to} to={to} className="action-card">
              <div className="action-icon">
                <Icon size={20} />
              </div>
              <div className="action-text">
                <span className="action-label">{label}</span>
                <span className="action-desc">{description}</span>
              </div>
              <ArrowRight size={18} className="action-arrow" />
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .member-overview {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          max-width: 860px;
        }

        /* Welcome Card */
        .welcome-card {
          display: flex;
          align-items: flex-start;
          gap: 1.25rem;
          background: var(--color-surface);
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-lg);
          padding: 1.75rem 2rem;
        }

        .welcome-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: var(--radius-md);
          background: var(--color-blue-tint);
          color: var(--color-primary);
          flex-shrink: 0;
        }

        .welcome-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 0.4rem;
        }

        .welcome-body {
          font-size: 0.95rem;
          color: var(--color-gray-500);
          margin: 0;
          line-height: 1.6;
        }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: var(--color-surface);
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-lg);
          padding: 1.25rem 1.5rem;
        }

        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .stat-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--color-text);
          line-height: 1;
        }

        .stat-label {
          font-size: 0.82rem;
          color: var(--color-gray-400);
          font-weight: 500;
        }

        /* Section */
        .section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .section-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text);
          margin: 0;
        }

        /* Action Cards */
        .actions-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .action-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: var(--color-surface);
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-lg);
          padding: 1.1rem 1.5rem;
          text-decoration: none;
          transition: all 0.2s;
        }

        .action-card:hover {
          border-color: var(--color-primary);
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }

        .action-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: var(--color-blue-tint);
          color: var(--color-primary);
          flex-shrink: 0;
        }

        .action-text {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
        }

        .action-label {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .action-desc {
          font-size: 0.82rem;
          color: var(--color-gray-400);
        }

        .action-arrow {
          color: var(--color-gray-300);
          flex-shrink: 0;
          transition: color 0.2s, transform 0.2s;
        }

        .action-card:hover .action-arrow {
          color: var(--color-primary);
          transform: translateX(3px);
        }

        @media (max-width: 768px) {
          .member-overview { gap: 1.25rem; }

          .welcome-card {
            flex-direction: column;
            gap: 1rem;
            padding: 1.25rem;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .action-card { padding: 1rem 1.25rem; }
        }
      `}</style>
    </div>
  );
};

export default MemberOverview;

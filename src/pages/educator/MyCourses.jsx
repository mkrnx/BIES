import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, BookOpen, Loader2, CheckCircle, Award, GraduationCap } from 'lucide-react';
import { coursesApi } from '../../services/api';
import { useApiQuery } from '../../hooks/useApi';
import { getAssetUrl } from '../../utils/assets';

const STATUS_CFG = {
    'draft': { tKey: 'courses.status.draft', color: 'var(--badge-draft-text)', bg: 'var(--badge-draft-bg)' },
    'pending-review': { tKey: 'courses.status.pendingReview', color: 'var(--badge-warning-text)', bg: 'var(--badge-warning-bg)' },
    'active': { tKey: 'courses.status.active', color: 'var(--badge-success-text)', bg: 'var(--badge-success-bg)' },
    'rejected': { tKey: 'courses.status.rejected', color: 'var(--badge-error-text)', bg: 'var(--badge-error-bg)' },
};

const StatusChip = ({ status }) => {
    const { t } = useTranslation();
    const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
    return (
        <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 99,
            fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
            color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap',
        }}>
            {t(cfg.tKey)}
        </span>
    );
};

const MyCourses = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tab, setTab] = useState('enrolled'); // 'enrolled' | 'teaching'

    const { data: enrolledData, loading: enrolledLoading } = useApiQuery(coursesApi.listEnrolled);
    const { data: mineData, loading: mineLoading } = useApiQuery(coursesApi.listMine);

    const enrolledList = Array.isArray(enrolledData?.data) ? enrolledData.data : Array.isArray(enrolledData) ? enrolledData : [];
    const teachingList = Array.isArray(mineData?.data) ? mineData.data : Array.isArray(mineData) ? mineData : [];

    if (enrolledLoading && mineLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                            <span className="page-title-block">{t('dashboard.myCourses')}</span>
                            <Link
                                to="/dashboard/builder/new-course"
                                className="hide-on-desktop"
                                title={t('dashboard.createCourse')}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary)', color: 'white', textDecoration: 'none', marginLeft: 'auto' }}
                            >
                                <Plus size={18} strokeWidth={2.5} />
                            </Link>
                        </h1>
                        <p className="subtitle page-title-block">{t('dashboard.trackLearningProgress')}</p>
                    </div>
                    <Link to="/dashboard/builder/new-course" className="btn btn-primary hide-on-mobile" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                        <Plus size={18} style={{ marginRight: 8 }} /> {t('dashboard.createCourse')}
                    </Link>
                </div>
            </div>

            <div className="card-container">
                <div className="toolbar">
                    <div className="tabs">
                        <button className={`tab ${tab === 'enrolled' ? 'active' : ''}`} onClick={() => setTab('enrolled')}>
                            {t('courses.enrolledTab')}
                        </button>
                        <button className={`tab ${tab === 'teaching' ? 'active' : ''}`} onClick={() => setTab('teaching')}>
                            {t('courses.teaching')}
                        </button>
                    </div>
                </div>

                {tab === 'enrolled' ? (
                    enrolledLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : enrolledList.length === 0 ? (
                        <div style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
                            <GraduationCap size={44} style={{ color: 'var(--color-gray-300)', marginBottom: '0.75rem' }} />
                            <p style={{ margin: '0 0 1.25rem' }}>{t('dashboard.noEnrolled')}</p>
                            <Link to="/courses" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                                {t('dashboard.browseCourses')}
                            </Link>
                        </div>
                    ) : (
                        <div className="course-grid">
                            {enrolledList.map(course => {
                                const total = course.lessonCount || 0;
                                const completed = course.completedLessons || 0;
                                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                                const isComplete = !!course.completedAt;
                                return (
                                    <Link key={course.id} to={`/courses/${course.id}`} className="course-card">
                                        <div
                                            className="course-cover"
                                            style={course.coverImage ? { backgroundImage: `url(${getAssetUrl(course.coverImage)})` } : undefined}
                                        >
                                            {!course.coverImage && <BookOpen size={30} style={{ color: 'var(--color-gray-400)' }} />}
                                            {isComplete && (
                                                <span className="complete-badge">
                                                    <CheckCircle size={12} /> {t('courses.completedLesson')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="course-card-body">
                                            <h3 className="course-card-title">{course.title}</h3>
                                            <div className="progress-track">
                                                <div
                                                    className="progress-fill"
                                                    style={{ width: `${Math.min(pct, 100)}%`, background: isComplete ? 'var(--color-success, #16a34a)' : 'var(--color-primary)' }}
                                                />
                                            </div>
                                            <p className="course-card-meta">
                                                {t('dashboard.lessonsComplete', { completed, total })}
                                            </p>
                                            {isComplete && (
                                                <p className="certificate-hint">
                                                    <Award size={14} /> {t('dashboard.courseComplete')}
                                                </p>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )
                ) : (
                    mineLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : teachingList.length === 0 ? (
                        <div style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
                            <BookOpen size={44} style={{ color: 'var(--color-gray-300)', marginBottom: '0.75rem' }} />
                            <p style={{ margin: '0 0 1.25rem' }}>{t('dashboard.noCoursesYet')}</p>
                            <Link to="/dashboard/builder/new-course" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                                {t('dashboard.createFirstCourse')}
                            </Link>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="courses-table">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: '200px' }}>{t('dashboard.courseTitle')}</th>
                                        <th>{t('dashboard.status')}</th>
                                        <th>{t('dashboard.lessons')}</th>
                                        <th>{t('dashboard.students')}</th>
                                        <th>{t('dashboard.dateCreated')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teachingList.map(course => (
                                        <tr
                                            key={course.id}
                                            className="teaching-row"
                                            onClick={() => navigate(`/dashboard/builder/course/${course.id}`)}
                                        >
                                            <td>
                                                <span className="course-name-link">{course.title}</span>
                                            </td>
                                            <td><StatusChip status={course.status} /></td>
                                            <td style={{ color: 'var(--color-gray-600)', fontSize: '0.88rem' }}>
                                                {t('courses.lessonsCount', { n: course.lessonCount || 0 })}
                                            </td>
                                            <td style={{ color: 'var(--color-gray-600)', fontSize: '0.88rem' }}>
                                                {t('courses.studentsCount', { n: course.studentCount || 0 })}
                                            </td>
                                            <td style={{ color: 'var(--color-gray-500)', fontSize: '0.88rem' }}>
                                                {course.createdAt ? new Date(course.createdAt).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            <style jsx>{`
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
                .subtitle { color: var(--color-gray-500); }

                .card-container {
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-gray-200);
                    overflow: hidden;
                }

                .toolbar {
                    padding: 1rem;
                    border-bottom: 1px solid var(--color-gray-200);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .tabs { display: flex; gap: 1rem; overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .tab {
                    padding: 0.5rem 1rem;
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--color-gray-500);
                    cursor: pointer;
                    border: none;
                    background: none;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .tab.active { background: var(--color-gray-100); color: #F97316; font-weight: 600; }

                .course-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 1.25rem;
                    padding: 1.25rem;
                }

                .course-card {
                    display: flex;
                    flex-direction: column;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    text-decoration: none;
                    color: inherit;
                    background: var(--color-surface);
                    transition: box-shadow 0.15s, transform 0.15s;
                }
                .course-card:hover {
                    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08));
                    transform: translateY(-2px);
                }

                .course-cover {
                    position: relative;
                    height: 120px;
                    background: var(--color-gray-100);
                    background-size: cover;
                    background-position: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .complete-badge {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    background: var(--badge-success-bg);
                    color: var(--badge-success-text);
                }

                .course-card-body { padding: 0.9rem 1rem 1rem; }

                .course-card-title {
                    margin: 0 0 0.65rem;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--color-gray-800);
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .progress-track {
                    width: 100%;
                    height: 6px;
                    background: var(--color-gray-200);
                    border-radius: 99px;
                    overflow: hidden;
                    margin-bottom: 0.45rem;
                }
                .progress-fill { height: 100%; border-radius: 99px; transition: width 0.3s; }

                .course-card-meta {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--color-gray-500);
                }

                .certificate-hint {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    margin: 0.5rem 0 0;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--badge-success-text);
                }

                .table-wrapper { overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch; }
                .courses-table { width: 100%; min-width: 640px; border-collapse: collapse; }

                .courses-table th {
                    text-align: left;
                    padding: 1rem;
                    background: var(--color-gray-50);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--color-gray-500);
                    font-weight: 600;
                    white-space: nowrap;
                }

                .courses-table td { padding: 1rem; border-bottom: 1px solid var(--color-gray-100); font-size: 0.9rem; vertical-align: middle; white-space: nowrap; }
                .courses-table tr:last-child td { border-bottom: none; }

                .teaching-row { cursor: pointer; transition: background 0.1s; }
                .teaching-row:hover { background: var(--color-gray-50); }

                .course-name-link {
                    font-weight: 600;
                    color: var(--color-primary);
                }
                :global([data-theme="dark"]) .course-name-link {
                    color: white !important;
                }
            `}</style>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default MyCourses;

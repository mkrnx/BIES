import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Users, CheckCircle, PlayCircle, Lock, ChevronRight, GraduationCap } from 'lucide-react';

export const MOCK_COURSES = [
    {
        id: 'c1',
        title: 'Bitcoin Fundamentals',
        educator: 'Elena Rios',
        educatorAvatar: 'https://i.pravatar.cc/40?img=43',
        company: 'Bitcoin Academy SV',
        description: 'A comprehensive introduction to Bitcoin — how it works, why it matters, and how to use it safely.',
        category: 'Bitcoin',
        level: 'Beginner',
        duration: '4 weeks',
        format: 'Video',
        thumbnail: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&q=80',
        studentsEnrolled: 142,
        lessons: [
            { id: 'l1', title: 'What is Bitcoin?', duration: '12 min', completed: true },
            { id: 'l2', title: 'How the Blockchain Works', duration: '18 min', completed: true },
            { id: 'l3', title: 'Wallets & Keys Explained', duration: '15 min', completed: true },
            { id: 'l4', title: 'Making Your First Transaction', duration: '20 min', completed: false },
            { id: 'l5', title: 'Security Best Practices', duration: '14 min', completed: false },
            { id: 'l6', title: 'Bitcoin in El Salvador', duration: '10 min', completed: false },
        ],
    },
    {
        id: 'c2',
        title: 'Lightning Network for Developers',
        educator: 'Samuel Katz',
        educatorAvatar: 'https://i.pravatar.cc/40?img=7',
        company: 'Open Source Finance',
        description: 'Build fast, low-fee Bitcoin payment apps using the Lightning Network. Hands-on with real code.',
        category: 'Lightning',
        level: 'Intermediate',
        duration: '6 weeks',
        format: 'Workshop',
        thumbnail: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80',
        studentsEnrolled: 89,
        lessons: [
            { id: 'l1', title: 'Lightning Network Overview', duration: '16 min', completed: true },
            { id: 'l2', title: 'Opening & Closing Channels', duration: '22 min', completed: false },
            { id: 'l3', title: 'Building a Payment Backend', duration: '35 min', completed: false },
            { id: 'l4', title: 'LNURL & Lightning Addresses', duration: '25 min', completed: false },
            { id: 'l5', title: 'Deploying to Production', duration: '30 min', completed: false },
        ],
    },
    {
        id: 'c3',
        title: 'Nostr Protocol & Decentralised Social',
        educator: 'Samuel Katz',
        educatorAvatar: 'https://i.pravatar.cc/40?img=7',
        company: 'Open Source Finance',
        description: 'Learn how Nostr works and build censorship-resistant apps on the open social protocol.',
        category: 'Nostr',
        level: 'Intermediate',
        duration: '3 weeks',
        format: 'Text',
        thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=80',
        studentsEnrolled: 56,
        lessons: [
            { id: 'l1', title: 'What is Nostr?', duration: '10 min', completed: false },
            { id: 'l2', title: 'Keys, Events & Relays', duration: '18 min', completed: false },
            { id: 'l3', title: 'NIPs Deep Dive', duration: '24 min', completed: false },
            { id: 'l4', title: 'Building a Nostr Client', duration: '40 min', completed: false },
        ],
    },
];

// Which courses the member is enrolled in (by id) — mock enrollment state
const ENROLLED_IDS = ['c1', 'c2'];

const LevelBadge = ({ level }) => {
    const colors = {
        Beginner: { bg: 'var(--color-green-tint)', color: '#16a34a' },
        Intermediate: { bg: 'var(--color-blue-tint)', color: 'var(--color-primary)' },
        Advanced: { bg: 'var(--color-red-tint)', color: 'var(--color-error)' },
    };
    const s = colors[level] || colors.Beginner;
    return (
        <span style={{ background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
            {level}
        </span>
    );
};

const CourseCard = ({ course, enrolled, onEnroll }) => {
    const completed = course.lessons.filter(l => l.completed).length;
    const total = course.lessons.length;
    const pct = enrolled ? Math.round((completed / total) * 100) : 0;
    const nextLesson = course.lessons.find(l => !l.completed);

    return (
        <div className="course-card">
            <div className="course-thumb" style={{ backgroundImage: `url(${course.thumbnail})` }}>
                <LevelBadge level={course.level} />
                {enrolled && pct === 100 && (
                    <div className="completed-overlay">
                        <CheckCircle size={32} color="white" />
                        <span>Completed</span>
                    </div>
                )}
            </div>

            <div className="course-body">
                <div className="course-meta-row">
                    <span className="course-category">{course.category}</span>
                    <span className="course-format">{course.format}</span>
                </div>

                <h3 className="course-title">{course.title}</h3>
                <p className="course-desc">{course.description}</p>

                <div className="educator-row">
                    <img src={course.educatorAvatar} alt={course.educator} className="edu-avatar" />
                    <span className="edu-name">{course.educator}</span>
                    <span className="edu-sep">·</span>
                    <span className="edu-company">{course.company}</span>
                </div>

                <div className="course-stats">
                    <span><Clock size={13} /> {course.duration}</span>
                    <span><BookOpen size={13} /> {total} lessons</span>
                    <span><Users size={13} /> {course.studentsEnrolled}</span>
                </div>

                {enrolled ? (
                    <div className="progress-section">
                        <div className="progress-header">
                            <span className="progress-label">Progress</span>
                            <span className="progress-pct">{pct}%</span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="progress-sub">{completed} of {total} lessons complete</div>

                        {nextLesson && (
                            <Link to={`/courses/${course.id}/lesson/${nextLesson.id}`} className="btn btn-primary continue-btn">
                                <PlayCircle size={16} />
                                Continue: {nextLesson.title}
                            </Link>
                        )}
                        {pct === 100 && (
                            <div className="cert-banner">
                                <GraduationCap size={16} />
                                Course complete! Certificate available.
                            </div>
                        )}
                    </div>
                ) : (
                    <button className="btn btn-outline enroll-btn" onClick={() => onEnroll(course.id)}>
                        Enroll Now
                    </button>
                )}
            </div>
        </div>
    );
};

const MemberMyCourses = () => {
    const [enrolledIds, setEnrolledIds] = useState(ENROLLED_IDS);
    const [tab, setTab] = useState('enrolled'); // 'enrolled' | 'browse'

    const enrolledCourses = MOCK_COURSES.filter(c => enrolledIds.includes(c.id));
    const browseCourses = MOCK_COURSES.filter(c => !enrolledIds.includes(c.id));

    const handleEnroll = (id) => {
        setEnrolledIds(prev => [...prev, id]);
        setTab('enrolled');
    };

    return (
        <div className="my-courses-page">
            <div className="page-header-row">
                <div>
                    <h2 className="page-title">My Courses</h2>
                    <p className="page-subtitle">Track your learning progress and discover new courses.</p>
                </div>
                <button className="btn btn-outline browse-btn" onClick={() => setTab(tab === 'browse' ? 'enrolled' : 'browse')}>
                    {tab === 'enrolled' ? 'Browse All Courses' : 'My Enrolled Courses'}
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === 'enrolled' ? 'active' : ''}`} onClick={() => setTab('enrolled')}>
                    Enrolled ({enrolledCourses.length})
                </button>
                <button className={`tab-btn ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>
                    Browse ({browseCourses.length})
                </button>
            </div>

            {tab === 'enrolled' && (
                enrolledCourses.length === 0 ? (
                    <div className="empty-state">
                        <BookOpen size={40} style={{ color: 'var(--color-gray-300)', marginBottom: '1rem' }} />
                        <p>You haven't enrolled in any courses yet.</p>
                        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setTab('browse')}>
                            Browse Courses
                        </button>
                    </div>
                ) : (
                    <div className="courses-grid">
                        {enrolledCourses.map(c => (
                            <CourseCard key={c.id} course={c} enrolled onEnroll={handleEnroll} />
                        ))}
                    </div>
                )
            )}

            {tab === 'browse' && (
                browseCourses.length === 0 ? (
                    <div className="empty-state">
                        <CheckCircle size={40} style={{ color: '#16a34a', marginBottom: '1rem' }} />
                        <p>You're enrolled in all available courses!</p>
                    </div>
                ) : (
                    <div className="courses-grid">
                        {browseCourses.map(c => (
                            <CourseCard key={c.id} course={c} enrolled={false} onEnroll={handleEnroll} />
                        ))}
                    </div>
                )
            )}

            <style>{`
                .my-courses-page { display: flex; flex-direction: column; gap: 1.5rem; max-width: 1000px; }

                .page-header-row {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 1rem;
                    flex-wrap: wrap;
                }
                .page-title { font-size: 1.4rem; font-weight: 800; margin: 0 0 0.25rem; color: var(--color-neutral-dark); }
                .page-subtitle { font-size: 0.9rem; color: var(--color-gray-500); margin: 0; }
                .browse-btn { display: flex; align-items: center; gap: 0.4rem; white-space: nowrap; }

                .tab-bar {
                    display: flex;
                    gap: 0.25rem;
                    background: var(--color-gray-100);
                    border-radius: var(--radius-full);
                    padding: 4px;
                    width: fit-content;
                }
                .tab-btn {
                    padding: 0.4rem 1.1rem;
                    border-radius: var(--radius-full);
                    border: none;
                    background: none;
                    font-size: 0.88rem;
                    font-weight: 500;
                    color: var(--color-gray-500);
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .tab-btn.active {
                    background: var(--color-surface);
                    color: var(--color-primary);
                    font-weight: 700;
                    box-shadow: var(--shadow-sm);
                }

                .courses-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.5rem;
                }

                @media (max-width: 768px) {
                    .courses-grid { grid-template-columns: 1fr; }
                    .page-header-row { flex-direction: column; }
                }

                /* Course Card */
                .course-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    transition: box-shadow 0.2s, transform 0.2s;
                    display: flex;
                    flex-direction: column;
                }
                .course-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }

                .course-thumb {
                    height: 160px;
                    background-size: cover;
                    background-position: center;
                    background-color: var(--color-gray-100);
                    position: relative;
                    display: flex;
                    align-items: flex-start;
                    padding: 0.75rem;
                }

                .completed-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(22, 163, 74, 0.75);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    color: white;
                    font-weight: 700;
                    font-size: 0.9rem;
                }

                .course-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; flex: 1; }

                .course-meta-row { display: flex; gap: 0.5rem; align-items: center; }
                .course-category {
                    font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
                    color: var(--color-primary); letter-spacing: 0.04em;
                }
                .course-format {
                    font-size: 0.7rem; color: var(--color-gray-400);
                    background: var(--color-gray-100); padding: 2px 7px; border-radius: 99px;
                }

                .course-title { font-size: 1rem; font-weight: 700; color: var(--color-neutral-dark); margin: 0; }
                .course-desc {
                    font-size: 0.83rem; color: var(--color-gray-500); line-height: 1.4; margin: 0;
                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
                }

                .educator-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
                .edu-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
                .edu-name { font-weight: 600; color: var(--color-neutral-dark); }
                .edu-sep { color: var(--color-gray-300); }
                .edu-company { color: var(--color-gray-400); }

                .course-stats {
                    display: flex; gap: 1rem; font-size: 0.78rem; color: var(--color-gray-400);
                }
                .course-stats span { display: flex; align-items: center; gap: 4px; }

                /* Progress */
                .progress-section { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.25rem; }
                .progress-header { display: flex; justify-content: space-between; align-items: center; }
                .progress-label { font-size: 0.8rem; font-weight: 600; color: var(--color-neutral-dark); }
                .progress-pct { font-size: 0.8rem; font-weight: 700; color: var(--color-primary); }
                .progress-bar {
                    height: 6px; background: var(--color-gray-200); border-radius: 99px; overflow: hidden;
                }
                .progress-fill {
                    height: 100%; background: var(--color-primary); border-radius: 99px;
                    transition: width 0.4s ease;
                }
                .progress-sub { font-size: 0.75rem; color: var(--color-gray-400); }

                .continue-btn {
                    display: flex; align-items: center; gap: 0.5rem; justify-content: center;
                    text-decoration: none; margin-top: 0.25rem; font-size: 0.88rem;
                }

                .cert-banner {
                    display: flex; align-items: center; gap: 0.5rem;
                    background: var(--color-green-tint); color: #16a34a;
                    font-size: 0.82rem; font-weight: 600;
                    padding: 0.5rem 0.75rem; border-radius: var(--radius-md);
                    margin-top: 0.25rem;
                }

                .enroll-btn { margin-top: 0.25rem; width: 100%; }

                .empty-state {
                    text-align: center; padding: 4rem 2rem;
                    color: var(--color-gray-500); font-size: 0.95rem;
                }
            `}</style>
        </div>
    );
};

export default MemberMyCourses;

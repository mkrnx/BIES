import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserModeProvider, useUserMode } from './context/UserModeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ViewProvider, useViewPreference } from './context/ViewContext';
import { LightboxProvider } from './context/LightboxContext';
import { preferencesApi } from './services/api';
import i18n from './i18n';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import ModeSelectionModal from './components/ModeSelectionModal';

// Pages
import Landing from './pages/Landing';
import Feed from './pages/Feed';
import Discover from './pages/Discover';
import Members from './pages/Members';
import Builders from './pages/Builders';
import Investors from './pages/Investors';
import Media from './pages/Media';
import News from './pages/News';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import CreateEvent from './pages/CreateEvent';
import EditEvent from './pages/EditEvent';
import MyEvents from './pages/MyEvents';
import Team from './pages/Team';
import PublicProfile from './pages/PublicProfile';
import Profile from './pages/Profile';
import ProfileEdit from './pages/ProfileEdit';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import ProjectDetails from './pages/ProjectDetails';
import Notifications from './pages/Notifications';
import ArticleDetail from './pages/ArticleDetail';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProfileSetup from './pages/ProfileSetup';
import Dashboard from './pages/Dashboard';
import Overview from './pages/Overview';
import Following from './pages/Following';
import NotFound from './pages/NotFound';

import MyProjects from './pages/builder/MyProjects';
import Analytics from './pages/builder/Analytics';
import NewProject from './pages/builder/NewProject';
import MyCourses from './pages/educator/MyCourses';
import NewCourse from './pages/educator/NewCourse';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOverview from './pages/admin/AdminOverview';
import AdminProjects from './pages/admin/AdminProjects';
import AdminEvents from './pages/admin/AdminEvents';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAuditLog from './pages/admin/AdminAuditLog';
import AdminNewsSettings from './pages/admin/AdminNewsSettings';
import AdminInvestorVetting from './pages/admin/AdminInvestorVetting';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

// Public Route (redirects to dashboard if logged in)
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/feed" replace />;
    return children;
};

// Admin/Mod Route Guard
const AdminRoute = ({ children }) => {
    const { user, loading, isStaff } = useAuth();
    const location = useLocation();

    if (loading) return <div className="p-10 text-center">Loading...</div>;
    if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
    if (!isStaff) return <Navigate to="/dashboard" replace />;

    return children;
};

const AppContent = () => {
    const { user } = useAuth();
    const location = useLocation();
    const { setTheme } = useTheme();
    const { setDefaultView } = useViewPreference();
    const prefsLoaded = useRef(false);

    // Restore user preferences from backend on login
    useEffect(() => {
        if (!user || prefsLoaded.current) return;
        prefsLoaded.current = true;
        preferencesApi.get().then(prefs => {
            if (prefs.theme) setTheme(prefs.theme);
            if (prefs.language) i18n.changeLanguage(prefs.language);
            if (prefs.projectsView) { localStorage.setItem('bies_projects_view', prefs.projectsView); setDefaultView(prefs.projectsView); }
            if (prefs.membersView) localStorage.setItem('bies_members_view', prefs.membersView);
            if (prefs.eventsView) localStorage.setItem('bies_events_view', prefs.eventsView);
            if (prefs.mediaView) localStorage.setItem('bies_media_view', prefs.mediaView);
        }).catch(() => {});
    }, [user]);

    // Scroll to top on route change (bottom nav, links, etc.)
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    return (
        <>
            {user && <Navbar />}
            <div className="app-content">
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={user ? <Navigate to="/feed" replace /> : <Navigate to="/login" replace />} />
                    <Route path="/feed" element={
                        <ProtectedRoute><Feed /></ProtectedRoute>
                    } />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
                    <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
                    <Route path="/events/create" element={
                        <ProtectedRoute><CreateEvent /></ProtectedRoute>
                    } />
                    <Route path="/events/my" element={
                        <ProtectedRoute><MyEvents /></ProtectedRoute>
                    } />
                    <Route path="/events/edit/:id" element={
                        <ProtectedRoute><EditEvent /></ProtectedRoute>
                    } />
                    <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
                    <Route path="/members" element={<Navigate to="/discover" replace />} />
                    <Route path="/builders" element={<Navigate to="/discover" replace />} />
                    <Route path="/builder/:id" element={<ProtectedRoute><PublicProfile type="builder" /></ProtectedRoute>} />
                    <Route path="/investors" element={<Navigate to="/discover" replace />} />
                    <Route path="/investor/:id" element={<ProtectedRoute><PublicProfile type="investor" /></ProtectedRoute>} />
                    <Route path="/media" element={<ProtectedRoute><Media /></ProtectedRoute>} />
                    <Route path="/news" element={<ProtectedRoute><News /></ProtectedRoute>} />
                    <Route path="/news/:slug" element={<ProtectedRoute><ArticleDetail /></ProtectedRoute>} />
                    <Route path="/about" element={<ProtectedRoute><Team /></ProtectedRoute>} />

                    {/* Protected Routes */}
                    {/* Specific Dashboard Routes */}
                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }>
                        <Route index element={<Overview />} />
                        <Route path="projects" element={<MyProjects />} />
                        <Route path="events" element={<MyEvents />} />
                        <Route path="courses" element={<MyCourses />} />
                        <Route path="following" element={<Following />} />
                        <Route path="messages" element={<Messages />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="settings" element={<Settings />} />
                        {/* Sub-routes */}
                        <Route path="builder/new-project" element={<NewProject />} />
                        <Route path="builder/new-course" element={<NewCourse />} />
                    </Route>

                    {/* Admin Routes */}
                    <Route path="/admin" element={
                        <AdminRoute>
                            <AdminDashboard />
                        </AdminRoute>
                    }>
                        <Route index element={<AdminOverview />} />
                        <Route path="projects" element={<AdminProjects />} />
                        <Route path="events" element={<AdminEvents />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="audit-log" element={<AdminAuditLog />} />
                        <Route path="news-settings" element={<AdminNewsSettings />} />
                        <Route path="investor-vetting" element={<AdminInvestorVetting />} />
                    </Route>

                    <Route path="/project/:id" element={
                        <ProtectedRoute>
                            <ProjectDetails />
                        </ProtectedRoute>
                    } />

                    <Route path="/profile-setup" element={
                        <ProtectedRoute>
                            <ProfileSetup />
                        </ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    } />
                    <Route path="/profile/edit" element={
                        <ProtectedRoute>
                            <ProfileEdit />
                        </ProtectedRoute>
                    } />
                    <Route path="/messages" element={
                        <ProtectedRoute>
                            <Messages />
                        </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                        <ProtectedRoute>
                            <Settings />
                        </ProtectedRoute>
                    } />
                    <Route path="/notifications" element={
                        <ProtectedRoute>
                            <Notifications />
                        </ProtectedRoute>
                    } />

                    {/* 404 Catch-all */}
                    <Route path="*" element={
                        <ProtectedRoute><NotFound /></ProtectedRoute>
                    } />
                </Routes>
            </div>
            {user && <MobileBottomNav />}
        </>
    );
};

function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <ViewProvider>
                    <UserModeProvider>
                        <LightboxProvider>
                            <Router basename="/" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                                <AppContent />
                            </Router>
                        </LightboxProvider>
                    </UserModeProvider>
                </ViewProvider>
            </ThemeProvider>
        </AuthProvider>
    );
}

export default App;

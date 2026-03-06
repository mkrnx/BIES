import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserModeProvider, useUserMode } from './context/UserModeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ModeSelectionModal from './components/ModeSelectionModal';

// Pages
import Landing from './pages/Landing';
import BuilderDashboard from './pages/builder/Dashboard';
import InvestorDashboard from './pages/investor/Dashboard';
import Discover from './pages/Discover';
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
import BuilderOverview from './pages/builder/Overview';
import MyProjects from './pages/builder/MyProjects';
import Analytics from './pages/builder/Analytics';
import NewProject from './pages/builder/NewProject';
import BuilderFollowing from './pages/builder/Following';
import InvestorFollowing from './pages/investor/Following';
import InvestorWatchlist from './pages/investor/Watchlist';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOverview from './pages/admin/AdminOverview';
import AdminProjects from './pages/admin/AdminProjects';
import AdminEvents from './pages/admin/AdminEvents';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAuditLog from './pages/admin/AdminAuditLog';
import AdminNewsSettings from './pages/admin/AdminNewsSettings';

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
    if (user) return <Navigate to="/dashboard" replace />;
    return children;
};

// Admin Route Guard
const AdminRoute = ({ children }) => {
    const { user, loading, isAdmin } = useAuth();
    const location = useLocation();

    if (loading) return <div className="p-10 text-center">Loading...</div>;
    if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
    if (!isAdmin) return <Navigate to="/dashboard" replace />;

    return children;
};

// Dashboard Redirect based on Role or Mode switch
const DashboardRedirect = () => {
    const { user } = useAuth();
    const { mode } = useUserMode();

    if (mode === 'admin') return <Navigate to="/admin" replace />;
    if (mode === 'builder') return <Navigate to="/dashboard/builder" replace />;
    if (mode === 'investor') return <Navigate to="/dashboard/investor" replace />;

    if (user?.role?.toUpperCase() === 'ADMIN') {
        return <Navigate to="/admin" replace />;
    }
    if (user?.role?.toUpperCase() === 'BUILDER') {
        return <Navigate to="/dashboard/builder" replace />;
    }
    return <Navigate to="/dashboard/investor" replace />;
};

const AppContent = () => {
    const { user } = useAuth();
    // Only show Navbar if logged in? Or always? Let's show always for now except maybe login/signup
    // But for simplicity, existing layout had Navbar always.

    return (
        <>
            <Navbar />
            <ModeSelectionModal />
            <div style={{ minHeight: 'calc(100vh - 73px)' }}>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

                    <Route path="/discover" element={<Discover />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/events/create" element={
                        <ProtectedRoute><CreateEvent /></ProtectedRoute>
                    } />
                    <Route path="/events/edit/:id" element={
                        <ProtectedRoute><EditEvent /></ProtectedRoute>
                    } />
                    <Route path="/events/:id" element={<EventDetail />} />
                    <Route path="/builders" element={<Builders />} />
                    <Route path="/builder/:id" element={<PublicProfile type="builder" />} />
                    <Route path="/investors" element={<Investors />} />
                    <Route path="/investor/:id" element={<PublicProfile type="investor" />} />
                    <Route path="/media" element={<Media />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/news/:slug" element={<ArticleDetail />} />
                    <Route path="/about" element={<Team />} />

                    {/* Protected Routes */}
                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <DashboardRedirect />
                        </ProtectedRoute>
                    } />

                    {/* Specific Dashboard Routes */}
                    <Route path="/dashboard/builder" element={
                        <ProtectedRoute>
                            <BuilderDashboard />
                        </ProtectedRoute>
                    }>
                        <Route index element={<BuilderOverview />} />
                        <Route path="projects" element={<MyProjects />} />
                        <Route path="my-events" element={<MyEvents />} />
                        <Route path="messages" element={<Messages />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="following" element={<BuilderFollowing />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="new-project" element={<NewProject />} />
                    </Route>
                    <Route path="/dashboard/investor" element={
                        <ProtectedRoute>
                            <InvestorDashboard />
                        </ProtectedRoute>
                    }>
                        <Route path="watchlist" element={<InvestorWatchlist />} />
                        <Route path="my-events" element={<MyEvents />} />
                        <Route path="following" element={<InvestorFollowing />} />
                        <Route path="messages" element={<Messages />} />
                        <Route path="deal-flow" element={<Discover />} />
                        <Route path="settings" element={<Settings />} />
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
                </Routes>
            </div>
        </>
    );
};

function App() {
    return (
        <AuthProvider>
            <UserModeProvider>
                <Router basename="/biestest">
                    <AppContent />
                </Router>
            </UserModeProvider>
        </AuthProvider>
    );
}

export default App;

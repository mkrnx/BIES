import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserModeProvider } from './context/UserModeContext';
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
import Team from './pages/Team';
import PublicProfile from './pages/PublicProfile';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import ProjectDetails from './pages/ProjectDetails';
import Login from './pages/Login';
import Signup from './pages/Signup';
import BuilderOverview from './pages/builder/Overview';
import MyProjects from './pages/builder/MyProjects';
import Analytics from './pages/builder/Analytics';
import NewProject from './pages/builder/NewProject';

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

// Dashboard Redirect based on Role
const DashboardRedirect = () => {
    const { user } = useAuth();
    if (user?.role === 'builder') return <BuilderDashboard />;
    return <InvestorDashboard />;
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
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

                    <Route path="/discover" element={<Discover />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/events/:id" element={<EventDetail />} />
                    <Route path="/builders" element={<Builders />} />
                    <Route path="/builder/:id" element={<PublicProfile type="builder" />} />
                    <Route path="/investors" element={<Investors />} />
                    <Route path="/investor/:id" element={<PublicProfile type="investor" />} />
                    <Route path="/media" element={<Media />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/about" element={<Team />} />

                    {/* Protected Routes */}
                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <DashboardRedirect />
                        </ProtectedRoute>
                    } />

                    {/* Specific Dashboard Routes if accessed directly */}


                    // ... (in routes)

                    {/* Specific Dashboard Routes if accessed directly */}
                    <Route path="/dashboard/builder" element={
                        <ProtectedRoute>
                            <BuilderDashboard />
                        </ProtectedRoute>
                    }>
                        <Route index element={<BuilderOverview />} />
                        <Route path="projects" element={<MyProjects />} />
                        <Route path="messages" element={<Messages />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="new-project" element={<NewProject />} />
                        <Route path="create-event" element={<CreateEvent />} />
                    </Route>
                    <Route path="/dashboard/investor" element={
                        <ProtectedRoute>
                            <InvestorDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/dashboard/investor/create-event" element={
                        <ProtectedRoute>
                            <CreateEvent />
                        </ProtectedRoute>
                    } />

                    <Route path="/project/:id" element={
                        <ProtectedRoute>
                            <ProjectDetails />
                        </ProtectedRoute>
                    } />

                    <Route path="/profile" element={
                        <ProtectedRoute>
                            <Profile />
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
                </Routes>
            </div>
        </>
    );
};

function App() {
    return (
        <UserModeProvider>
            <AuthProvider>
                <Router basename="/biestest">
                    <AppContent />
                </Router>
            </AuthProvider>
        </UserModeProvider>
    );
}

export default App;

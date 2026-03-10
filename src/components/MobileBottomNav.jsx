import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Calendar, Newspaper, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { path: '/feed', icon: Home, label: 'Home' },
  { path: '/discover', icon: Compass, label: 'Discover' },
  { path: '/events', icon: Calendar, label: 'Events' },
  { path: '/news', icon: Newspaper, label: 'News' },
  { path: '/dashboard', icon: User, label: 'Dashboard', auth: true },
];

const itemStyle = (active) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '3px',
  flex: 1,
  color: active ? '#FF5B00' : 'white',
  textDecoration: 'none',
  fontSize: '0.68rem',
  fontWeight: active ? 700 : 500,
  letterSpacing: '0.03em',
  WebkitTapHighlightColor: 'transparent',
});

const iconWrapStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '32px',
  borderRadius: '16px',
  background: active ? 'rgba(255, 91, 0, 0.15)' : 'none',
});

const MobileBottomNav = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <>
      <nav style={{
        display: 'none',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        background: '#0047AB',
        borderTop: '3px solid #FF5B00',
        zIndex: 10000,
      }} className="mobile-bottom-nav">
        {tabs.map((tab) => {
          if (tab.auth && !isAuthenticated) {
            return (
              <Link key="login" to="/login" style={itemStyle(false)}>
                <div style={iconWrapStyle(false)}><User size={22} strokeWidth={1.8} /></div>
                <span>Login</span>
              </Link>
            );
          }
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return (
            <Link key={tab.path} to={tab.path} style={itemStyle(active)}>
              <div style={iconWrapStyle(active)}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex !important;
            align-items: flex-start;
            justify-content: space-around;
            padding-top: 10px;
            padding-bottom: calc(6px + env(safe-area-inset-bottom, 0));
          }
        }
      `}</style>
    </>
  );
};

export default MobileBottomNav;

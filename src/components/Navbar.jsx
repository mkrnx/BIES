import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserMode } from '../context/UserModeContext';
import { useAuth } from '../context/AuthContext';
import { Menu, Bell, User, Search, ChevronDown, LogOut } from 'lucide-react';
import NostrIcon from './NostrIcon';
import { notificationsApi } from '../services/api';
import logoHorizontalWhite from '../assets/logo-horizontal-white.svg';

const Navbar = () => {
  const { mode, selectMode, clearMode } = useUserMode();
  const { user, isAuthenticated, notifications, unreadCount, clearNotificationCount, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      clearNotificationCount();
    } catch { /* ignore */ }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/discover?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { label: 'Discover', path: '/discover' },
    { label: 'Builders', path: '/builders' },
    { label: 'Investors', path: '/investors' },
    { label: 'Events', path: '/events' },
    { label: 'Media', path: '/media' },
    { label: 'News', path: '/news' },
    { label: 'About', path: '/about' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="container flex items-center justify-between" style={{ height: '100%' }}>

        {/* Logo */}
        <Link to="/" className="logo">
          <img src={logoHorizontalWhite} alt="Build in El Salvador" style={{ height: '40px' }} />
        </Link>

        {/* Desktop Nav */}
        <div className="desktop-links flex items-center gap-lg">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
              style={{ color: 'white' }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Actions */}
        <div className="actions flex items-center gap-md">
          <div className="search-container relative flex items-center">
            {isSearchOpen ? (
              <form onSubmit={handleSearchSubmit} className="search-form flex items-center">
                <input
                  type="text"
                  placeholder="Search projects, builders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  autoFocus
                  onBlur={() => {
                    // Slight delay to allow submit to fire if they clicked the icon
                    setTimeout(() => {
                      if (!searchQuery) setIsSearchOpen(false);
                    }, 200);
                  }}
                />
                <button type="submit" className="icon-btn search-submit-btn" aria-label="Submit Search">
                  <Search size={20} />
                </button>
              </form>
            ) : (
              <button className="icon-btn" aria-label="Open Search" onClick={() => setIsSearchOpen(true)}>
                <Search size={20} />
              </button>
            )}
          </div>
          <div className="notifications-menu relative">
            <button
              className="icon-btn relative"
              aria-label="Notifications"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            >
              <Bell size={20} />
              {unreadCount > 0 && <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>

            {isNotificationsOpen && (
              <>
                <div className="click-outside-overlay" onClick={() => setIsNotificationsOpen(false)}></div>
                <div className="dropdown notifications-dropdown">
                  <div className="dropdown-header">Notifications</div>
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-gray-400)', fontSize: '0.85rem' }}>
                        No notifications yet
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <div key={notif.id} className={`notification-item ${!notif.read ? 'unread' : ''}`}>
                          {!notif.read && <div className="dot-indicator"></div>}
                          <div>
                            <p className="notif-text">{notif.message || notif.text}</p>
                            <span className="notif-time">{notif.timeAgo || notif.createdAt}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="dropdown-footer">
                    {unreadCount > 0 && (
                      <button className="text-secondary text-sm" onClick={handleMarkAllRead}>Mark all as read</button>
                    )}
                    <Link to="/notifications" className="text-primary text-sm" style={{ display: 'block', marginTop: unreadCount > 0 ? '0.25rem' : 0 }}
                      onClick={() => setIsNotificationsOpen(false)}>
                      View all
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Profile / Mode Switcher */}
          {isAuthenticated ? (
            <div className="user-menu relative">
              <button
                className={`profile-btn flex items-center gap-sm ${isUserMenuOpen ? 'active' : ''}`}
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="avatar">
                  {user?.profile?.avatar ? (
                    <img src={user.profile.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <User size={18} />
                  )}
                </div>
                <div className="flex flex-col items-start hidden-mobile" style={{ lineHeight: 1.2, color: 'white' }}>
                  <span className="text-sm font-semibold">{user?.profile?.name || user?.name || 'Guest'}</span>
                </div>
                <ChevronDown size={14} style={{ transform: isUserMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Dropdown */}
              {isUserMenuOpen && (
                <>
                  <div className="click-outside-overlay" onClick={() => setIsUserMenuOpen(false)}></div>
                  <div className="dropdown user-dropdown">
                    {/* Top Section */}
                    <div className="dropdown-section vertical-stack">
                      <Link to="/profile" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>Profile</Link>
                      <Link to="/messages" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>Messages</Link>
                      <Link to="/dashboard" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>Dashboard</Link>
                      {user?.role === 'ADMIN' && (
                        <Link to="/admin" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Admin Panel</Link>
                      )}
                      <Link to="/settings" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>Settings</Link>
                    </div>

                    <div className="dropdown-divider"></div>

                    <div className="dropdown-header">
                      <p className="text-sm font-semibold">Switch View</p>
                    </div>
                    <button
                      className={`dropdown-item ${mode === 'builder' ? 'active' : ''}`}
                      onClick={() => { selectMode('builder'); setIsUserMenuOpen(false); }}
                    >
                      <div className="dot builder"></div>
                      Builder View
                    </button>
                    <button
                      className={`dropdown-item ${mode === 'investor' ? 'active' : ''}`}
                      onClick={() => { selectMode('investor'); setIsUserMenuOpen(false); }}
                    >
                      <div className="dot investor"></div>
                      Investor View
                    </button>

                    <div className="dropdown-divider"></div>

                    {isAuthenticated ? (
                      <button onClick={() => { logout(); clearMode(); setIsUserMenuOpen(false); navigate('/'); }} className="dropdown-item text-error">
                        <LogOut size={14} style={{ marginRight: 8 }} /> Log Out
                      </button>
                    ) : (
                      <Link to="/login" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>
                        Log In
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link to="/login" className="login-btn flex items-center gap-sm" style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', padding: '6px 16px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-full)' }}>
              <NostrIcon size={16} />
              <span>Login</span>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Mode Indicator Strip - Removed since it conflicts with the bottom orange border in this layout */}

      {/* Bitcoin Orange Line */}
      <div style={{ height: '3px', width: '100%', backgroundColor: 'var(--color-secondary)', position: 'absolute', bottom: 0, left: 0, zIndex: 10 }} />

      <style jsx>{`
        .navbar {
          height: 70px;
          background: var(--color-primary);
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: var(--shadow-sm);
        }

        .logo {
          display: flex;
          align-items: center;
        }

        .logo img {
          height: 40px;
          width: auto;
        }

        .nav-link {
          font-family: var(--font-sans);
          font-weight: 400; /* Regular */
          color: white;
          font-size: 0.95rem;
          padding: 0.5rem 0;
          position: relative;
        }

        .nav-link:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .nav-link.active {
          color: white;
          font-family: var(--font-display);
          font-weight: 700;
        }

        .icon-btn {
          padding: 8px;
          color: white;
          border-radius: 50%;
        }
        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .badge {
          position: absolute;
          top: 4px;
          right: 4px;
          background: var(--color-error);
          color: white;
          font-size: 10px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid white;
        }

        .search-container {
          height: 36px;
        }

        .search-form {
          background: rgba(255, 255, 255, 0.15);
          border-radius: var(--radius-full);
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding-left: 12px;
          overflow: hidden;
          transition: all 0.2s ease-out;
          width: 200px; /* Expands search to 200px */
        }
        .search-form:focus-within {
          background: rgba(255, 255, 255, 0.25);
          width: 250px;
        }

        .search-input {
          background: transparent;
          border: none;
          color: white;
          width: 100%;
          outline: none;
          font-size: 0.9rem;
          font-family: inherit;
        }
        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }

        .search-submit-btn {
          padding: 6px 12px;
        }
        .search-submit-btn:hover {
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
        }

        .profile-btn {
          padding: 4px 8px 4px 4px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: var(--radius-full);
          transition: all 0.2s;
          color: white;
        }
        .profile-btn:hover {
          border-color: rgba(255, 255, 255, 0.4);
        }

        .avatar {
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        /* Dropdown */
        .click-outside-overlay {
            position: fixed;
            top: 0; 
            left: 0; 
            right: 0; 
            bottom: 0; 
            z-index: 99;
        }

        .dropdown {
          display: block;
          position: absolute;
          top: 100%;
          right: 0;
          width: 200px;
          background: white;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--color-gray-100);
          padding: 0.5rem;
          margin-top: 0.5rem;
          z-index: 100;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .dropdown-header {
          padding: 0.5rem 1rem;
          color: var(--color-gray-400);
          text-transform: uppercase;
          font-size: 0.7rem;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0.75rem 1rem;
          font-size: 0.9rem;
          color: var(--color-neutral-dark);
          border-radius: var(--radius-sm);
          text-align: left;
        }

        .dropdown-item:hover {
          background: var(--color-gray-100);
        }

        .dropdown-item.active {
          background: var(--color-gray-100);
          font-family: var(--font-display);
          font-weight: 700;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 10px;
        }
        .dot.builder { background: var(--color-primary); }
        .dot.investor { background: var(--color-secondary); }

        .dropdown-divider {
          height: 1px;
          background: var(--color-gray-200);
          margin: 0.5rem 0;
        }

        .text-error { color: var(--color-error); }

        /* Mode Strip */
        .mode-strip {
          height: 3px;
          width: 100%;
          transition: background 0.3s;
        }
        .mode-strip.builder { background: var(--color-primary); }
        .mode-strip.investor { background: var(--color-secondary); }

        .hidden-mobile { display: block; }
        .mobile-toggle { display: none; color: white; }

        @media (max-width: 768px) {
          .desktop-links { display: none; }
          .hidden-mobile { display: none; }
          .mobile-toggle { display: block; }
        }

        /* Notifications */
        .notifications-dropdown {
            width: 300px;
            right: -100px; /* Center somewhat relative to bell */
        }
        
        .notification-list {
            max-height: 300px;
            overflow-y: auto;
        }

        .notification-item {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--color-gray-100);
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }
        .notification-item:last-child { border-bottom: none; }
        .notification-item.unread { background: #F0F9FF; }

        .notif-text { font-size: 0.85rem; line-height: 1.3; color: var(--color-neutral-dark); }
        .notif-time { font-size: 0.75rem; color: var(--color-gray-400); display: block; margin-top: 4px; }
        
        .dot-indicator {
            width: 8px; height: 8px; background: var(--color-primary); border-radius: 50%; margin-top: 6px; flex-shrink: 0;
        }

        .dropdown-footer {
            padding: 0.5rem;
            text-align: center;
            border-top: 1px solid var(--color-gray-100);
        }

        .vertical-stack {
            display: flex;
            flex-direction: column;
        }
      `}</style>
    </nav>
  );
};

export default Navbar;

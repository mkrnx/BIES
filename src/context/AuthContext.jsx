import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { BiesWebSocket, notificationsApi } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [wsClient, setWsClient] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // ─── Session restore on mount ──────────────────────────────────────────

    useEffect(() => {
        let mounted = true;

        authService.restoreSession()
            .then((user) => {
                if (!mounted) return;
                if (user) {
                    setUser(user);
                    initWebSocket(user);
                    fetchInitialNotifications();
                }
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        // Listen for 401 events from the API client
        const handleUnauthorized = () => {
            setUser(null);
            setWsClient((prev) => { prev?.disconnect(); return null; });
        };
        window.addEventListener('bies:unauthorized', handleUnauthorized);

        return () => {
            mounted = false;
            window.removeEventListener('bies:unauthorized', handleUnauthorized);
        };
    }, []);

    // ─── WebSocket setup ───────────────────────────────────────────────────

    const initWebSocket = useCallback((user) => {
        const ws = new BiesWebSocket(
            // onMessage
            (msg) => {
                if (msg.type === 'notification') {
                    setNotifications((prev) => [msg.notification, ...prev]);
                    setUnreadCount((c) => c + 1);
                }
            },
            // onConnect
            null,
            // onDisconnect
            null
        );
        ws.connect();
        setWsClient(ws);
        return ws;
    }, []);

    // ─── Auth actions ──────────────────────────────────────────────────────

    const loginWithNostr = async () => {
        try {
            const user = await authService.loginWithNostr();
            setUser(user);
            initWebSocket(user);
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const loginWithEmail = async (email, password) => {
        try {
            const user = await authService.loginWithEmail(email, password);
            setUser(user);
            initWebSocket(user);
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const signup = async (email, password, role, name) => {
        try {
            const user = await authService.register(email, password, role, name);
            setUser(user);
            initWebSocket(user);
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    /**
     * For Nostr users who need to complete profile setup after first login.
     * In the old flow, Signup.jsx was standalone.
     * Now: loginWithNostr() → returns user with needsProfileSetup=true if new.
     */
    const loginWithNostrAndCheckNew = async () => {
        const result = await loginWithNostr();
        if (!result.success) return result;

        // New users have a generated placeholder name like "nostr:abc12345"
        const isNew = result.user?.profile?.name?.startsWith('nostr:');
        return { ...result, needsProfileSetup: isNew };
    };

    const logout = () => {
        wsClient?.disconnect();
        setWsClient(null);
        authService.logout();
        setUser(null);
        setNotifications([]);
        setUnreadCount(0);
    };

    const updateRole = async (role) => {
        const result = await authService.updateRole(role);
        setUser((prev) => ({ ...prev, role: result.role }));
        return result;
    };

    const refreshUser = async () => {
        const updated = await authService.restoreSession();
        if (updated) setUser(updated);
        return updated;
    };

    const fetchInitialNotifications = async () => {
        try {
            const result = await notificationsApi.list({ limit: 20 });
            const list = result?.data || result || [];
            if (Array.isArray(list)) {
                setNotifications(list);
                setUnreadCount(list.filter(n => !n.read).length);
            }
        } catch { /* ignore on failure */ }
    };

    const clearNotificationCount = () => setUnreadCount(0);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            wsClient,
            notifications,
            unreadCount,
            clearNotificationCount,
            refreshNotifications: fetchInitialNotifications,
            loginWithNostr,
            loginWithNostrAndCheckNew,
            loginWithEmail,
            signup,
            logout,
            updateRole,
            refreshUser,
            isAuthenticated: !!user,
            isBuilder: user?.role === 'BUILDER',
            isInvestor: user?.role === 'INVESTOR',
            isAdmin: user?.role === 'ADMIN',
        }}>
            {children}
        </AuthContext.Provider>
    );
};

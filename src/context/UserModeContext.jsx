import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const UserModeContext = createContext();

export const UserModeProvider = ({ children }) => {
  const { user, isAuthenticated, updateRole } = useAuth();

  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('bies_mode');
    return savedMode || null;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync mode with authenticated user's role
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const roleMode = user.role.toLowerCase();
      if (['builder', 'investor', 'educator', 'member'].includes(roleMode)) {
        setMode(roleMode);
      }
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (mode) {
      localStorage.setItem('bies_mode', mode);
      document.body.setAttribute('data-mode', mode);
      setIsModalOpen(false);
    } else {
      document.body.removeAttribute('data-mode');
      // Only show modal for unauthenticated users on first visit
      if (!isAuthenticated) {
        setIsModalOpen(true);
      }
    }
  }, [mode, isAuthenticated]);

  const selectMode = async (newMode) => {
    setMode(newMode);
    // If authenticated and NOT an admin/mod, also update role on backend
    if (isAuthenticated && updateRole && !user?.isAdmin && user?.role !== 'MOD') {
      try {
        // Only BUILDER and INVESTOR are valid roles to update to via this endpoint
        if (['builder', 'investor', 'educator', 'member'].includes(newMode)) {
          await updateRole(newMode.toUpperCase());
        }
      } catch { /* ignore - local mode still updated */ }
    }
  };

  const clearMode = () => {
    setMode(null);
    localStorage.removeItem('bies_mode');
  };

  return (
    <UserModeContext.Provider value={{ mode, selectMode, isModalOpen, clearMode }}>
      {children}
    </UserModeContext.Provider>
  );
};

export const useUserMode = () => useContext(UserModeContext);

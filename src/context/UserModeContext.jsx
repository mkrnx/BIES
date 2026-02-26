import React, { createContext, useContext, useState, useEffect } from 'react';

const UserModeContext = createContext();

export const UserModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    // Check localStorage first
    const savedMode = localStorage.getItem('bies_mode');
    return savedMode || null;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Sync mode with localStorage and Body attribute
    if (mode) {
      localStorage.setItem('bies_mode', mode);
      document.body.setAttribute('data-mode', mode);
      setIsModalOpen(false);
    } else {
      // If no mode selected, open the modal
      document.body.removeAttribute('data-mode');
      setIsModalOpen(true);
    }
  }, [mode]);

  const selectMode = (newMode) => {
    setMode(newMode);
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

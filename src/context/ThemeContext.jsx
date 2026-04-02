import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('bies_theme') || 'system';
    });

    useEffect(() => {
        const root = document.documentElement;

        const applyTheme = (themeValue) => {
            if (themeValue === 'dark') {
                root.setAttribute('data-theme', 'dark');
            } else if (themeValue === 'light') {
                root.setAttribute('data-theme', 'light');
            } else if (themeValue === 'system') {
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (systemPrefersDark) {
                    root.setAttribute('data-theme', 'dark');
                } else {
                    root.setAttribute('data-theme', 'light');
                }
            }

            // Remove hardcoded inline background from body (set in index.html for splash)
            document.body.style.removeProperty('background');
        };

        applyTheme(theme);
        localStorage.setItem('bies_theme', theme);

        // Listen for system changes if set to 'system'
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme('system');

            // Modern browsers
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handleChange);
                return () => mediaQuery.removeEventListener('change', handleChange);
            } else {
                // Older browsers (Safari < 14)
                mediaQuery.addListener(handleChange);
                return () => mediaQuery.removeListener(handleChange);
            }
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);

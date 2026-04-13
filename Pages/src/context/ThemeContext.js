import React, { createContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

const COLORS = {
    light: {
        bg: '#ffffff',     
        text: '#1a1a1a',
        subText: '#555555',
        card: '#FFFFFF',
        primary: '#2d6a4f',
        border: '#253a30',
        search: '#FFFFFF',
        accent: '#2d6a4f'

    },
    dark: {
        bg: '#0f1a14',
        text: '#f1f1f1',
        subText: '#aaaaaa',
        card: '#FFFFFF',
        primary: '#153c2a',
        border: '#253a30',
        search: '#FFFFFF',
        accent: '#40916c'
    },
};

export function ThemeProvider({ children }) {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        (async () => {
        const saved = await AsyncStorage.getItem('theme');
        setDarkMode(saved === 'dark');
        })();
    }, []);

    const toggleTheme = async () => {
        const next = !darkMode;
        setDarkMode(next);
        await AsyncStorage.setItem('theme', next ? 'dark' : 'light');
    };

    const theme = darkMode ? COLORS.dark : COLORS.light;

    return (
        <ThemeContext.Provider value={{ theme, darkMode, toggleTheme }}>
        {children}
        </ThemeContext.Provider>
    );
}

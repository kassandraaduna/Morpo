import React, { createContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

const COLORS = {
    light: {
        bg: '#FFFFFF',
        text: '#000000',
        subText: '#777777',
        card: '#FADADD',
        search: '#FFFFFF',
        edit: '#E14B4B',
        editCard:'#FADADD'
    },
    dark: {
        bg: '#121212',
        text: '#FFFFFF',
        subText: '#AAAAAA',
        card: '#2A2A2A',
        search: '#2A2A2A',
        edit: '#E14B4B',
        editCard:'#4A4A4A'
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

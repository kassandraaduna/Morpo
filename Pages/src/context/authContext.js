import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api'; 

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const userRaw = await AsyncStorage.getItem('user');
                if (userRaw) setUser(JSON.parse(userRaw));
            } catch (e) {
                console.error("Session restore failed:", e);
            } finally {
                setIsLoading(false);
            }
        };
        bootstrap();

        // Listen for server verification prompts (401/403)
        const interceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const status = error.response?.status;
                if (status === 401 || status === 403) {
                    await logoutUser();
                }
                return Promise.reject(error);
            }
        );

        return () => api.interceptors.response.eject(interceptor);
    }, []);

    const loginUser = async (userData) => {
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logoutUser = async () => {
        await AsyncStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, loginUser, logoutUser }}>
            {children}
        </AuthContext.Provider>
    );
};
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

    const loginUser = async (userData, expoToken = null) => {
        try {
            await AsyncStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);

            if (expoToken && userData._id) {
                await api.put(`/users/${userData._id}/push-token`, { token: expoToken }).catch(() => {});
            }
        } catch (e) {
            console.error('Failed to save session:', e);
        }
    };

    const logoutUser = async () => {
        try {
            if (user && user._id) {
                await api.put(`/users/${user._id}/push-token`, { token: '' }).catch(() => {});
            }
            
            await AsyncStorage.multiRemove(['user', 'token', 'user_role']);
            setUser(null);
        } catch (e) {
            console.error('Logout error:', e);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, loginUser, logoutUser }}>
            {children}
        </AuthContext.Provider>
    );
};
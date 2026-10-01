import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api'; 
import * as Notifications from 'expo-notifications';

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

        // Listen for server verification prompts
        const interceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const status = error.response?.status;
                // CRITICAL FIX: Only trigger logout on 401 Unauthorized
                if (status === 401) {
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

    const registerPushToken = async (userId) => {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
            }
            if (finalStatus !== 'granted') return;

            const tokenData = await Notifications.getExpoPushTokenAsync();
            const token = tokenData.data;

            // Send token to backend
            await api.put(`/users/${userId}/push-token`, { expoPushToken: token }).catch(() => {});
        } catch (error) {
            console.log('Failed to save push token:', error);
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
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const login = ({ usernameOrEmail, password }) => {
    return api.post('/auth/login', {
        usernameOrEmail,
        password,
    });
};  

export const verifyLoginOtp = data =>
    api.post('/auth/verify-login-otp', data);

export const resendLoginOtp = email =>
    api.post('/auth/resend-login-otp', { email });

export const requestRegisterOtp = email =>
    api.post('/auth/request-email-otp', { email, purpose: 'register' });

export const verifyRegisterOtp = data =>
    api.post('/auth/verify-email-otp-and-register', data);


export const saveUser = async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
};

export const getUser = async () => {
    const raw = await AsyncStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
};

export const logout = async () => {
    await AsyncStorage.removeItem('user');
};

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_IP = '192.168.1.24'; 
const BASE_URL = `http://${BASE_IP}:8000/api`; 
export const FILE_BASE = `http://${BASE_IP}:8000`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const userRaw = await AsyncStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        if (user.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
        }
      }
    } catch (e) {
      console.log("Interceptor Error:", e);
    }
    return config;
  },
  error => Promise.reject(error)
);

export const toAbsUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${FILE_BASE}${path}`;
};

export default api;
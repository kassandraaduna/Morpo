import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*==========================================
  1. LOCAL DEVELOPMENT
  ========================================== 
*/

// const BASE_IP = 'localhost'; 
// export const FILE_BASE = `http://${BASE_IP}:8000`;
// const BASE_URL = `${FILE_BASE}/api`; 

/* ==========================================
  2. PRODUCTION (Deployed to the Web)
  ========================================== 
*/
export const FILE_BASE = 'https://mypholens-backend.onrender.com'; 
const BASE_URL = `${FILE_BASE}/api`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      // 1. Primary check: Isolated token (Matches Web)
      let token = await AsyncStorage.getItem('token');
      
      // 2. Fallback check: Inside the user object
      if (!token) {
        const userRaw = await AsyncStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          if (user && user.token) token = user.token;
        }
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.log("Interceptor Error:", e);
    }
    return config;
  },
  error => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    // Auto-capture token from auth responses exactly like the web app
    const url = response.config?.url || '';
    if (url.includes('/auth/')) {
       const token = response.data?.data?.token || response.data?.token;
       if (token) AsyncStorage.setItem('token', token).catch(()=>{});
    }
    return response;
  },
  async (error) => {
    const status = error.response?.status;

    // CRITICAL FIX: Only log out on 401 Unauthorized. 
    // 403 Forbidden means permission denied, NOT an invalid session.
    if (status === 401) {
      console.warn('Session invalidated by server. Logging out.');
      try {
        await AsyncStorage.multiRemove(['user', 'token', 'user_role']);
      } catch (e) {
        console.log("Error clearing storage:", e);
      }
    }
    return Promise.reject(error);
  }
);

export const toAbsUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${FILE_BASE}${path}`;
};

export default api;
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*==========================================
  1. LOCAL DEVELOPMENT
  ========================================== 
*/

const BASE_IP = '192.168.1.24'; 
export const FILE_BASE = `http://${BASE_IP}:8000`;
const BASE_URL = `${FILE_BASE}/api`; 


/* ==========================================
  2. PRODUCTION (Deployed to the Web)
  ========================================== 
  Uncomment this section when backend is live on the internet.
  Replace the URL with actual deployed backend link!
*/
// export const FILE_BASE = 'https://your-live-backend-website.com'; 
// const BASE_URL = `${FILE_BASE}/api`;


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
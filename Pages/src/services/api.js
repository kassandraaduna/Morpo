import axios from 'axios';

// Switch this to live server URL when backend is depoyed, e.g., 'https://mypholens-api.onrender.com/api'
const BASE_URL = 'http://192.168.1.24:8000/api'; 
export const FILE_BASE = 'http://192.168.1.24:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  config => {
    console.log('API REQUEST:', config.method?.toUpperCase(), config.baseURL + config.url);
    return config;
  },
  error => Promise.reject(error)
);

api.interceptors.response.use(
  response => response,
  error => Promise.reject(error)
);

export default api;
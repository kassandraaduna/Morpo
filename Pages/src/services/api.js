import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.1.24:8000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  config => {
    console.log(
      'API REQUEST:',
      config.method?.toUpperCase(),
      config.baseURL + config.url,
      config.data
    );
    return config;
  },
  error => Promise.reject(error)
);

api.interceptors.response.use(
  response => {
    console.log(
      'API RESPONSE:',
      response.config.url,
      response.data
    );
    return response;
  },
  error => {
    console.log(
      'API ERROR:',
      error?.response?.status,
      error?.response?.data || error.message
    );
    return Promise.reject(error);
  }
);

export default api;
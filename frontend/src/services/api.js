import axios from 'axios';
import { auth } from '../firebase';

export const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    import.meta.env.REACT_APP_API_URL ||
    'http://localhost:5000';

const API = axios.create({
    baseURL: `${API_BASE_URL}/api`
});

// 🛡️ ZERO-TRUST AUTO-INJECTION (Interceptors)
API.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default API;

export const getAuthToken = async () => {
    const user = auth.currentUser;
    return user ? user.getIdToken() : null;
};

export const authenticatedApiUrl = async (path) => {
    const token = await getAuthToken();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${API_BASE_URL}/api${cleanPath}`);
    if (token) url.searchParams.set('token', token);
    return url.toString();
};

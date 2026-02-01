// Local Authentication (replaces Supabase Auth)
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`;

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const authLocal = {
    // Login
    async signIn(email, password) {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                email,
                password
            });

            const { access_token, user } = response.data;

            // Store token and user info
            localStorage.setItem(TOKEN_KEY, access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));

            return { data: { user, session: { access_token } }, error: null };
        } catch (error) {
            return {
                data: { user: null, session: null },
                error: { message: error.response?.data?.detail || 'Error de autenticación' }
            };
        }
    },

    // Get current session
    async getSession() {
        const token = localStorage.getItem(TOKEN_KEY);
        const userStr = localStorage.getItem(USER_KEY);

        if (!token || !userStr) {
            return { data: { session: null }, error: null };
        }

        try {
            const user = JSON.parse(userStr);
            return {
                data: {
                    session: {
                        access_token: token,
                        user
                    }
                },
                error: null
            };
        } catch {
            return { data: { session: null }, error: null };
        }
    },

    // Sign out
    async signOut() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        return { error: null };
    },

    // Get access token
    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }
};

// For compatibility with existing code that uses supabase.auth
export const supabase = {
    auth: {
        signInWithPassword: async ({ email, password }) => {
            return authLocal.signIn(email, password);
        },
        getSession: async () => {
            return authLocal.getSession();
        },
        signOut: async () => {
            return authLocal.signOut();
        },
        onAuthStateChange: (callback) => {
            // Minimal mock: return a dummy subscription
            return {
                data: {
                    subscription: {
                        unsubscribe: () => { }
                    }
                }
            };
        }
    }
};

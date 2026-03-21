import { create } from 'zustand';
import { AuthController, LoginDTO, RegisterDTO } from '../controllers/AuthController';
import { AuthManager } from '../core/identity/AuthManager';

// DI Setup for Store
const authManager = AuthManager.getInstance();
const authController = new AuthController(authManager);

interface AuthState {
    sessionToken: string | null;
    isLoading: boolean;
    userEmail: string | null;
    login: (data: LoginDTO) => Promise<boolean>;
    register: (data: RegisterDTO) => Promise<boolean>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    sessionToken: null,
    isLoading: false,
    userEmail: null,

    login: async (data: LoginDTO) => {
        set({ isLoading: true });
        try {
            const response = await authController.login(data);
            if (response.status === 200 && response.data) {
                set({ sessionToken: response.data.token, userEmail: data.email, isLoading: false });
                return true;
            }
            set({ isLoading: false });
            return false;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    register: async (data: RegisterDTO) => {
        set({ isLoading: true });
        try {
            const response = await authController.register(data);
            set({ isLoading: false });
            return response.status === 201;
        } catch (error) {
            set({ isLoading: false });
            // Let the UI handle the exception to show specific messages
            throw error;
        }
    },

    logout: async () => {
        set({ sessionToken: null, userEmail: null });
    }
}));

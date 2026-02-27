import { create } from 'zustand';

interface ToastState {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface UIState {
    toast: ToastState;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    hideToast: () => void;
    isGlobalLoading: boolean;
    setGlobalLoading: (isLoading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    toast: { visible: false, message: '', type: 'info' },
    showToast: (message, type = 'info') => {
        set({ toast: { visible: true, message, type } });
        setTimeout(() => {
            set((state) => ({ toast: { ...state.toast, visible: false } }));
        }, 3000); // Auto hide after 3 seconds
    },
    hideToast: () => set((state) => ({ toast: { ...state.toast, visible: false } })),
    isGlobalLoading: false,
    setGlobalLoading: (isLoading: boolean) => set({ isGlobalLoading: isLoading }),
}));

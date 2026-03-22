import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthManager } from '../core/identity/AuthManager';
import { router } from 'expo-router';
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
    themePreference: 'system' | 'light' | 'dark';
    setThemePreference: (theme: 'system' | 'light' | 'dark') => void;
    tooltipStep: number;
    setTooltipStep: (step: number) => void;
    handleNextTooltip: () => Promise<void>;
    handleSkipTooltip: () => Promise<void>;
    mapTooltipVisible: boolean;
    setMapTooltipVisible: (visible: boolean) => void;
    handleDismissMapTooltip: () => Promise<void>;
    createTooltipStep: number;
    setCreateTooltipStep: (step: number) => void;
    handleNextCreateTooltip: () => Promise<void>;
    handleSkipCreateTooltip: () => Promise<void>;
    profileTooltipVisible: boolean;
    setProfileTooltipVisible: (visible: boolean) => void;
    handleDismissProfileTooltip: () => Promise<void>;
}

export const useUIStore = create<UIState>((set, get) => ({
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
    themePreference: 'dark', // Defaulting to dark as requested since it's the current theme
    setThemePreference: (theme) => set({ themePreference: theme }),
    tooltipStep: -1,
    setTooltipStep: (step) => set({ tooltipStep: step }),
    handleNextTooltip: async () => {
        const { tooltipStep } = get();
        if (tooltipStep < 3) {
            set({ tooltipStep: -1 }); // unmount current modal
            setTimeout(() => {
                set({ tooltipStep: tooltipStep + 1 });
            }, 300); // 300ms delay for iOS modal transition
        } else {
            set({ tooltipStep: -1 });
            const user = await AuthManager.getInstance().getCurrentUser();
            if (user) {
                await AsyncStorage.setItem(`@has_seen_events_onboarding_${user.id}`, "true");
            }
            setTimeout(() => {
                try { router.push('/(tabs)/map'); } catch (e) { }
            }, 350);
        }
    },
    handleSkipTooltip: async () => {
        set({ tooltipStep: -1 });
        const user = await AuthManager.getInstance().getCurrentUser();
        if (user) {
            await AsyncStorage.setItem(`@has_seen_events_onboarding_${user.id}`, "true");
            await AsyncStorage.setItem(`@has_seen_map_onboarding_${user.id}`, "true");
            await AsyncStorage.setItem(`@has_seen_create_onboarding_${user.id}`, "true");
            await AsyncStorage.setItem(`@has_seen_profile_onboarding_${user.id}`, "true");
        }
    },
    mapTooltipVisible: false,
    setMapTooltipVisible: (visible) => set({ mapTooltipVisible: visible }),
    handleDismissMapTooltip: async () => {
        set({ mapTooltipVisible: false });
        const user = await AuthManager.getInstance().getCurrentUser();
        if (user) {
            await AsyncStorage.setItem(`@has_seen_map_onboarding_${user.id}`, "true");
        }
        setTimeout(() => {
            try { router.push('/(tabs)/create'); } catch (e) { }
        }, 350);
    },
    createTooltipStep: -1,
    setCreateTooltipStep: (step: number) => set({ createTooltipStep: step }),
    handleNextCreateTooltip: async () => {
        const { createTooltipStep } = get();
        if (createTooltipStep < 2) {
            set({ createTooltipStep: -1 }); // unmount current modal
            setTimeout(() => {
                set({ createTooltipStep: createTooltipStep + 1 });
            }, 300); // 300ms delay for iOS modal transition
        } else {
            set({ createTooltipStep: -1 });
            const user = await AuthManager.getInstance().getCurrentUser();
            if (user) {
                await AsyncStorage.setItem(`@has_seen_create_onboarding_${user.id}`, "true");
            }
            setTimeout(() => {
                try { router.push('/(tabs)/profile'); } catch (e) { }
            }, 350);
        }
    },
    handleSkipCreateTooltip: async () => {
        set({ createTooltipStep: -1 });
        const user = await AuthManager.getInstance().getCurrentUser();
        if (user) {
            await AsyncStorage.setItem(`@has_seen_create_onboarding_${user.id}`, "true");
            await AsyncStorage.setItem(`@has_seen_profile_onboarding_${user.id}`, "true");
        }
    },
    profileTooltipVisible: false,
    setProfileTooltipVisible: (visible) => set({ profileTooltipVisible: visible }),
    handleDismissProfileTooltip: async () => {
        set({ profileTooltipVisible: false });
        const user = await AuthManager.getInstance().getCurrentUser();
        if (user) {
            await AsyncStorage.setItem(`@has_seen_profile_onboarding_${user.id}`, "true");
        }
        setTimeout(() => {
            try { router.push('/(tabs)'); } catch (e) { }
        }, 350);
    }
}));

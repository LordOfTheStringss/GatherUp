export interface ThemeColors {
    background: string;
    card: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
    primary: string;
    primaryLight: string;
    danger: string;
    dangerBg: string;
    headerIconBg: string;
    inputBg: string;
    inputBorder: string;
}

export const darkTheme: ThemeColors = {
    background: '#15202B',     // Slate 900
    card: '#1C2733',           // Slate 800
    cardBorder: '#2B3847',     // Slate 700
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    primary: '#3B82F6',
    primaryLight: 'rgba(59, 130, 246, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.1)',
    headerIconBg: '#1C2733',
    inputBg: '#1C2733',
    inputBorder: '#2B3847',
};

export const lightTheme: ThemeColors = {
    background: '#FFFFFF',
    card: '#F8FAFC',
    cardBorder: '#E2E8F0',
    textPrimary: '#15202B',
    textSecondary: '#64748B',
    primary: '#3B82F6',
    primaryLight: 'rgba(59, 130, 246, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.1)',
    headerIconBg: '#F1F5F9',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
};

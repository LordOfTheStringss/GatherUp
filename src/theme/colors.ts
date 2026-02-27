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
    background: '#020617',
    card: '#0F172A',
    cardBorder: '#1E293B',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    primary: '#3B82F6',
    primaryLight: 'rgba(59, 130, 246, 0.1)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.1)',
    headerIconBg: '#0F172A',
    inputBg: '#0F172A',
    inputBorder: '#1E293B',
};

export const lightTheme: ThemeColors = {
    background: '#FFFFFF',
    card: '#F8FAFC',
    cardBorder: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    primary: '#3B82F6',
    primaryLight: 'rgba(59, 130, 246, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.1)',
    headerIconBg: '#F1F5F9',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
};

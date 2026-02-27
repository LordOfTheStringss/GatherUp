import { useColorScheme } from 'react-native';
import { useUIStore } from '../store/uiStore';
import { darkTheme, lightTheme, ThemeColors } from './colors';

export const useTheme = (): ThemeColors => {
    const systemColorScheme = useColorScheme();
    const { themePreference } = useUIStore();

    let activeMode = themePreference;
    if (activeMode === 'system') {
        activeMode = systemColorScheme === 'light' ? 'light' : 'dark';
    }

    return activeMode === 'light' ? lightTheme : darkTheme;
};

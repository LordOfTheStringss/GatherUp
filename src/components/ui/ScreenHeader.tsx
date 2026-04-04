import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { ThemeColors } from '../../theme/colors';

interface ScreenHeaderProps {
    title: string;
    leftIcon?: keyof typeof Ionicons.glyphMap;
    onLeftPress?: () => void;
    rightIcon?: keyof typeof Ionicons.glyphMap;
    onRightPress?: () => void;
    rightText?: string;
    showBorder?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
    title,
    leftIcon = 'chevron-back',
    onLeftPress,
    rightIcon,
    onRightPress,
    rightText,
    showBorder = true,
}) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(theme, insets);

    return (
        <View style={[
            styles.header, 
            showBorder && { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }
        ]}>
            <View style={styles.leftContainer}>
                {onLeftPress && (
                    <TouchableOpacity onPress={onLeftPress} style={styles.iconBtn} activeOpacity={0.7}>
                        <Ionicons name={leftIcon as any} size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.title} numberOfLines={1}>{title}</Text>

            <View style={styles.rightContainer}>
                {onRightPress && (
                    <TouchableOpacity onPress={onRightPress} style={styles.rightBtn} activeOpacity={0.7}>
                        {rightIcon ? (
                            <Ionicons name={rightIcon as any} size={26} color={theme.primary} />
                        ) : rightText ? (
                            <Text style={styles.rightText}>{rightText}</Text>
                        ) : null}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors, insets: any) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        // Handling safe area top inset + minimum padding
        paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 20) : 10,
        backgroundColor: theme.background,
    },
    leftContainer: {
        width: 60,
        alignItems: 'flex-start',
    },
    rightContainer: {
        width: 60,
        alignItems: 'flex-end',
    },
    iconBtn: {
        minHeight: 44,
        minWidth: 44,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: '800',
        color: theme.textPrimary,
        textAlign: 'center',
    },
    rightBtn: {
        minHeight: 44,
        justifyContent: 'center',
    },
    rightText: {
        color: theme.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
});

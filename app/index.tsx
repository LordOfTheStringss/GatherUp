import { useEffect, useRef } from "react";
import { Redirect, router, Stack } from "expo-router";
import { Animated, View, StyleSheet, Text, Dimensions, TouchableOpacity } from "react-native";
import { useAuthStore } from "../src/store/authStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/useTheme";

const { width, height } = Dimensions.get('window');

export default function Index() {
    const { sessionToken, logout } = useAuthStore();
    const theme = useTheme();
    const styles = createStyles(theme);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(30)).current;
    const btnFade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
                Animated.timing(slideUp, { toValue: 0, duration: 1000, useNativeDriver: true }),
            ]),
            Animated.timing(btnFade, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]).start();

        const checkAuthAndRedirect = async () => {
            if (sessionToken) {
                // Check if user wanted to stay signed in
                const keepInStr = await AsyncStorage.getItem('@keep_me_signed_in');
                const keepIn = keepInStr === null ? true : JSON.parse(keepInStr);

                if (!keepIn) {
                    await logout();
                    return;
                }

                const timer = setTimeout(() => router.replace("/(tabs)"), 2200);
                return () => clearTimeout(timer);
            }
        };

        checkAuthAndRedirect();
    }, [sessionToken]);

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.content}>
                <Animated.View style={[styles.sloganArea, { opacity: fadeAnim, transform: [{ translateY: slideUp }] }]}>
                    <Text style={styles.slogan}>Plan together.</Text>
                    <Text style={styles.slogan}>Meet up.</Text>
                    <Text style={styles.sloganHighlight}>Level up.</Text>
                </Animated.View>

                <Animated.View style={[styles.brandArea, { opacity: fadeAnim }]}>
                    <Text style={styles.brand}>
                        Gather<Text style={styles.brandAccent}>Up</Text>
                    </Text>
                </Animated.View>

                <Animated.View style={[styles.ctaArea, { opacity: btnFade }]}>
                    <TouchableOpacity
                        style={styles.mainBtn}
                        onPress={() => router.push("/(auth)/login")}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.mainBtnText}>Get Started</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    </TouchableOpacity>
                </Animated.View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>© 2026 GatherUp Network</Text>
            </View>
        </View>
    );
}

const createStyles = (theme: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    sloganArea: {
        alignItems: 'center',
        marginBottom: 80,
    },
    slogan: {
        fontSize: 28,
        color: theme.textSecondary,
        fontWeight: '400',
        lineHeight: 40,
        letterSpacing: 0.5,
    },
    sloganHighlight: {
        fontSize: 32,
        color: theme.accent || '#FB7185',
        fontWeight: '800',
        lineHeight: 48,
        marginTop: 6,
    },
    brandArea: {
        alignItems: 'center',
        marginBottom: 80,
    },
    brand: {
        fontSize: 44,
        fontWeight: '900',
        color: theme.textPrimary,
        letterSpacing: -1,
    },
    brandAccent: {
        color: theme.primary,
    },
    ctaArea: {
        width: '100%',
        alignItems: 'center',
    },
    mainBtn: {
        flexDirection: 'row',
        backgroundColor: theme.primary,
        paddingVertical: 18,
        paddingHorizontal: 44,
        borderRadius: 24,
        alignItems: 'center',
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    mainBtnText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '800',
        marginRight: 12,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
    },
    footerText: {
        color: theme.textSecondary,
        opacity: 0.5,
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 1,
    },
});

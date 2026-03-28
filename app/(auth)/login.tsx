import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { useUIStore } from '../../src/store/uiStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthManager } from '../../src/core/identity/AuthManager';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';

export default function LoginScreen() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [keepMeSignedIn, setKeepMeSignedIn] = useState(true);
    const { login } = useAuthStore();
    const { showToast } = useUIStore();
    const theme = useTheme();
    const styles = createStyles(theme);

    const handleLogin = async () => {
        if (!identifier || !password) {
            showToast('Please enter your credentials.', 'error');
            return;
        }

        try {
            const success = await login({ email: identifier, password });
            if (success) {
                try {
                    const user = await AuthManager.getInstance().getCurrentUser();
                    // Save the "Keep me signed in" preference
                    await AsyncStorage.setItem('@keep_me_signed_in', JSON.stringify(keepMeSignedIn));
                    
                    if (user) {
                        await AsyncStorage.setItem(`@has_seen_events_onboarding_${user.id}`, "true");
                        await AsyncStorage.setItem(`@has_seen_map_onboarding_${user.id}`, "true");
                        await AsyncStorage.setItem(`@has_seen_create_onboarding_${user.id}`, "true");
                        await AsyncStorage.setItem(`@has_seen_profile_onboarding_${user.id}`, "true");
                    }
                } catch (e) {
                    console.warn("Onboarding state error", e);
                }
                showToast('Welcome back!', 'success');
                router.replace('/(tabs)');
            } else {
                showToast('Invalid credentials.', 'error');
            }
        } catch (error: any) {
            showToast(error.message || 'Login failed.', 'error');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="people" size={40} color={theme.primary} />
                    </View>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to your trusted circle</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username or Email"
                            placeholderTextColor={theme.textSecondary}
                            value={identifier}
                            onChangeText={setIdentifier}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Password"
                            placeholderTextColor={theme.textSecondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.optionsRow}>
                        <TouchableOpacity 
                            style={styles.checkboxContainer} 
                            onPress={() => setKeepMeSignedIn(!keepMeSignedIn)}
                            activeOpacity={0.7}
                        >
                            <Ionicons 
                                name={keepMeSignedIn ? "checkbox" : "square-outline"} 
                                size={22} 
                                color={keepMeSignedIn ? theme.primary : theme.textSecondary} 
                            />
                            <Text style={styles.checkboxLabel}>Keep me signed in</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.forgotBtn}>
                            <Text style={styles.forgotText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} activeOpacity={0.8}>
                        <Text style={styles.loginBtnText}>Sign In</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>New to GatherUp? </Text>
                    <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                        <Text style={styles.signUpText}>Create Account</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 80,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: theme.cardBorder,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: theme.textPrimary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: theme.textSecondary,
        fontWeight: '500',
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.inputBg,
        borderRadius: 16,
        marginBottom: 16,
        paddingHorizontal: 16,
        height: 60,
        borderWidth: 1,
        borderColor: theme.inputBorder,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: theme.textPrimary,
        fontSize: 16,
    },
    eyeIcon: {
        padding: 8,
    },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginBottom: 32,
    },
    forgotText: {
        color: theme.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxLabel: {
        marginLeft: 8,
        color: theme.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    loginBtn: {
        backgroundColor: theme.primary,
        height: 60,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    loginBtnText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 'auto',
        paddingTop: 40,
    },
    footerText: {
        color: theme.textSecondary,
        fontSize: 15,
    },
    signUpText: {
        color: theme.primary,
        fontSize: 15,
        fontWeight: '700',
    },
    backBtn: {
        position: 'absolute',
        top: 20,
        left: 0,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.card,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderWidth: 1,
        borderColor: theme.cardBorder,
    },
});

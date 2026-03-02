import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { useUIStore } from '../../src/store/uiStore';

export default function LoginScreen() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuthStore();
    const { showToast } = useUIStore();

    const handleLogin = async () => {
        if (!identifier || !password) {
            showToast('Please enter your username/email and password.', 'error');
            return;
        }

        try {
            const success = await login({ email: identifier, password });
            if (success) {
                showToast('Login successful!', 'success');
                router.replace('/(tabs)');
            } else {
                showToast('Login failed. Please check your credentials.', 'error');
            }
        } catch (error: any) {
            showToast(error.message || 'An unexpected error occurred.', 'error');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.formContainer}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>Gather<Text style={{ color: '#3B82F6' }}>Up</Text></Text>
                </View>

                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Log in to access your trusted circle.</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Username or Institutional Email"
                    placeholderTextColor="#7f8c8d"
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                />

                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#7f8c8d"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                    <Text style={styles.buttonText}>Log In</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.linkTouchTarget}>
                        <Text style={styles.linkText}>Sign Up</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A', // OLED friendly dark mode
    },
    formContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoText: {
        fontSize: 32,
        fontWeight: '900',
        color: '#F8FAFC',
        letterSpacing: -0.5,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#94A3B8',
        marginBottom: 32,
    },
    input: {
        backgroundColor: '#1E293B',
        color: '#FFFFFF',
        height: 52,
        borderRadius: 8,
        paddingHorizontal: 16,
        marginBottom: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    button: {
        backgroundColor: '#3B82F6',
        height: 52,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    footerText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    linkTouchTarget: {
        minHeight: 44, // 44px minimum touch target
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    linkText: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: 'bold',
    }
});

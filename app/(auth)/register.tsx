import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { useUIStore } from '../../src/store/uiStore';

export default function RegisterScreen() {
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [age, setAge] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [baseLocation, setBaseLocation] = useState('');
    const { register } = useAuthStore();
    const { showToast } = useUIStore();

    const handleRegister = async () => {
        if (!fullName || !username || !age || !email || !password || !confirmPassword || !baseLocation) {
            showToast('Please fill in all fields.', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            return;
        }

        try {
            const success = await register({ fullName, username, age, email, password, baseLocation });
            if (success) {
                showToast('Registration successful! Check your email to verify.', 'success');
                // Navigating to interest selection or login
                router.push('/(auth)/interests'); // We will build this next
            } else {
                showToast('Registration failed.', 'error');
            }
        } catch (error: any) {
            // Typically domain violation throws InvalidDomainException
            showToast(error.message || 'Domain violation or network error.', 'error');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>Gather<Text style={{ color: '#3B82F6' }}>Up</Text></Text>
                </View>

                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Use your institutional email to join your campus network.</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#7f8c8d"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                />

                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#7f8c8d"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                />

                <TextInput
                    style={styles.input}
                    placeholder="Age"
                    placeholderTextColor="#7f8c8d"
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                    maxLength={3}
                />

                <TextInput
                    style={styles.input}
                    placeholder="Institutional Email (e.g., student@abc.edu.tr)"
                    placeholderTextColor="#7f8c8d"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <Text style={{ color: '#F8FAFC', marginBottom: 8, marginLeft: 4, fontWeight: '600' }}>Base Location (Ankara)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {require('../../src/data/locations').ANKARA_NEIGHBORHOODS.map((loc: any) => (
                        <TouchableOpacity
                            key={loc.id}
                            style={{
                                backgroundColor: baseLocation === loc.label ? 'rgba(59, 130, 246, 0.2)' : '#1C2733',
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                borderRadius: 20,
                                marginRight: 8,
                                borderWidth: 1,
                                borderColor: baseLocation === loc.label ? '#3B82F6' : '#2B3847'
                            }}
                            onPress={() => setBaseLocation(loc.label)}
                        >
                            <Text style={{ color: baseLocation === loc.label ? '#3B82F6' : '#94A3B8', fontWeight: '500' }}>
                                {loc.label.split(',')[0]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#7f8c8d"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#7f8c8d"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                />

                <TouchableOpacity style={styles.button} onPress={handleRegister}>
                    <Text style={styles.buttonText}>Sign Up</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.linkTouchTarget}>
                        <Text style={styles.linkText}>Log In</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#15202B',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
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
        backgroundColor: '#1C2733',
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
        minHeight: 44, // Ensuring minimum touch target of 44px
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    linkText: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: 'bold',
    }
});

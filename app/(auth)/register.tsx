import { router } from 'expo-router';
import React, { useState, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { useUIStore } from '../../src/store/uiStore';
import { Ionicons } from '@expo/vector-icons';
import { ANKARA_NEIGHBORHOODS } from '../../src/data/locations';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { UserManager } from '../../src/core/identity/UserManager';

export default function RegisterScreen() {
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [age, setAge] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [baseLocation, setBaseLocation] = useState('');
    const [baseLocationSearch, setBaseLocationSearch] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [profilePic, setProfilePic] = useState<string | null>(null);

    const { register } = useAuthStore();
    const { showToast } = useUIStore();
    const theme = useTheme();
    const styles = createStyles(theme);
    const filteredNeighborhoods = useMemo(() => {
        if (!baseLocationSearch) return ANKARA_NEIGHBORHOODS;
        return ANKARA_NEIGHBORHOODS.filter(n =>
            n.label.toLowerCase().includes(baseLocationSearch.toLowerCase())
        );
    }, [baseLocationSearch]);

    const pickImage = async () => {
        const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!granted) {
            showToast('Permission to access gallery is required.', 'error');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setProfilePic(result.assets[0].uri);
        }
    };

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
            const userId = await register({ fullName, username, age, email, password, baseLocation });
            if (userId) {
                // If a profile picture was selected, upload it
                if (profilePic) {
                    try {
                        console.log("Register: Uploading profile photo for new user", userId);
                        await UserManager.getInstance().uploadAvatar(userId, profilePic);
                    } catch (uploadError) {
                        console.error("Register: Photo upload failed", uploadError);
                        showToast('Profile created, but photo upload failed. You can add it later.', 'info');
                    }
                }
                showToast('Registration successful! Verify your email.', 'success');
                router.push('/(auth)/interests');
            } else {
                showToast('Registration failed.', 'error');
            }
        } catch (error: any) {
            showToast(error.message || 'Registration failed.', 'error');
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <TouchableOpacity 
                    style={styles.backBtn} 
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.title}>Join GatherUp</Text>
                    <Text style={styles.subtitle}>Create your profile to start meeting</Text>
                </View>

                {/* Avatar Picker Logic */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity style={styles.avatarWrapper} onPress={pickImage} activeOpacity={0.8}>
                        {profilePic ? (
                            <ExpoImage source={{ uri: profilePic }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Ionicons name="camera-outline" size={32} color={theme.textSecondary} />
                                <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
                            </View>
                        )}
                        <View style={styles.avatarAddBadge}>
                            <Ionicons name="add" size={20} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.form}>
                    <InputGroup label="Full Name" icon="person-outline" theme={theme} styles={styles}>
                        <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor={theme.textSecondary} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
                    </InputGroup>

                    <InputGroup label="Username" icon="at-outline" theme={theme} styles={styles}>
                        <TextInput style={styles.input} placeholder="johndoe123" placeholderTextColor={theme.textSecondary} value={username} onChangeText={setUsername} autoCapitalize="none" />
                    </InputGroup>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 0.4 }]}>
                            <Text style={styles.label}>AGE</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput style={styles.input} placeholder="18" placeholderTextColor={theme.textSecondary} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} />
                            </View>
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                            <Text style={styles.label}>EMAIL (INSTITUTIONAL)</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput style={styles.input} placeholder="john@university.edu.tr" placeholderTextColor={theme.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" />
                            </View>
                        </View>
                    </View>

                    <InputGroup label="Password" icon="lock-closed-outline" theme={theme} styles={styles}>
                        <TextInput 
                            style={styles.input} 
                            placeholder="••••••••" 
                            placeholderTextColor={theme.textSecondary} 
                            value={password} 
                            onChangeText={setPassword} 
                            secureTextEntry={!showPassword}
                            textContentType="oneTimeCode"
                            importantForAutofill="no"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </InputGroup>

                    <InputGroup label="Confirm Password" icon="checkmark-circle-outline" theme={theme} styles={styles}>
                        <TextInput 
                            style={styles.input} 
                            placeholder="••••••••" 
                            placeholderTextColor={theme.textSecondary} 
                            value={confirmPassword} 
                            onChangeText={setConfirmPassword} 
                            secureTextEntry={!showPassword}
                            textContentType="oneTimeCode"
                            importantForAutofill="no"
                        />
                    </InputGroup>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>BASE NEIGHBORHOOD</Text>
                        <View style={styles.searchWrapper}>
                            <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={{ marginLeft: 12 }} />
                            <TextInput style={styles.searchInput} placeholder="Filter Ankara neighborhoods..." placeholderTextColor={theme.textSecondary} value={baseLocationSearch} onChangeText={setBaseLocationSearch} />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
                            {filteredNeighborhoods.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.chip, baseLocation === item.label && styles.chipActive]}
                                    onPress={() => setBaseLocation(item.label)}
                                >
                                    <Text style={[styles.chipText, baseLocation === item.label && styles.chipTextActive]}>
                                        {item.label.split(',')[0]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} activeOpacity={0.8}>
                        <Text style={styles.registerBtnText}>Create My Profile</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                        <Text style={styles.loginText}>Sign In</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function InputGroup({ label, icon, theme, styles, children }: { label: string; icon: string; theme: ThemeColors; styles: any; children: React.ReactNode }) {
    return (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label.toUpperCase()}</Text>
            <View style={styles.inputWrapper}>
                <Ionicons name={icon as any} size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
                {children}
            </View>
        </View>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
    header: { marginBottom: 32 },
    title: { fontSize: 32, fontWeight: '900', color: theme.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 15, color: theme.textSecondary, lineHeight: 22 },
    form: { width: '100%' },
    inputGroup: { marginBottom: 20 },
    row: { flexDirection: 'row' },
    label: { color: theme.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 4, letterSpacing: 0.8 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: theme.inputBorder },
    searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 12, height: 44, marginBottom: 12, borderWidth: 1, borderColor: theme.inputBorder },
    searchInput: { flex: 1, color: theme.textPrimary, fontSize: 14, paddingHorizontal: 10 },
    input: { flex: 1, color: theme.textPrimary, fontSize: 15 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.inputBg, marginRight: 8, borderWidth: 1, borderColor: theme.inputBorder },
    chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { color: theme.textSecondary, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: '#FFF' },
    registerBtn: { backgroundColor: theme.primary, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 20, shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
    registerBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
    footerText: { color: theme.textSecondary, fontSize: 14 },
    loginText: { color: theme.primary, fontSize: 14, fontWeight: '700' },
    backBtn: {
        position: 'absolute',
        top: 10,
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
    avatarSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: theme.inputBg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.primary,
        borderStyle: 'dashed',
        position: 'relative',
    },
    avatarImage: {
        width: 116,
        height: 116,
        borderRadius: 58,
    },
    avatarPlaceholder: {
        alignItems: 'center',
    },
    avatarPlaceholderText: {
        fontSize: 12,
        color: theme.textSecondary,
        fontWeight: '600',
        marginTop: 4,
    },
    avatarAddBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: theme.primary,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: theme.background,
    },
});

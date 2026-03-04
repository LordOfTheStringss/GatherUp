import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { useUIStore } from '../../src/store/uiStore';

export default function EditProfileScreen() {
    const { showToast, setGlobalLoading } = useUIStore();
    const { userEmail } = useAuthStore();

    // Local State
    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [baseLoc, setBaseLoc] = useState('');
    const [profilePic, setProfilePic] = useState<string | null>(null);

    React.useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { UserController } = await import('../../src/controllers/UserController');
                const { UserManager } = await import('../../src/core/identity/UserManager');
                const controller = new UserController(UserManager.getInstance(), {} as any, {} as any);
                const res = await controller.getMyProfile();
                if (res.status === 200 && res.data) {
                    setName(res.data.fullName || '');
                    setBio(res.data.bio || '');
                    setBaseLoc(res.data.baseLocation || '');
                }
            } catch (e) {
                console.error("Failed to load profile:", e);
            }
        };
        fetchProfile();
    }, []);

    const pickImage = async () => {
        // Request permissions
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            showToast('You need to grant permission to access your photos.', 'error');
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
            showToast('Profile photo updated!', 'success');
        }
    };

    const handleSave = async () => {
        const { UserController } = await import('../../src/controllers/UserController');
        const { UserManager } = await import('../../src/core/identity/UserManager');
        const { FriendshipManager } = await import('../../src/core/identity/FriendshipManager');
        const { GamificationManager } = await import('../../src/core/identity/GamificationManager');

        const userController = new UserController(
            UserManager.getInstance(),
            {} as any, // FriendshipManager (stub for now if not needed)
            {} as any  // GamificationManager (stub for now if not needed)
        );

        setGlobalLoading(true);
        try {
            await userController.updateProfile(undefined, {
                name: name,
                bio: bio,
                baseLocation: baseLoc
            });
            setGlobalLoading(false);
            showToast('Profile details saved.', 'success');
            router.back();
        } catch (error) {
            setGlobalLoading(false);
            showToast('Failed to save profile.', 'error');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                {/* Profile Picture Section */}
                <View style={styles.imageSection}>
                    <TouchableOpacity onPress={pickImage} style={styles.imageContainer} activeOpacity={0.8}>
                        {profilePic ? (
                            <Image source={{ uri: profilePic }} style={styles.profileImage} />
                        ) : (
                            <View style={styles.placeholderImage}>
                                <Text style={styles.placeholderText}>{userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}</Text>
                            </View>
                        )}
                        <View style={styles.editIconBadge}>
                            <Ionicons name="camera" size={20} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.imageHelpText}>Tap to change profile picture</Text>
                </View>

                {/* Form Fields */}
                <View style={styles.formSection}>
                    <Text style={styles.label}>DISPLAY NAME</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="#64748B"
                    />

                    <Text style={styles.label}>BIO</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={bio}
                        onChangeText={setBio}
                        placeholderTextColor="#64748B"
                        multiline={true}
                        textAlignVertical="top"
                    />

                    <Text style={styles.label}>BASE LOCATION / NEIGHBORHOOD</Text>
                    <TextInput
                        style={styles.input}
                        value={baseLoc}
                        onChangeText={setBaseLoc}
                        placeholderTextColor="#64748B"
                        placeholder="e.g., Kadıköy, Beşiktaş"
                    />

                    <Text style={styles.label}>EMAIL ADDRESS (READ ONLY)</Text>
                    <TextInput
                        style={[styles.input, styles.disabledInput]}
                        value={userEmail || ''}
                        editable={false}
                    />
                </View>

                {/* Save Button */}
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0B1120' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
    backBtn: { minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', letterSpacing: 0.5 },

    container: { paddingHorizontal: 20, paddingBottom: 40 },

    imageSection: { alignItems: 'center', marginTop: 24, marginBottom: 40 },
    imageContainer: { width: 120, height: 120, borderRadius: 60, position: 'relative', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
    profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#3B82F6' },
    placeholderImage: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(59, 130, 246, 0.5)' },
    placeholderText: { fontSize: 48, fontWeight: '800', color: '#FFF' },
    editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#10B981', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#0B1120' },
    imageHelpText: { color: '#94A3B8', fontSize: 13, marginTop: 16, fontWeight: '500' },

    formSection: { marginBottom: 32 },
    label: { color: '#64748B', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
    input: { backgroundColor: '#15202B', color: '#F8FAFC', height: 56, borderRadius: 16, paddingHorizontal: 16, marginBottom: 24, borderWidth: 1, borderColor: '#1C2733', fontSize: 16 },
    textArea: { height: 120, paddingTop: 16 },
    disabledInput: { backgroundColor: '#0B1120', color: '#64748B', borderColor: '#15202B' },

    saveBtn: { backgroundColor: '#3B82F6', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    saveBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});

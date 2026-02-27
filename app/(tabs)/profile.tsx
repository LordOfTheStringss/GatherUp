import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { useUIStore } from '../../src/store/uiStore';

export default function ProfileScreen() {
    const { logout, userEmail } = useAuthStore();
    const { showToast, setGlobalLoading } = useUIStore();
    const [isAvailable, setIsAvailable] = useState(true);

    // Mock user statistics
    const stats = {
        eventsAttended: 12,
        eventsHosted: 3,
        trustedCircleCount: 45,
        reputationScore: 850
    };

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out of Gather Up?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        setGlobalLoading(true);
                        try {
                            await logout();
                            setGlobalLoading(false);
                            // AuthGuard takes care of routing, but we can explicitly route just in case
                            router.replace('/(auth)/login');
                            showToast('Logged out successfully', 'success');
                        } catch (error) {
                            setGlobalLoading(false);
                            showToast('Logout failed', 'error');
                        }
                    }
                }
            ]
        );
    };

    const handleManageInterests = () => {
        router.push('/(tabs)/edit-interests');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container}>

                {/* Header Information */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>{userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}</Text>
                        <View style={styles.badgeIcon}>
                            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                        </View>
                    </View>
                    <Text style={styles.userName}>Student User</Text>
                    <Text style={styles.userEmail}>{userEmail}</Text>

                    <View style={styles.reputationBadge}>
                        <Ionicons name="star" size={16} color="#F59E0B" />
                        <Text style={styles.reputationText}>{stats.reputationScore} Trust Score</Text>
                    </View>
                </View>

                {/* Statistics Grid */}
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{stats.eventsAttended}</Text>
                        <Text style={styles.statLabel}>Attended</Text>
                    </View>
                    <View style={styles.statBorder} />
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{stats.eventsHosted}</Text>
                        <Text style={styles.statLabel}>Hosted</Text>
                    </View>
                    <View style={styles.statBorder} />
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{stats.trustedCircleCount}</Text>
                        <Text style={styles.statLabel}>Friends</Text>
                    </View>
                </View>

                {/* Availability Toggle */}
                <View style={styles.availabilityContainer}>
                    <View style={styles.availabilityInfo}>
                        <Text style={styles.availabilityTitle}>Current Status</Text>
                        <Text style={styles.availabilityDesc}>
                            {isAvailable ? "AI can suggest you for plans." : "You're hidden from AI group plans."}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.availabilityToggle, isAvailable ? styles.toggleAvailable : styles.toggleBusy]}
                        onPress={() => setIsAvailable(!isAvailable)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.toggleKnobWrapper}>
                            <View style={[styles.toggleKnob, isAvailable ? styles.knobAvailable : styles.knobBusy]} />
                        </View>
                        <Text style={[styles.toggleText, isAvailable ? styles.textAvailable : styles.textBusy]}>
                            {isAvailable ? 'Available' : 'Busy'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Actions List */}
                <View style={styles.actionsContainer}>
                    <Text style={styles.sectionTitle}>Account Setup</Text>

                    <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(tabs)/edit-profile')} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                            <Ionicons name="person-outline" size={22} color="#3B82F6" />
                        </View>
                        <Text style={styles.actionText}>Edit Profile</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                            <Ionicons name="calendar-outline" size={22} color="#8B5CF6" />
                        </View>
                        <Text style={styles.actionText}>Update Schedule (OCR)</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} onPress={handleManageInterests} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                            <Ionicons name="heart-outline" size={22} color="#10B981" />
                        </View>
                        <Text style={styles.actionText}>Manage Interests</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748B" />
                    </TouchableOpacity>

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>System</Text>

                    <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                            <Ionicons name="settings-outline" size={22} color="#F59E0B" />
                        </View>
                        <Text style={styles.actionText}>Settings & Privacy</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={handleLogout} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                        </View>
                        <Text style={[styles.actionText, { color: '#EF4444' }]}>Log Out</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#020617' },
    container: { paddingBottom: 40 },

    header: { alignItems: 'center', paddingTop: 40, paddingBottom: 32 },
    avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16, elevation: 8, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
    avatarText: { fontSize: 40, fontWeight: '800', color: '#FFF' },
    badgeIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#020617', borderRadius: 12, padding: 2 },

    userName: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 4 },
    userEmail: { fontSize: 15, color: '#94A3B8', marginBottom: 16 },

    reputationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
    reputationText: { color: '#F59E0B', fontWeight: '700', marginLeft: 8 },

    statsContainer: { flexDirection: 'row', backgroundColor: '#0F172A', marginHorizontal: 20, borderRadius: 20, paddingVertical: 20, marginBottom: 24, borderWidth: 1, borderColor: '#1E293B' },
    statBox: { flex: 1, alignItems: 'center' },
    statBorder: { width: 1, backgroundColor: '#1E293B' },
    statValue: { fontSize: 24, fontWeight: '900', color: '#F8FAFC', marginBottom: 4 },
    statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

    availabilityContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F172A', marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: '#1E293B' },
    availabilityInfo: { flex: 1, paddingRight: 16 },
    availabilityTitle: { fontSize: 16, fontWeight: '800', color: '#F8FAFC', marginBottom: 4 },
    availabilityDesc: { fontSize: 13, color: '#94A3B8', lineHeight: 18 },
    availabilityToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 24, borderWidth: 1 },
    toggleAvailable: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' },
    toggleBusy: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' },
    toggleKnobWrapper: { marginRight: 8 },
    toggleKnob: { width: 8, height: 8, borderRadius: 4 },
    knobAvailable: { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
    knobBusy: { backgroundColor: '#EF4444' },
    toggleText: { fontSize: 14, fontWeight: '800' },
    textAvailable: { color: '#10B981' },
    textBusy: { color: '#EF4444' },

    actionsContainer: { paddingHorizontal: 20 },
    sectionTitle: { fontSize: 13, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, marginLeft: 8 },

    actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1E293B' },
    actionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    actionText: { flex: 1, fontSize: 16, color: '#F8FAFC', fontWeight: '600' },
});

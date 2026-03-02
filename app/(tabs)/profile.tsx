import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PanicButton } from '../../src/components/ui/PanicButton';
import { useAuthStore } from '../../src/store/authStore';
import { useUIStore } from '../../src/store/uiStore';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';

export default function ProfileScreen() {
    const { logout, userEmail } = useAuthStore();
    const { showToast, setGlobalLoading, themePreference, setThemePreference } = useUIStore();
    const theme = useTheme();
    const styles = createStyles(theme);
    const [isAvailable, setIsAvailable] = useState(true);
    const [stats, setStats] = useState({
        eventsAttended: 0,
        eventsHosted: 0,
        trustedCircleCount: 0,
        reputationScore: 0
    });
    const [friendsModalVisible, setFriendsModalVisible] = useState(false);
    const [friends, setFriends] = useState<any[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [newFriendUsername, setNewFriendUsername] = useState('');
    const [username, setUsername] = useState<string | null>(null);

    React.useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const { UserController } = await import('../../src/controllers/UserController');
                const { UserManager } = await import('../../src/core/identity/UserManager');
                const { FriendshipManager } = await import('../../src/core/identity/FriendshipManager');

                const userController = new UserController(UserManager.getInstance(), new FriendshipManager({} as any), {} as any);
                const res = await userController.getMyProfile();

                if (res.status === 200 && res.data) {
                    setUsername(res.data.fullName || null);
                    if (res.data.stats) {
                        setStats({
                            eventsAttended: res.data.stats.eventsAttended,
                            eventsHosted: res.data.stats.eventsHosted,
                            trustedCircleCount: res.data.stats.trustedCircleCount,
                            reputationScore: res.data.xp || 0
                        });
                    }
                }
            } catch (e) {
                console.error("Profile load err", e);
            }
        };
        fetchProfileData();
    }, []);

    const loadFriends = async () => {
        try {
            setGlobalLoading(true);
            const { SupabaseClient } = await import('../../src/infra/SupabaseClient');
            const { AuthManager } = await import('../../src/core/identity/AuthManager');
            const { FriendshipManager } = await import('../../src/core/identity/FriendshipManager');

            const sessionData = await AuthManager.getInstance().getCurrentUser();
            if (!sessionData) throw new Error("Not auth");

            const fm = new FriendshipManager({} as any);
            const circle = await fm.getTrustedCircle(sessionData.id);
            const requests = await fm.getPendingRequests(sessionData.id);

            setFriends(circle);
            setPendingRequests(requests);
            setGlobalLoading(false);
            setFriendsModalVisible(true);
        } catch (e: any) {
            setGlobalLoading(false);
            showToast(e.message, 'error');
        }
    };

    const handleSendRequest = async () => {
        if (!newFriendUsername.trim()) return;
        try {
            const { SupabaseClient } = await import('../../src/infra/SupabaseClient');
            const { AuthManager } = await import('../../src/core/identity/AuthManager');
            const sClient = SupabaseClient.getInstance().client;

            const userSession = await AuthManager.getInstance().getCurrentUser();

            // Search user by full_name or email
            const { data, error } = await sClient.from('users')
                .select('id')
                .or(`full_name.ilike.%${newFriendUsername}%,email.ilike.%${newFriendUsername}%`)
                .single();

            if (error || !data) {
                showToast("User not found!", "error");
                return;
            }

            const { error: insertErr } = await sClient.from('friendships').insert({
                user_id: userSession.id,
                friend_id: data.id
            });

            if (insertErr) throw new Error(insertErr.message);
            showToast("Friend request sent!", "success");
            setNewFriendUsername('');
        } catch (e: any) {
            showToast("Could not send request: " + e.message, "error");
        }
    };

    const handleAccept = async (friendId: string) => {
        try {
            const { AuthManager } = await import('../../src/core/identity/AuthManager');
            const { FriendshipManager } = await import('../../src/core/identity/FriendshipManager');
            const session = await AuthManager.getInstance().getCurrentUser();
            const fm = new FriendshipManager({} as any);
            await fm.acceptRequest(session.id, friendId);
            showToast('Request accepted!', 'success');
            loadFriends(); // Reload
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleReject = async (friendId: string) => {
        try {
            const { AuthManager } = await import('../../src/core/identity/AuthManager');
            const { FriendshipManager } = await import('../../src/core/identity/FriendshipManager');
            const session = await AuthManager.getInstance().getCurrentUser();
            const fm = new FriendshipManager({} as any);
            await fm.rejectRequest(session.id, friendId);
            showToast('Request rejected!', 'success');
            loadFriends(); // Reload
        } catch (e: any) {
            showToast(e.message, 'error');
        }
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
                    <Text style={styles.userName}>{username || (userEmail ? userEmail.split('@')[0].toUpperCase() : 'USER')}</Text>
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
                    <TouchableOpacity style={styles.statBox} onPress={loadFriends} activeOpacity={0.7}>
                        <Text style={styles.statValue}>{stats.trustedCircleCount}</Text>
                        <Text style={[styles.statLabel, { color: '#3B82F6' }]}>Friends</Text>
                    </TouchableOpacity>
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

                    <PanicButton />

                    <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(tabs)/edit-profile')} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                            <Ionicons name="person-outline" size={22} color="#3B82F6" />
                        </View>
                        <Text style={styles.actionText}>Edit Profile</Text>
                        <Ionicons name="chevron-forward" size={20} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(tabs)/ocr-schedule')} activeOpacity={0.7}>
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
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} onPress={() => {
                        const nextTheme = themePreference === 'dark' ? 'light' : themePreference === 'light' ? 'system' : 'dark';
                        setThemePreference(nextTheme);
                    }} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: theme.primaryLight }]}>
                            <Ionicons name="color-palette-outline" size={22} color={theme.primary} />
                        </View>
                        <Text style={styles.actionText}>Appearance: {themePreference.charAt(0).toUpperCase() + themePreference.slice(1)}</Text>
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={handleLogout} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                        </View>
                        <Text style={[styles.actionText, { color: '#EF4444' }]}>Log Out</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {friendsModalVisible && (
                <View style={StyleSheet.absoluteFillObject}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Friends & Requests</Text>
                            <TouchableOpacity onPress={() => setFriendsModalVisible(false)}>
                                <Ionicons name="close" size={28} color={theme.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ flex: 1 }}>
                            {pendingRequests.length > 0 && (
                                <View>
                                    <Text style={styles.modalSectionTitle}>Pending Requests</Text>
                                    {pendingRequests.map(r => (
                                        <View key={r.id} style={styles.friendRow}>
                                            <View style={styles.friendAvatar}>
                                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{r.full_name?.charAt(0)}</Text>
                                            </View>
                                            <Text style={styles.friendName}>{r.full_name}</Text>
                                            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(r.id)}>
                                                <Ionicons name="checkmark" size={20} color="#fff" />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(r.id)}>
                                                <Ionicons name="close" size={20} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text style={styles.modalSectionTitle}>My Friends</Text>
                            {friends.length === 0 && <Text style={{ marginLeft: 20, color: theme.textSecondary }}>No friends yet.</Text>}
                            {friends.map(f => (
                                <View key={f.id} style={styles.friendRow}>
                                    <View style={styles.friendAvatar}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{f.full_name?.charAt(0)}</Text>
                                    </View>
                                    <Text style={styles.friendName}>{f.full_name}</Text>
                                </View>
                            ))}

                            <Text style={[styles.modalSectionTitle, { marginTop: 32 }]}>Add More Friends</Text>
                            <View style={styles.addFriendRow}>
                                <View style={styles.addFriendInputContainer}>
                                    <Ionicons name="search" size={20} color="#64748B" />
                                    <TextInput
                                        style={styles.addFriendInput}
                                        placeholder="Username or E-mail"
                                        placeholderTextColor="#64748B"
                                        value={newFriendUsername}
                                        onChangeText={setNewFriendUsername}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity style={styles.sendReqBtn} onPress={handleSendRequest}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            )}

        </SafeAreaView>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { paddingBottom: 40 },

    header: { alignItems: 'center', paddingTop: 40, paddingBottom: 32 },
    avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 16, elevation: 8, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
    avatarText: { fontSize: 40, fontWeight: '800', color: '#FFF' },
    badgeIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.background, borderRadius: 12, padding: 2 },

    userName: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 },
    userEmail: { fontSize: 15, color: theme.textSecondary, marginBottom: 16 },

    reputationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
    reputationText: { color: '#F59E0B', fontWeight: '700', marginLeft: 8 },

    statsContainer: { flexDirection: 'row', backgroundColor: theme.card, marginHorizontal: 20, borderRadius: 20, paddingVertical: 20, marginBottom: 24, borderWidth: 1, borderColor: theme.cardBorder },
    statBox: { flex: 1, alignItems: 'center' },
    statBorder: { width: 1, backgroundColor: theme.cardBorder },
    statValue: { fontSize: 24, fontWeight: '900', color: theme.textPrimary, marginBottom: 4 },
    statLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

    availabilityContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.card, marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: theme.cardBorder },
    availabilityInfo: { flex: 1, paddingRight: 16 },
    availabilityTitle: { fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 },
    availabilityDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
    availabilityToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 24, borderWidth: 1 },
    toggleAvailable: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' },
    toggleBusy: { backgroundColor: theme.dangerBg, borderColor: 'rgba(239, 68, 68, 0.3)' },
    toggleKnobWrapper: { marginRight: 8 },
    toggleKnob: { width: 8, height: 8, borderRadius: 4 },
    knobAvailable: { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
    knobBusy: { backgroundColor: theme.danger },
    toggleText: { fontSize: 14, fontWeight: '800' },
    textAvailable: { color: '#10B981' },
    textBusy: { color: theme.danger },

    actionsContainer: { paddingHorizontal: 20 },
    sectionTitle: { fontSize: 13, color: theme.textSecondary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, marginLeft: 8 },

    actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.cardBorder },
    actionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    actionText: { flex: 1, fontSize: 16, color: theme.textPrimary, fontWeight: '600' },

    // Modal Styles
    modalContent: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.background, height: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
    modalSectionTitle: { fontSize: 14, fontWeight: '700', color: theme.textSecondary, marginBottom: 16, marginLeft: 8, textTransform: 'uppercase' },

    friendRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 12, borderRadius: 16, marginBottom: 12 },
    friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    friendName: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.textPrimary },

    acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    rejectBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center' },

    addFriendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 32 },
    addFriendInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, height: 50, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.cardBorder, marginRight: 12 },
    addFriendInput: { flex: 1, marginLeft: 8, color: theme.textPrimary, fontSize: 15 },
    sendReqBtn: { backgroundColor: theme.primary, height: 50, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }

});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { SupabaseClient } from '../../src/infra/SupabaseClient';
import { AuthManager } from '../../src/core/identity/AuthManager';
const BADGE_CONFIG: Record<string, { icon: any; title: string; color: string; desc: string }> = {
  FIRST_STEP: { icon: "footsteps", title: "First Step", color: "#3B82F6", desc: "1 Event Attended" },
  THE_REGULAR: { icon: "calendar", title: "The Regular", color: "#8B5CF6", desc: "10 Events Attended" },
  COMMUNITY_LEGEND: { icon: "star", title: "Community Legend", color: "#F59E0B", desc: "50 Events Attended" },
  THE_HOST: { icon: "home", title: "The Host", color: "#10B981", desc: "1 Event Hosted" },
  ACTIVE_ORGANIZER: { icon: "megaphone", title: "Active Organizer", color: "#EC4899", desc: "10 Events Hosted" },
  LISAN_AL_GAIB: { icon: "planet", title: "Lisan al-Gaib", color: "#F43F5E", desc: "30 Events Hosted" },
  TEAM_SPIRIT: { icon: "people", title: "Team Spirit", color: "#06B6D4", desc: "1 Group AI Plan" },
  THE_COORDINATOR: { icon: "options", title: "The Coordinator", color: "#6366F1", desc: "10 Group Plans" },
  THE_GANGMAKER: { icon: "flame", title: "The GangMaker", color: "#EAB308", desc: "25 Group Plans" },
  SPONTANEOUS: { icon: "flash", title: "Spontaneous", color: "#14B8A6", desc: "1 AI Suggestion" },
  THE_ADVENTURER: { icon: "compass", title: "The Adventurer", color: "#D946EF", desc: "10 AI Suggestions" },
  INDIANA_JONES: { icon: "map", title: "Indiana Jones", color: "#84CC16", desc: "25 AI Suggestions" },
};

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();

    const [userProfile, setUserProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Modal State
    const [isReportModalVisible, setIsReportModalVisible] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const supabase = SupabaseClient.getInstance().client;
            
            // Get Current User
            const session = await AuthManager.getInstance().getCurrentUser();
            if (session) setCurrentUserId(session.id);

            // Fetch Target User Profile
            const { data: profileData, error } = await supabase
                .from('users')
                .select('id, full_name, profile_image, badges, status')
                .eq('id', id)
                .single();

            if (!error && profileData) {
                setUserProfile(profileData);
            } else {
                console.warn('Could not fetch user profile.');
            }
        } catch (error) {
            console.error('Fetch profile error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReportUser = async () => {
        if (!reportReason.trim()) {
            Alert.alert("Reason Required", "Please explain why you are reporting this user.");
            return;
        }

        setIsSubmitting(true);
        try {
            const supabase = SupabaseClient.getInstance().client;
            
            const { error } = await supabase.from('reports').insert({
                target_id: userProfile.id,
                target_type: 'USER',
                description: reportReason.trim(),
                status: 'PENDING',
                reporter_id: currentUserId || null
            });

            if (error) {
                console.error("Report user insert error:", error);
                Alert.alert("Error", "Could not submit your report. Please try again later.");
            } else {
                Alert.alert("Report Submitted", "Thank you. Our moderation team will review this user shortly.");
                setIsReportModalVisible(false);
                setReportReason('');
            }
        } catch (err) {
            console.error("Report exception:", err);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
                <ScreenHeader title="Loading..." onLeftPress={() => router.back()} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            </View>
        );
    }

    if (!userProfile) {
        return (
            <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
                <ScreenHeader title="User Profile" onLeftPress={() => router.back()} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.textSecondary }}>User not found.</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <ScreenHeader title="User Profile" onLeftPress={() => router.back()} />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                {/* Profile Header */}
                <View style={[styles.profileHeaderCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <View style={[styles.avatarBig, { backgroundColor: theme.primaryLight }]}>
                        <Text style={[styles.avatarTextBig, { color: theme.primary }]}>
                            {userProfile.full_name?.charAt(0) || 'U'}
                        </Text>
                    </View>
                    <Text style={[styles.userName, { color: theme.textPrimary }]}>{userProfile.full_name}</Text>
                    
                    {userProfile.id === currentUserId && (
                        <Text style={{ color: theme.textSecondary, marginTop: 4 }}>This is you</Text>
                    )}
                </View>

                {/* Badges Section */}
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Earned Badges</Text>
                <View style={[styles.badgesContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    {userProfile.badges && userProfile.badges.length > 0 ? (
                        <View style={styles.badgeGrid}>
                            {userProfile.badges.map((b: string) => {
                                const cfg = BADGE_CONFIG[b];
                                if (!cfg) return null;
                                return (
                                    <View key={b} style={styles.badgeItem}>
                                        <View style={[styles.badgeIconWrapper, { backgroundColor: cfg.color + '20' }]}>
                                            <Ionicons name={cfg.icon as any} size={28} color={cfg.color} />
                                        </View>
                                        <Text style={[styles.badgeTitle, { color: theme.textPrimary }]}>{cfg.title}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>No badges earned yet.</Text>
                    )}
                </View>

                {/* Report Action Layer */}
                {userProfile.id !== currentUserId && (
                    <TouchableOpacity 
                        style={[styles.reportButton, { borderColor: theme.danger || '#ef4444' }]} 
                        onPress={() => setIsReportModalVisible(true)}
                    >
                        <Ionicons name="warning-outline" size={20} color={theme.danger || '#ef4444'} />
                        <Text style={[styles.reportButtonText, { color: theme.danger || '#ef4444' }]}>
                            Report User
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Report Modal */}
            <Modal visible={isReportModalVisible} animationType="fade" transparent>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
                            <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                                <View style={[styles.modalIconWrapper, { backgroundColor: (theme.danger || '#ef4444') + '20' }]}>
                                    <Ionicons name="flag" size={32} color={theme.danger || '#ef4444'} />
                                </View>
                                
                                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Report User</Text>
                                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                                    If this user is violating our guidelines, please provide details below. Our moderation team will investigate.
                                </Text>

                                <TextInput
                                    style={[styles.reasonInput, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.cardBorder }]}
                                    placeholder="Tell us what happened..."
                                    placeholderTextColor={theme.textSecondary}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    value={reportReason}
                                    onChangeText={setReportReason}
                                />

                                <View style={styles.modalActions}>
                                    <TouchableOpacity 
                                        style={[styles.modalBtn, { backgroundColor: theme.background, borderColor: theme.cardBorder, borderWidth: 1 }]} 
                                        onPress={() => { setIsReportModalVisible(false); setReportReason(''); }}
                                        disabled={isSubmitting}
                                    >
                                        <Text style={[styles.modalBtnText, { color: theme.textPrimary }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        style={[styles.modalBtn, { backgroundColor: theme.danger || '#ef4444' }]} 
                                        onPress={handleReportUser}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator color="#FFF" />
                                        ) : (
                                            <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Submit</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    profileHeaderCard: {
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    avatarBig: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarTextBig: {
        fontSize: 32,
        fontWeight: '900',
    },
    userName: {
        fontSize: 22,
        fontWeight: '800',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    badgesContainer: {
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 32,
    },
    badgeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    badgeItem: {
        width: '30%',
        alignItems: 'center',
    },
    badgeIconWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    badgeTitle: {
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
    },
    reportButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 'auto',
    },
    reportButtonText: {
        fontSize: 15,
        fontWeight: '800',
    },
    
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    modalIconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    reasonInput: {
        width: '100%',
        height: 120,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        fontSize: 15,
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBtnText: {
        fontSize: 15,
        fontWeight: '800',
    }
});

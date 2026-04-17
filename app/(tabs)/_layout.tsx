import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Platform, View, Modal, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Event } from '../../src/core/event/Event';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthManager } from '../../src/core/identity/AuthManager';
import { UserManager } from '../../src/core/identity/UserManager';
import { getLocationByLabel } from '../../src/data/locations';
import { Location, LocationType } from '../../src/spatial/Location';
import { RecommendationEngine } from '../../src/intelligence/RecommendationEngine';
import { SupabaseClient } from '../../src/infra/SupabaseClient';
import { EventController } from '../../src/controllers/EventController';
import { EventManager } from '../../src/core/event/EventManager';
import { NotificationService } from '../../src/infra/NotificationService';
import { useUIStore } from '../../src/store/uiStore';
import { useTheme } from '../../src/theme/useTheme';

export default function TabLayout() {
    const theme = useTheme();
    const { tooltipStep, setTooltipStep, handleNextTooltip, handleSkipTooltip } = useUIStore();

    useEffect(() => {
        const checkOnboarding = async () => {
            try {
                const user = await AuthManager.getInstance().getCurrentUser();
                if (!user) return;

                const key = `@has_seen_events_onboarding_${user.id}`;
                const hasSeen = await AsyncStorage.getItem(key);
                if (!hasSeen) {
                    setTimeout(() => setTooltipStep(0), 500);
                }
            } catch (e) {
                console.warn(e);
            }
        };
        checkOnboarding();
    }, []);

    const [inviteModalVisible, setInviteModalVisible] = useState(false);
    const [currentInvite, setCurrentInvite] = useState<any>(null);
    const [eventDetails, setEventDetails] = useState<any>(null);

    // ── One-Tap Suggestion Modal state ────────────────────────────────────
    const [suggestModalVisible, setSuggestModalVisible] = useState(false);
    const [suggestions, setSuggestions] = useState<Event[]>([]);

    const fetchEventDetails = async (eventId: string) => {
        try {
            const { data } = await SupabaseClient.getInstance().client
                .from('events')
                .select('title, sub_category, start_time, location_name')
                .eq('id', eventId)
                .single();
            setEventDetails(data);
        } catch (e) {
            console.error("Invite Modal: Details fetch failed", e);
        }
    };

    useEffect(() => {
        let channel: any;
        const listenForInvites = async () => {
            const user = await AuthManager.getInstance().getCurrentUser();
            if (!user) return;

            const supabase = SupabaseClient.getInstance().client;
            
            // ... (unread count fetch remains same)
            const { count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false);
            
            if (count !== null) {
                useUIStore.getState().setUnreadCount(count);
            }

            // Initial check for unread invites
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .eq('type', 'event_invite')
                .eq('is_read', false)
                .order('created_at', { ascending: true })
                .limit(1);

            if (data && data.length > 0) {
                setCurrentInvite(data[0]);
                if (data[0].data?.eventId) fetchEventDetails(data[0].data.eventId);
                setInviteModalVisible(true);
            }

            // Realtime subscription
            channel = supabase
                .channel('public:notifications:all')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: any) => {
                    const newNotif = payload.new as any;
                    
                    if (!newNotif.is_read) {
                        useUIStore.getState().setUnreadCount(useUIStore.getState().unreadCount + 1);
                    }

                    if (newNotif.type === 'event_invite' && !newNotif.is_read) {
                        setCurrentInvite(newNotif);
                        if (newNotif.data?.eventId) fetchEventDetails(newNotif.data.eventId);
                        setInviteModalVisible(true);
                    }
                })
                .subscribe();
        };

        listenForInvites();
        return () => {
            if (channel) channel.unsubscribe();
        };
    }, []);

    const handleInviteModalClose = () => {
        setInviteModalVisible(false);
        setEventDetails(null);
    };

    const handleAcceptInvite = async () => {
        if (!currentInvite) return;
        handleInviteModalClose();
        const { showToast } = useUIStore.getState();
        try {
            const evController = new EventController(EventManager.getInstance(), {} as any, {} as any);
            const res = await evController.joinEvent(currentInvite.data?.eventId);
            if (res.status === 200) {
                showToast("You joined the event!", "success");
            } else {
                showToast("Could not join: " + res.message, "error");
            }
            // Delete notification securely
            await SupabaseClient.getInstance().client.from('notifications').delete().eq('id', currentInvite.id);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRejectInvite = async () => {
        if (!currentInvite) return;
        handleInviteModalClose();
        try {
            const currentUser = await AuthManager.getInstance().getCurrentUser();
            const me = (await SupabaseClient.getInstance().client.from('users').select('full_name').eq('id', currentUser?.id).single()).data;
            const notifSvc = NotificationService.getInstance();
            await notifSvc.sendInviteRejection(
                currentInvite.data?.senderId,
                me?.full_name || 'Your friend',
                currentInvite.title || 'Event'
            );
            // Delete notification securely
            await SupabaseClient.getInstance().client.from('notifications').delete().eq('id', currentInvite.id);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <>
        <Tabs screenOptions={{
            headerShown: false,
            tabBarStyle: {
                backgroundColor: theme.card,
                borderTopColor: theme.cardBorder,
                height: Platform.OS === 'ios' ? 88 : 68,
                paddingBottom: Platform.OS === 'ios' ? 28 : 10,
            },
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: theme.textSecondary,
            tabBarShowLabel: true,
        }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Events',
                    tabBarIcon: ({ color }) => <Ionicons name="flash-outline" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="map"
                options={{
                    title: 'Map',
                    tabBarIcon: ({ color }) => <Ionicons name="location-outline" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="suggest"
                options={{
                    title: '',
                    tabBarIcon: ({ focused }) => (
                        <View style={{
                            width: 60,
                            height: 60,
                            backgroundColor: theme.primary,
                            borderRadius: 30,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: Platform.OS === 'ios' ? 15 : 25,
                            shadowColor: theme.primary,
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.6,
                            shadowRadius: 12,
                            elevation: 8,
                            borderWidth: 4,
                            borderColor: theme.card
                        }}>
                            <Ionicons name="sparkles" size={28} color="#FFF" />
                        </View>
                    ),
                }}
                listeners={() => ({
                    tabPress: async (e) => {
                        e.preventDefault();
                        const { showToast, setGlobalLoading } = useUIStore.getState();
                        setGlobalLoading(true);

                        try {
                            const user = await AuthManager.getInstance().getCurrentUser();
                            if (!user) throw new Error("User not logged in");

                            const profileData = await UserManager.getInstance().getUserProfile(user.id);

                            // 📍 Default location: Çankaya, Ankara
                            let userLat = 39.8667;
                            let userLon = 32.8667;

                            if (profileData?.base_location) {
                                const mapped = getLocationByLabel(profileData.base_location);
                                if (mapped) {
                                    userLat = mapped.latitude;
                                    userLon = mapped.longitude;
                                }
                            }

                            const locationObj = new Location(
                                'user-loc',
                                'Current Location',
                                { latitude: userLat, longitude: userLon },
                                LocationType.OTHER as any
                            );

                            const recommendations = await RecommendationEngine.getInstance().getOneTapSuggestion(user, locationObj);
                            setGlobalLoading(false);

                            if (recommendations && recommendations.length > 0) {
                                setSuggestions(recommendations as Event[]);
                                setSuggestModalVisible(true);
                            } else {
                                showToast('No open events found nearby. Try again later!', 'info');
                            }
                        } catch (error) {
                            setGlobalLoading(false);
                            console.error("Recommendation Error:", error);
                            showToast('Failed to fetch recommendations', 'error');
                        }
                    },
                })}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: 'Create',
                    tabBarIcon: ({ color }) => <Ionicons name="add-outline" size={28} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="edit-interests"
                options={{
                    href: null, // Hides it from the tab bar
                }}
            />
            <Tabs.Screen
                name="edit-profile"
                options={{
                    href: null, // Hides it from the tab bar
                }}
            />
            <Tabs.Screen
                name="ocr-schedule"
                options={{
                    href: null, // Hides it from the tab bar
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    href: null, // Hides it from the tab bar
                }}
            />
            <Tabs.Screen
                name="edit-location"
                options={{
                    href: null, // Hides it from the tab bar
                }}
            />
        </Tabs>

        {/* ── One-Tap Suggestion Modal ──────────────────────────────── */}
        <Modal
            visible={suggestModalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setSuggestModalVisible(false)}
        >
            <View style={styles.suggestOverlay}>
                {/* Tap-outside to dismiss */}
                <TouchableOpacity
                    style={StyleSheet.absoluteFillObject}
                    onPress={() => setSuggestModalVisible(false)}
                    activeOpacity={1}
                />

                <View style={[styles.suggestSheet, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    {/* Handle */}
                    <View style={[styles.suggestHandle, { backgroundColor: theme.cardBorder }]} />

                    {/* Header */}
                    <View style={styles.suggestHeader}>
                        <View style={[styles.suggestHeaderIcon, { backgroundColor: theme.primaryLight }]}>
                            <Ionicons name="sparkles" size={22} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.suggestTitle, { color: theme.textPrimary }]}>AI Picks For You</Text>
                            <Text style={[styles.suggestSubtitle, { color: theme.textSecondary }]}>
                                3 open events matched to your interests
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setSuggestModalVisible(false)} style={styles.suggestClose}>
                            <Ionicons name="close" size={20} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Suggestion Cards */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 8 }}
                    >
                        {suggestions.map((event: any, index: number) => {
                            const cardColors = [
                                { bg: '#1A1F3A', accent: '#6C63FF', badge: '#2D2A5E' },
                                { bg: '#1A2E2A', accent: '#00C896', badge: '#1A3D34' },
                                { bg: '#2E1A1A', accent: '#FF6B6B', badge: '#3D1A1A' },
                            ];
                            const c = cardColors[index % 3];
                            const score = Math.round((event.matchScore ?? 0) * 100);
                            const dist  = event.distanceKm ?? '—';
                            const sub   = event.subCategory || event.sub_category || '';
                            const cat   = event.category || '';

                            return (
                                <View key={event.eventId ?? index} style={[styles.suggestCard, { backgroundColor: c.bg, borderColor: c.accent + '40' }]}>
                                    {/* Rank badge */}
                                    <View style={[styles.suggestRank, { backgroundColor: c.accent }]}>
                                        <Text style={styles.suggestRankText}>#{index + 1}</Text>
                                    </View>

                                    {/* Category chip */}
                                    <View style={[styles.suggestChip, { backgroundColor: c.badge }]}>
                                        <Text style={[styles.suggestChipText, { color: c.accent }]}>
                                            {sub || cat || 'Event'}
                                        </Text>
                                    </View>

                                    {/* Title */}
                                    <Text style={styles.suggestEventTitle} numberOfLines={2}>
                                        {event.title || 'Exciting Event'}
                                    </Text>

                                    {/* Meta row */}
                                    <View style={styles.suggestMeta}>
                                        <View style={styles.suggestMetaItem}>
                                            <Ionicons name="location-outline" size={13} color="#AAA" />
                                            <Text style={styles.suggestMetaText}>{dist} km away</Text>
                                        </View>
                                        <View style={styles.suggestMetaItem}>
                                            <Ionicons name="time-outline" size={13} color="#AAA" />
                                            <Text style={styles.suggestMetaText}>
                                                {event.timeSlot?.startTime
                                                    ? new Date(event.timeSlot.startTime).toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                                                    : 'Open'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Score bar */}
                                    <View style={styles.suggestScoreRow}>
                                        <Text style={styles.suggestScoreLabel}>Match</Text>
                                        <View style={[styles.suggestScoreTrack, { backgroundColor: c.badge }]}>
                                            <View style={[styles.suggestScoreFill, { width: `${score}%` as any, backgroundColor: c.accent }]} />
                                        </View>
                                        <Text style={[styles.suggestScoreValue, { color: c.accent }]}>{score}%</Text>
                                    </View>

                                    {/* View button */}
                                    <TouchableOpacity
                                        style={[styles.suggestViewBtn, { backgroundColor: c.accent }]}
                                        onPress={() => {
                                            setSuggestModalVisible(false);
                                            router.push(`/event/${event.eventId}`);
                                        }}
                                    >
                                        <Text style={styles.suggestViewBtnText}>View Event</Text>
                                        <Ionicons name="arrow-forward" size={16} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        </Modal>

        {/* Global Invite Modal */}
        <Modal visible={inviteModalVisible} animationType="slide" transparent={true}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ width: '100%', backgroundColor: theme.card, borderRadius: 28, padding: 24, alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15, borderWidth: 1, borderColor: theme.cardBorder }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                        <Ionicons name="mail-open" size={32} color={theme.primary} />
                    </View>
                    
                    <Text style={{ fontSize: 22, fontWeight: '900', color: theme.textPrimary, marginBottom: 8, textAlign: 'center' }}>
                        Event Invitation
                    </Text>
                    
                    <Text style={{ fontSize: 15, color: theme.textSecondary, marginBottom: 24, textAlign: 'center', lineHeight: 22 }}>
                        {currentInvite?.body || 'You have been invited to an event!'}
                    </Text>

                    {eventDetails && (
                        <View style={{ width: '100%', backgroundColor: theme.background, borderRadius: 20, padding: 20, marginBottom: 28, borderWidth: 1, borderColor: theme.cardBorder }}>
                            <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>{eventDetails.title}</Text>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                <Ionicons name="time-outline" size={18} color={theme.primary} style={{ marginRight: 8 }} />
                                <Text style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '600' }}>
                                    {new Date(eventDetails.start_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="location-outline" size={18} color={theme.primary} style={{ marginRight: 8 }} />
                                <Text style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '600' }}>{eventDetails.location_name || 'Location TBA'}</Text>
                            </View>
                        </View>
                    )}
                    
                    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                        <TouchableOpacity 
                            style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: theme.background, alignItems: 'center', borderWidth: 1, borderColor: theme.cardBorder }} 
                            onPress={handleRejectInvite}
                        >
                            <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 16 }}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: theme.primary, alignItems: 'center', shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }} 
                            onPress={handleAcceptInvite}
                        >
                            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Join Event</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    // ── Suggestion Modal ──────────────────────────────────────────────────────
    suggestOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    suggestSheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        paddingTop: 12,
        maxHeight: '88%',
    },
    suggestHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    suggestHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    suggestHeaderIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    suggestTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    suggestSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    suggestClose: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ── Event Card ────────────────────────────────────────────────────────────
    suggestCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 18,
        marginBottom: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    suggestRank: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    suggestRankText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#FFF',
    },
    suggestChip: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 10,
    },
    suggestChipText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    suggestEventTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 12,
        paddingRight: 36,
        lineHeight: 22,
    },
    suggestMeta: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 14,
    },
    suggestMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    suggestMetaText: {
        fontSize: 12,
        color: '#AAA',
        fontWeight: '500',
    },
    suggestScoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    suggestScoreLabel: {
        fontSize: 11,
        color: '#888',
        fontWeight: '600',
        width: 36,
    },
    suggestScoreTrack: {
        flex: 1,
        height: 5,
        borderRadius: 3,
        overflow: 'hidden',
    },
    suggestScoreFill: {
        height: '100%',
        borderRadius: 3,
    },
    suggestScoreValue: {
        fontSize: 12,
        fontWeight: '700',
        width: 36,
        textAlign: 'right',
    },
    suggestViewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 14,
    },
    suggestViewBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFF',
    },
});

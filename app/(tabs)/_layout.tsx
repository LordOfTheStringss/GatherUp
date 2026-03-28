import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Alert, Platform, View, Modal, Text, TouchableOpacity, StyleSheet } from 'react-native';
import React, { useEffect, useState } from 'react';
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

    useEffect(() => {
        let channel: any;
        const listenForInvites = async () => {
            const user = await AuthManager.getInstance().getCurrentUser();
            if (!user) return;

            const supabase = SupabaseClient.getInstance().client;
            
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
                setInviteModalVisible(true);
            }

            // Realtime subscription for incoming invites
            channel = supabase
                .channel('public:notifications:invites')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: any) => {
                    const newNotif = payload.new as any;
                    if (newNotif.type === 'event_invite' && !newNotif.is_read) {
                        setCurrentInvite(newNotif);
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

    const handleAcceptInvite = async () => {
        if (!currentInvite) return;
        setInviteModalVisible(false);
        const { showToast } = useUIStore.getState();
        try {
            const evController = new EventController(EventManager.getInstance(), {} as any, {} as any);
            const res = await evController.joinEvent(currentInvite.data?.eventId);
            if (res.status === 200) {
                showToast("You joined the event!", "success");
            } else {
                showToast("Could not join: " + res.message, "error");
            }
            // Mark as read
            await SupabaseClient.getInstance().client.from('notifications').update({ is_read: true }).eq('id', currentInvite.id);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRejectInvite = async () => {
        if (!currentInvite) return;
        setInviteModalVisible(false);
        try {
            const currentUser = await AuthManager.getInstance().getCurrentUser();
            const me = (await SupabaseClient.getInstance().client.from('users').select('full_name').eq('id', currentUser?.id).single()).data;
            const notifSvc = NotificationService.getInstance();
            await notifSvc.sendInviteRejection(
                currentInvite.data?.senderId,
                me?.full_name || 'Your friend',
                currentInvite.title || 'Event'
            );
            // Mark as read
            await SupabaseClient.getInstance().client.from('notifications').update({ is_read: true }).eq('id', currentInvite.id);
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
                                // Prepare the message with all recommended events
                                let message = "We found these events you might like:\n\n";
                                recommendations.forEach((event: any, index: number) => {
                                    message += `${index + 1}. ${event.title}\n`;
                                    message += `📍 ${event.location_id || 'Location TBA'} (${event.distanceKm} km)\n`;
                                    message += `🎯 Score: ${event.matchScore}\n\n`;
                                });

                                // Truncate if too long (Alerts have length limits on some platforms)
                                if (message.length > 800) {
                                    message = message.substring(0, 800) + '...\n\n(Showing top results)';
                                }

                                const topEvent = recommendations[0];

                                Alert.alert(
                                    "✨ AI Matches Found!",
                                    message,
                                    [
                                        { text: "Dismiss", style: "cancel" },
                                        { text: `View Top Result`, onPress: () => router.push(`/event/${topEvent.eventId}`) }
                                    ]
                                );
                            } else {
                                showToast('No new recommendations found.', 'info');
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

        {/* Global Invite Modal */}
        <Modal visible={inviteModalVisible} animationType="slide" transparent={true}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ width: '85%', backgroundColor: theme.card, borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10 }}>
                    <Ionicons name="mail-unread" size={48} color={theme.primary} style={{ marginBottom: 16 }} />
                    <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginBottom: 8, textAlign: 'center' }}>
                        {currentInvite?.title || 'Event Invite'}
                    </Text>
                    <Text style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 24, textAlign: 'center' }}>
                        {currentInvite?.body || 'You have been invited to an event!'}
                    </Text>
                    
                    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                        <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.cardBorder, alignItems: 'center' }} onPress={handleRejectInvite}>
                            <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 16 }}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center' }} onPress={handleAcceptInvite}>
                            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Join Event</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
        </>
    );
}

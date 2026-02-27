import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EventController } from '../../src/controllers/EventController';
import { EventManager } from '../../src/core/event/EventManager';
import { AuthManager } from '../../src/core/identity/AuthManager';
import { useUIStore } from '../../src/store/uiStore';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';

// DI Stub
const eventController = new EventController(EventManager.getInstance(), {} as any, {} as any);

interface EventStub { id: string; title: string; category: string; time: string; capacity: number; location: string; host: string }

export default function HomeScreen() {
    const { showToast } = useUIStore();
    const [refreshing, setRefreshing] = useState(false);
    const theme = useTheme();
    const styles = createStyles(theme);

    // Data State
    const [nearbyEvents, setNearbyEvents] = useState<EventStub[]>([]);
    const [friendsEvents, setFriendsEvents] = useState<EventStub[]>([]);
    const [myEvents, setMyEvents] = useState<EventStub[]>([]);

    const [activeTab, setActiveTab] = useState<'friends' | 'my' | 'nearby'>('friends');

    const loadFeeds = async () => {
        try {
            const user = await AuthManager.getInstance().getCurrentUser();
            const nearbyRes = await eventController.getEvents({ category: 'All' });
            let myRes: any = { data: [] };
            if (user) {
                myRes = await eventController.getEvents({ organizerId: user.id });
            }

            const mapEvents = (events: any[]) => events.map((e: any) => ({
                id: e.id,
                title: e.title,
                category: e.sub_category,
                time: e.start_time ? new Date(e.start_time).toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD',
                capacity: e.max_capacity || 0,
                location: e.location_id || 'Campus',
                host: e.users?.full_name || 'Anonymous',
                organizer_id: e.organizer_id
            }));

            if (nearbyRes.data) {
                // Filter out my own events from nearby/friends feed
                const filteredOthers = user ? nearbyRes.data.filter((e: any) => e.organizer_id !== user.id) : nearbyRes.data;
                const mappedOthers = mapEvents(filteredOthers);
                setNearbyEvents(mappedOthers);
                setFriendsEvents(mappedOthers); // For now, show same events until friendship filtering is added
            }
            if (myRes.data) {
                setMyEvents(mapEvents(myRes.data));
            }
        } catch (e) {
            showToast('Failed to load events', 'error');
        }
    };

    useEffect(() => {
        loadFeeds();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadFeeds();
        setRefreshing(false);
    };

    const renderEventCard = (item: EventStub, styleType: 'friends' | 'nearby') => {
        if (styleType === 'friends') {
            return (
                <TouchableOpacity
                    style={[styles.eventCard, styles.eventCardFriends]}
                    onPress={() => router.push(`/event/${item.id}`)}
                    activeOpacity={0.8}
                >
                    <View style={styles.friendCardHeader}>
                        <View style={styles.friendHostAvatar}>
                            <Text style={styles.hostInitial}>{item.host.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.friendHostName}>{item.host}</Text>
                            <Text style={styles.friendActionText}>is going to an event</Text>
                        </View>
                        <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
                    </View>

                    <Text style={styles.friendEventTitle} numberOfLines={2}>{item.title}</Text>

                    <View style={styles.friendEventDetailsBox}>
                        <View style={styles.eventMetaRow}>
                            <Ionicons name="time" size={16} color={theme.primary} />
                            <Text style={[styles.eventMetaText, { color: theme.textPrimary }]}>{item.time}</Text>
                        </View>
                        <View style={styles.eventMetaRow}>
                            <Ionicons name="location" size={16} color={theme.primary} />
                            <Text style={[styles.eventMetaText, { color: theme.textPrimary }]}>{item.location}</Text>
                        </View>
                    </View>

                    <View style={styles.friendCardFooter}>
                        <View style={[styles.categoryBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                            <Text style={[styles.eventCategory, { color: '#3B82F6' }]}>{item.category}</Text>
                        </View>
                        <TouchableOpacity style={styles.joinButton}>
                            <Text style={styles.joinButtonText}>Join</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            );
        }

        return (
            <TouchableOpacity
                style={[styles.eventCard, styles.eventCardNearby]}
                onPress={() => router.push(`/event/${item.id}`)}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.categoryBadge}>
                        <Text style={styles.eventCategory}>{item.category}</Text>
                    </View>
                    <View style={styles.capacityBadge}>
                        <Ionicons name="flame" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={styles.eventCapacity}>{item.capacity} spots</Text>
                    </View>
                </View>
                <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>

                <View style={styles.eventMetaRow}>
                    <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                    <Text style={styles.eventMetaText}>{item.time}</Text>
                </View>
                <View style={styles.eventMetaRow}>
                    <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                    <Text style={styles.eventMetaText}>{item.location}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
            >
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.greeting}>Gather Up ✨</Text>
                            <Text style={styles.subGreeting}>Finding your next social spark.</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.headerAvatar} activeOpacity={0.7}>
                        <Ionicons name="notifications-outline" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>

                {/* Segmented Control */}
                <View style={styles.segmentContainer}>
                    <TouchableOpacity
                        style={[styles.segmentBtn, activeTab === 'friends' && styles.segmentBtnActive]}
                        onPress={() => setActiveTab('friends')}
                    >
                        <Text style={[styles.segmentText, activeTab === 'friends' && styles.segmentTextActive]}>Friends</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segmentBtn, activeTab === 'my' && styles.segmentBtnActive]}
                        onPress={() => setActiveTab('my')}
                    >
                        <Text style={[styles.segmentText, activeTab === 'my' && styles.segmentTextActive]}>My Events</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segmentBtn, activeTab === 'nearby' && styles.segmentBtnActive]}
                        onPress={() => setActiveTab('nearby')}
                    >
                        <Text style={[styles.segmentText, activeTab === 'nearby' && styles.segmentTextActive]}>Nearby</Text>
                    </TouchableOpacity>
                </View>

                {/* Vertical Feed */}
                <View style={styles.verticalFeedContainer}>
                    {activeTab === 'friends' && (
                        friendsEvents.length > 0 ? (
                            friendsEvents.map(item => <View key={item.id} style={{ marginBottom: 16 }}>{renderEventCard(item, 'friends')}</View>)
                        ) : (
                            <Text style={styles.emptyStateText}>No friend events right now.</Text>
                        )
                    )}

                    {activeTab === 'my' && (
                        myEvents.length > 0 ? (
                            myEvents.map(item => <View key={item.id} style={{ marginBottom: 16 }}>{renderEventCard(item, 'nearby')}</View>)
                        ) : (
                            <Text style={styles.emptyStateText}>You haven't created any events yet.</Text>
                        )
                    )}

                    {activeTab === 'nearby' && (
                        nearbyEvents.length > 0 ? (
                            nearbyEvents.map(item => <View key={item.id} style={{ marginBottom: 16 }}>{renderEventCard(item, 'nearby')}</View>)
                        ) : (
                            <Text style={styles.emptyStateText}>No events nearby.</Text>
                        )
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, marginTop: 10 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerTextContainer: { justifyContent: 'center' },
    greeting: { fontSize: 24, fontWeight: '900', color: theme.textPrimary, letterSpacing: -0.5 },
    subGreeting: { fontSize: 13, color: theme.textSecondary, marginTop: 2, fontWeight: '500' },
    headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.headerIconBg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.cardBorder },

    // Segmented Control Styles
    segmentContainer: { flexDirection: 'row', backgroundColor: theme.cardBorder, padding: 4, borderRadius: 16, marginBottom: 24 },
    segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
    segmentBtnActive: { backgroundColor: theme.primary, shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    segmentText: { color: theme.textSecondary, fontWeight: '700', fontSize: 14 },
    segmentTextActive: { color: '#FFF' },

    verticalFeedContainer: { paddingBottom: 20 },
    emptyStateText: { color: theme.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16, fontWeight: '500' },

    eventCard: {
        width: '100%',
        borderRadius: 20,
        padding: 16,
        backgroundColor: theme.card,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: theme.cardBorder
    },
    eventCardFriends: { backgroundColor: theme.background, borderColor: theme.primaryLight, padding: 20 },
    eventCardNearby: { backgroundColor: theme.card },

    // Friends Card Specifics
    friendCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    friendHostAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    friendHostName: { color: theme.textPrimary, fontSize: 16, fontWeight: '800' },
    friendActionText: { color: theme.textSecondary, fontSize: 13, marginTop: 2 },
    friendEventTitle: { color: theme.textPrimary, fontSize: 24, fontWeight: '900', marginBottom: 16, lineHeight: 30 },
    friendEventDetailsBox: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.cardBorder },
    friendCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    joinButton: { backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    joinButtonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    categoryBadge: { backgroundColor: theme.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: theme.primaryLight },
    eventCategory: { color: theme.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    capacityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.cardBorder, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    eventCapacity: { color: theme.textPrimary, fontSize: 13, fontWeight: 'bold' },

    eventTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 16, lineHeight: 28 },

    eventMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    eventMetaText: { color: theme.textSecondary, fontSize: 14, marginLeft: 8, fontWeight: '600' },

    hostInitial: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});

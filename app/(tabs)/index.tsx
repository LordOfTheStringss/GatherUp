import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EventController } from '../../src/controllers/EventController';
import { EventManager } from '../../src/core/event/EventManager';
import { useUIStore } from '../../src/store/uiStore';

// DI Stub
const eventController = new EventController(new EventManager(), {} as any, {} as any);

interface EventStub { id: string; title: string; category: string; time: string; capacity: number; location: string; host: string }

export default function HomeScreen() {
    const { showToast } = useUIStore();
    const [refreshing, setRefreshing] = useState(false);

    // Data State
    const [nearbyEvents, setNearbyEvents] = useState<EventStub[]>([]);
    const [friendsEvents, setFriendsEvents] = useState<EventStub[]>([]);

    const loadFeeds = async () => {
        try {
            const nearbyRes = await eventController.getEvents({ category: 'All' });
            setNearbyEvents([
                { id: '1', title: 'Tech Startup Mixer', category: 'Networking', time: 'Today 19:00', capacity: 50, location: 'Downtown Hub', host: 'Emir' },
                { id: '2', title: 'Campus Football Match', category: 'Sports', time: 'Tomorrow 10:00', capacity: 14, location: 'Main Stadium', host: 'Student Council' }
            ]);

            const friendsRes = await eventController.getEvents({ category: 'All' });
            setFriendsEvents([
                { id: '3', title: 'Coffee Break & Study', category: 'Social', time: 'Today 15:30', capacity: 4, location: 'Library Cafe', host: 'Ayşe' }
            ]);
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

    const renderEventCard = (item: EventStub, styleType: 'friends' | 'nearby') => (
        <TouchableOpacity
            style={[styles.eventCard, styleType === 'friends' ? styles.eventCardFriends : styles.eventCardNearby]}
            onPress={() => router.push(`/event/${item.id}`)}
            activeOpacity={0.8}
        >
            <View style={styles.cardHeader}>
                <View style={styles.categoryBadge}>
                    <Text style={styles.eventCategory}>{item.category}</Text>
                </View>
                <View style={styles.capacityBadge}>
                    <Ionicons name="people-outline" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                    <Text style={styles.eventCapacity}>{item.capacity}</Text>
                </View>
            </View>
            <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>

            <View style={styles.eventMetaRow}>
                <Ionicons name="time-outline" size={16} color="#94A3B8" />
                <Text style={styles.eventMetaText}>{item.time}</Text>
            </View>
            <View style={styles.eventMetaRow}>
                <Ionicons name="location-outline" size={16} color="#94A3B8" />
                <Text style={styles.eventMetaText}>{item.location}</Text>
            </View>

            <View style={styles.cardFooter}>
                <View style={styles.hostAvatar}><Text style={styles.hostInitial}>{item.host.charAt(0)}</Text></View>
                <Text style={styles.hostName}>Hosted by {item.host}</Text>
                <Ionicons name="chevron-forward" size={20} color="#3B82F6" style={{ marginLeft: 'auto' }} />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
            >
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Discover Events ✨</Text>
                        <Text style={styles.subGreeting}>Swipe to explore what's happening around you.</Text>
                    </View>
                    <View style={styles.headerAvatar}>
                        <Ionicons name="notifications-outline" size={24} color="#FFF" />
                    </View>
                </View>

                {/* Discovery Feeds */}
                <View style={styles.feedSection}>
                    <View style={styles.sectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="heart" size={20} color="#EF4444" style={{ marginRight: 8 }} />
                            <Text style={styles.sectionTitle}>Trusted Circle</Text>
                        </View>
                        <TouchableOpacity><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
                    </View>
                    <FlatList
                        horizontal
                        data={friendsEvents}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => renderEventCard(item, 'friends')}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.listContainer}
                        snapToInterval={296}
                        decelerationRate="fast"
                    />
                </View>

                <View style={styles.feedSection}>
                    <View style={styles.sectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="compass" size={20} color="#3B82F6" style={{ marginRight: 8 }} />
                            <Text style={styles.sectionTitle}>Trending Nearby</Text>
                        </View>
                        <TouchableOpacity><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
                    </View>
                    <FlatList
                        horizontal
                        data={nearbyEvents}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => renderEventCard(item, 'nearby')}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.listContainer}
                        snapToInterval={296}
                        decelerationRate="fast"
                    />
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#020617' },
    container: { flex: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
    greeting: { fontSize: 28, fontWeight: '900', color: '#F8FAFC', letterSpacing: -0.5 },
    subGreeting: { fontSize: 15, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
    headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },

    feedSection: { marginBottom: 36 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', letterSpacing: 0.5 },
    seeAll: { color: '#3B82F6', fontSize: 14, fontWeight: '700' },

    listContainer: { gap: 16, paddingRight: 40 },
    eventCard: {
        width: 280,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    eventCardFriends: { backgroundColor: '#0F172A', shadowColor: '#000' },
    eventCardNearby: { backgroundColor: '#172554', borderColor: '#1E3A8A', shadowColor: '#1D4ED8' },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    categoryBadge: { backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' },
    eventCategory: { color: '#60A5FA', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    capacityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    eventCapacity: { color: '#F8FAFC', fontSize: 13, fontWeight: 'bold' },

    eventTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '800', marginBottom: 16, lineHeight: 28 },

    eventMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    eventMetaText: { color: '#94A3B8', fontSize: 14, marginLeft: 8, fontWeight: '600' },

    cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    hostAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    hostInitial: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    hostName: { color: '#CBD5E1', fontSize: 13, fontWeight: '500' },
});

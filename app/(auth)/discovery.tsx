import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useUIStore } from '../../src/store/uiStore';

// Mock data representing AI suggested events
const SUGGESTED_EVENTS = [
    { id: 'e1', title: 'Tech Startup Mixer', category: 'Networking', time: 'Friday 19:00', location: 'Downtown Hub', imageColor: '#3B82F6' },
    { id: 'e2', title: 'Weekend Hiking', category: 'Sports', time: 'Saturday 08:00', location: 'Pine Trail', imageColor: '#10B981' },
    { id: 'e3', title: 'Indie Game Dev Meetup', category: 'Technology', time: 'Sunday 14:00', location: 'Campus Cafe', imageColor: '#8B5CF6' },
    { id: 'e4', title: 'Local Coffee Tasting', category: 'Social', time: 'Tuesday 10:00', location: 'Bean Roasters', imageColor: '#F59E0B' },
];

export default function DiscoveryScreen() {
    const { showToast } = useUIStore();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [likedEvents, setLikedEvents] = useState<string[]>([]);

    const activeEvent = SUGGESTED_EVENTS[currentIndex];
    const isFinished = currentIndex >= SUGGESTED_EVENTS.length;

    const handleSwipe = (liked: boolean) => {
        if (liked && activeEvent) {
            setLikedEvents(prev => [...prev, activeEvent.id]);
            showToast('Added to Liked Events!', 'success');
        }
        setCurrentIndex(prev => prev + 1);
    };

    const finishOnboarding = () => {
        // Here we would normally save likedEvents to the backend/store
        router.replace('/(tabs)');
    };

    if (isFinished) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Ionicons name="checkmark-circle" size={80} color="#10B981" style={{ marginBottom: 24, alignSelf: 'center' }} />
                    <Text style={styles.titleCentred}>You're All Set!</Text>
                    <Text style={styles.subtitleCentred}>You liked {likedEvents.length} events. We've optimized your feed based on these preferences.</Text>

                    <TouchableOpacity style={styles.button} onPress={finishOnboarding} activeOpacity={0.8}>
                        <Text style={styles.buttonText}>Go to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Discover Events</Text>
                <Text style={styles.subtitle}>Swipe Right to save, Left to pass.</Text>
                <Text style={styles.counter}>{currentIndex + 1} of {SUGGESTED_EVENTS.length}</Text>
            </View>

            <View style={styles.cardContainer}>
                {activeEvent && (
                    <View style={styles.cardWrapper}>
                        <View style={[styles.cardImagePlaceholder, { backgroundColor: activeEvent.imageColor }]}>
                            <Ionicons name="calendar" size={64} color="rgba(255,255,255,0.3)" />
                        </View>
                        <View style={styles.cardContent}>
                            <View style={styles.cardBadge}>
                                <Text style={styles.cardBadgeText}>{activeEvent.category}</Text>
                            </View>
                            <Text style={styles.cardTitle}>{activeEvent.title}</Text>

                            <View style={styles.cardDetailRow}>
                                <Ionicons name="time-outline" size={16} color="#94A3B8" />
                                <Text style={styles.cardDetailText}>{activeEvent.time}</Text>
                            </View>
                            <View style={styles.cardDetailRow}>
                                <Ionicons name="location-outline" size={16} color="#94A3B8" />
                                <Text style={styles.cardDetailText}>{activeEvent.location}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionButton, styles.nopeButton]} onPress={() => handleSwipe(false)} activeOpacity={0.7}>
                    <Ionicons name="close" size={36} color="#EF4444" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={() => handleSwipe(true)} activeOpacity={0.7}>
                    <Ionicons name="heart" size={32} color="#10B981" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B1120' },

    header: { paddingTop: 60, paddingHorizontal: 24, alignItems: 'center' },
    title: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', letterSpacing: 0.5 },
    titleCentred: { fontSize: 32, fontWeight: '900', color: '#F8FAFC', textAlign: 'center', marginBottom: 12 },
    subtitle: { fontSize: 15, color: '#94A3B8', marginTop: 8 },
    subtitleCentred: { fontSize: 16, color: '#94A3B8', textAlign: 'center', lineHeight: 24, marginBottom: 40, paddingHorizontal: 20 },
    counter: { fontSize: 13, color: '#3B82F6', marginTop: 12, fontWeight: '700', letterSpacing: 1 },

    cardContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    cardWrapper: {
        width: '100%',
        height: '85%',
        backgroundColor: '#15202B',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1C2733',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 12,
    },
    cardImagePlaceholder: { flex: 3, justifyContent: 'center', alignItems: 'center' },
    cardContent: { flex: 2, padding: 24, backgroundColor: '#15202B' },
    cardBadge: { alignSelf: 'flex-start', backgroundColor: '#1C2733', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
    cardBadgeText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    cardTitle: { fontSize: 28, fontWeight: '800', color: '#F8FAFC', marginBottom: 16, lineHeight: 34 },
    cardDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    cardDetailText: { color: '#94A3B8', fontSize: 15, marginLeft: 8, fontWeight: '500' },

    actions: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingBottom: 60 },
    actionButton: {
        width: 72, height: 72, borderRadius: 36,
        justifyContent: 'center', alignItems: 'center',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    },
    nopeButton: { backgroundColor: '#15202B', borderWidth: 2, borderColor: '#EF4444', shadowColor: '#EF4444' },
    likeButton: { backgroundColor: '#15202B', borderWidth: 2, borderColor: '#10B981', shadowColor: '#10B981' },

    content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    button: { backgroundColor: '#3B82F6', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});

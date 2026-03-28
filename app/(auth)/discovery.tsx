import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useUIStore } from '../../src/store/uiStore';
import { useTheme } from '../../src/theme/useTheme';
import { ThemeColors } from '../../src/theme/colors';

// Mock data representing AI suggested events
const SUGGESTED_EVENTS = [
    { id: 'e1', title: 'Tech Startup Mixer', category: 'Networking', time: 'Friday 19:00', location: 'Downtown Hub', imageColor: '#3B82F6' },
    { id: 'e2', title: 'Weekend Hiking', category: 'Sports', time: 'Saturday 08:00', location: 'Pine Trail', imageColor: '#10B981' },
    { id: 'e3', title: 'Indie Game Dev Meetup', category: 'Technology', time: 'Sunday 14:00', location: 'Campus Cafe', imageColor: '#8B5CF6' },
    { id: 'e4', title: 'Local Coffee Tasting', category: 'Social', time: 'Tuesday 10:00', location: 'Bean Roasters', imageColor: '#F59E0B' },
];

export default function DiscoveryScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
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
        router.replace('/(tabs)');
    };

    if (isFinished) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Ionicons name="checkmark-circle" size={80} color={theme.success} style={{ marginBottom: 24, alignSelf: 'center' }} />
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
                                <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                                <Text style={styles.cardDetailText}>{activeEvent.time}</Text>
                            </View>
                            <View style={styles.cardDetailRow}>
                                <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                                <Text style={styles.cardDetailText}>{activeEvent.location}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionButton, styles.nopeButton]} onPress={() => handleSwipe(false)} activeOpacity={0.7}>
                    <Ionicons name="close" size={36} color={theme.danger} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={() => handleSwipe(true)} activeOpacity={0.7}>
                    <Ionicons name="heart" size={32} color={theme.success} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    header: { paddingTop: 60, paddingHorizontal: 24, alignItems: 'center' },
    title: { fontSize: 26, fontWeight: '800', color: theme.textPrimary, letterSpacing: 0.5 },
    titleCentred: { fontSize: 32, fontWeight: '900', color: theme.textPrimary, textAlign: 'center', marginBottom: 12 },
    subtitle: { fontSize: 15, color: theme.textSecondary, marginTop: 8 },
    subtitleCentred: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 40, paddingHorizontal: 20 },
    counter: { fontSize: 13, color: theme.primary, marginTop: 12, fontWeight: '700', letterSpacing: 1 },

    cardContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    cardWrapper: {
        width: '100%',
        height: '85%',
        backgroundColor: theme.card,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 12,
    },
    cardImagePlaceholder: { flex: 3, justifyContent: 'center', alignItems: 'center' },
    cardContent: { flex: 2, padding: 24, backgroundColor: theme.card },
    cardBadge: { alignSelf: 'flex-start', backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.cardBorder },
    cardBadgeText: { color: theme.textPrimary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    cardTitle: { fontSize: 28, fontWeight: '800', color: theme.textPrimary, marginBottom: 16, lineHeight: 34 },
    cardDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    cardDetailText: { color: theme.textSecondary, fontSize: 15, marginLeft: 8, fontWeight: '500' },

    actions: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingBottom: 60 },
    actionButton: {
        width: 72, height: 72, borderRadius: 36,
        justifyContent: 'center', alignItems: 'center',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    },
    nopeButton: { backgroundColor: theme.card, borderWidth: 2, borderColor: theme.danger, shadowColor: theme.danger },
    likeButton: { backgroundColor: theme.card, borderWidth: 2, borderColor: theme.success, shadowColor: theme.success },

    content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    button: { backgroundColor: theme.primary, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});

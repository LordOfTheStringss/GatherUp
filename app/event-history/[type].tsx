import React, { useEffect, useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    ActivityIndicator,
    StatusBar,
    FlatList
} from 'react-native';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import { ThemeColors } from '../../src/theme/colors';
import { UserController } from '../../src/controllers/UserController';
import { useUIStore } from '../../src/store/uiStore';

export default function EventHistoryScreen() {
    const { type } = useLocalSearchParams<{ type: 'hosted' | 'attended' }>();
    const theme = useTheme();
    const styles = createStyles(theme);
    const { showToast } = useUIStore();

    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        fetchEvents();
    }, [type]);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const userController = new UserController();
            const res = await userController.getEventHistory(type);
            if (res.status === 200 && res.data) {
                setEvents(res.data);
            } else {
                showToast(res.message || 'Failed to load events', 'error');
            }
        } catch (error) {
            console.error("EventHistory Error:", error);
            showToast('An unexpected error occurred', 'error');
        } finally {
            setLoading(false);
        }
    };

    const renderEventItem = ({ item, index }: { item: any, index: number }) => (
        <TouchableOpacity
            style={styles.eventCard}
            onPress={() => router.push(`/event/${item.id}`)}
            activeOpacity={0.7}
        >
            <View style={styles.eventIconContainer}>
                <Ionicons 
                    name={type === 'hosted' ? "location-outline" : "ticket-outline"} 
                    size={24} 
                    color={theme.primary} 
                />
            </View>
            <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.eventDate}>
                    {item.start_time ? new Date(item.start_time).toLocaleDateString('en-US', { 
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    }) : 'TBD'}
                </Text>
                {item.sub_category && (
                    <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{item.sub_category}</Text>
                    </View>
                )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
    );

    const getTitle = () => {
        return type === 'hosted' ? 'Events You Hosted' : 'Events You Attended';
    };

    const isDark = theme.background === '#0F0E17';

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            
            <ScreenHeader 
                title={getTitle()}
                onLeftPress={() => router.navigate("/(tabs)/profile")}
                leftIcon="arrow-back"
            />

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={(item) => item.id}
                    renderItem={renderEventItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="calendar-outline" size={64} color={theme.textSecondary} />
                            <Text style={styles.emptyText}>No events found.</Text>
                            <TouchableOpacity 
                                style={styles.browseButton}
                                onPress={() => router.push('/(tabs)')}
                            >
                                <Text style={styles.browseButtonText}>Browse Events</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: theme.textPrimary,
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    eventCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    eventIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 16,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.textPrimary,
        marginBottom: 4,
    },
    eventDate: {
        fontSize: 13,
        color: theme.textSecondary,
        marginBottom: 6,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    categoryText: {
        fontSize: 11,
        color: theme.primary,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: 16,
        color: theme.textSecondary,
        marginTop: 16,
        fontWeight: '600',
    },
    browseButton: {
        marginTop: 24,
        backgroundColor: theme.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    browseButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 15,
    },
});

import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Alert, Platform, View } from 'react-native';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthManager } from '../../src/core/identity/AuthManager';
import { UserManager } from '../../src/core/identity/UserManager';
import { getLocationByLabel } from '../../src/data/locations';
import { fetchRecommendedEvents } from '../../src/intelligence/RecommendationEngine';
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

    return (
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
                            backgroundColor: '#3B82F6',
                            borderRadius: 30,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: Platform.OS === 'ios' ? 15 : 25,
                            shadowColor: '#3B82F6',
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

                            const recommendations = await fetchRecommendedEvents(user.id, userLat, userLon);
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
                                        { text: `View Top Result`, onPress: () => router.push(`/event/${topEvent.id}`) }
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
    );
}

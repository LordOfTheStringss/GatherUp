import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Platform, View } from 'react-native';
import { useUIStore } from '../../src/store/uiStore';
import { useTheme } from '../../src/theme/useTheme';

export default function TabLayout() {
    const theme = useTheme();

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
                    tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="map"
                options={{
                    title: 'Map',
                    tabBarIcon: ({ color }) => <Ionicons name="map" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="suggest"
                options={{
                    title: '',
                    tabBarIcon: ({ focused }) => (
                        <View style={{
                            width: 64,
                            height: 64,
                            backgroundColor: '#8B5CF6',
                            borderRadius: 32,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: Platform.OS === 'ios' ? 20 : 30, // Elevate above tab bar
                            shadowColor: '#8B5CF6',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.5,
                            shadowRadius: 10,
                            elevation: 8,
                            borderWidth: 4,
                            borderColor: theme.card
                        }}>
                            <Ionicons name="sparkles" size={32} color="#FFF" />
                        </View>
                    ),
                }}
                listeners={() => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        const { showToast, setGlobalLoading } = useUIStore.getState();
                        setGlobalLoading(true);
                        setTimeout(() => {
                            setGlobalLoading(false);
                            showToast('✨ AI Match Found! Redirecting to Map...', 'success');
                            router.push('/(tabs)/map');
                        }, 1200);
                    },
                })}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: 'Create',
                    tabBarIcon: ({ color }) => <Ionicons name="add-circle" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
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
        </Tabs>
    );
}

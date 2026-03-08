import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { UserController } from '../../src/controllers/UserController';
import { AuthManager } from '../../src/core/identity/AuthManager';
import { FriendshipManager } from '../../src/core/identity/FriendshipManager';
import { GamificationManager } from '../../src/core/identity/GamificationManager';
import { UserManager } from '../../src/core/identity/UserManager';
import { ANKARA_NEIGHBORHOODS, LocationData } from '../../src/data/locations';
import { useUIStore } from '../../src/store/uiStore';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';

const userController = new UserController(
    UserManager.getInstance(),
    new FriendshipManager(null as any),
    new GamificationManager()
);

export default function EditLocationScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const { showToast } = useUIStore();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadCurrentLocation();
    }, []);

    const loadCurrentLocation = async () => {
        try {
            const user = await AuthManager.getInstance().getCurrentUser();
            if (!user) return;
            const res = await userController.getMyProfile(user.id);
            if (res.status === 200 && res.data) {
                setCurrentLocation(res.data.baseLocation || '');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectLocation = async (loc: LocationData) => {
        if (loc.label === currentLocation) return;
        setSaving(true);
        try {
            const user = await AuthManager.getInstance().getCurrentUser();
            if (!user) throw new Error("Unauthenticated");

            await userController.updateProfile(user.id, { baseLocation: loc.label });
            setCurrentLocation(loc.label);
            showToast(`Location set to ${loc.label}`, 'success');
            router.push('/(tabs)/profile');
        } catch (e: any) {
            showToast('Failed to update location', 'error');
        } finally {
            setSaving(false);
        }
    };

    const filteredLocations = ANKARA_NEIGHBORHOODS.filter(loc =>
        loc.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} disabled={saving}>
                    <Ionicons name="close" size={28} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Event Location</Text>
                <View style={{ width: 28 }} />
            </View>

            <View style={styles.container}>
                <Text style={styles.description}>
                    Choose your primary neighborhood. This helps us find events and people near you!
                </Text>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search neighborhood..."
                        placeholderTextColor={theme.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                <FlatList
                    data={filteredLocations}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    renderItem={({ item }) => {
                        const isSelected = item.label === currentLocation;
                        return (
                            <TouchableOpacity
                                style={[styles.locationCard, isSelected && styles.locationCardSelected]}
                                onPress={() => handleSelectLocation(item)}
                                disabled={saving}
                                activeOpacity={0.7}
                            >
                                <View style={styles.locationHeader}>
                                    <Ionicons
                                        name={isSelected ? "location" : "location-outline"}
                                        size={24}
                                        color={isSelected ? theme.primary : theme.textSecondary}
                                    />
                                    <Text style={[styles.locationName, isSelected && styles.locationNameSelected]}>
                                        {item.label}
                                    </Text>
                                </View>
                                {isSelected && (
                                    <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                )}
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>
        </SafeAreaView>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.cardBorder
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
    container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.card,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 50,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.cardBorder
    },
    searchIcon: { marginRight: 12 },
    searchInput: { flex: 1, color: theme.textPrimary, fontSize: 16 },
    description: { fontSize: 16, color: theme.textSecondary, marginBottom: 20, lineHeight: 24 },
    locationCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.card,
        padding: 20,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.cardBorder
    },
    locationCardSelected: {
        borderColor: theme.primary,
        backgroundColor: 'rgba(59, 130, 246, 0.05)'
    },
    locationHeader: { flexDirection: 'row', alignItems: 'center' },
    locationName: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginLeft: 12 },
    locationNameSelected: { color: theme.primary },
});

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PremiumWheelPicker } from '../../src/components/ui/PremiumWheelPicker';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { OnboardingTooltip } from '../../src/components/OnboardingTooltip';
import { EventController } from '../../src/controllers/EventController';
import { ConflictEngine } from '../../src/core/event/ConflictEngine';
import { EventManager } from '../../src/core/event/EventManager';
import { AuthManager } from '../../src/core/identity/AuthManager';
import { NotificationService } from '../../src/infra/NotificationService';
import { SupabaseClient } from '../../src/infra/SupabaseClient';
import { RecommendationEngine } from '../../src/intelligence/RecommendationEngine';
import { INTEREST_TAGS, InterestTag } from '../../src/data/interestTags';
import { useAuthStore } from '../../src/store/authStore';
import { useUIStore } from '../../src/store/uiStore';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';
import { ANKARA_NEIGHBORHOODS, searchLocations, isWithinAnkara } from '../../src/data/locations';

// DI Setup
const recommendationEngine = RecommendationEngine.getInstance();
const conflictEngine = new ConflictEngine();
const eventController = new EventController(EventManager.getInstance(), recommendationEngine, conflictEngine);

export default function CreateEventScreen() {
    const { showToast, setGlobalLoading, createTooltipStep, setCreateTooltipStep, handleNextCreateTooltip, handleSkipCreateTooltip } = useUIStore();

    useEffect(() => {
        if (createTooltipStep === 1 || createTooltipStep === -1) setActiveTab("manual");
        else if (createTooltipStep === 2) setActiveTab("ai");
    }, [createTooltipStep]);

    const theme = useTheme();
    const styles = createStyles(theme);
    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [myFriends, setMyFriends] = useState<any[]>([]);
    const [selectedFriends, setSelectedFriends] = useState<any[]>([]);
    const [aiSuggestedFriends, setAiSuggestedFriends] = useState<any[]>([]); // Track friends included in AI plan

    useFocusEffect(
        React.useCallback(() => {
            const checkCreateOnboarding = async () => {
                try {
                    const sessionUser = await AuthManager.getInstance().getCurrentUser();
                    if (!sessionUser) return;

                    const supabase = SupabaseClient.getInstance().client;
                    const { data: dbUser } = await supabase.from('users').select('*').eq('id', sessionUser.id).single();

                    if (dbUser) {
                        setCurrentUser(dbUser);

                        // Fetch the real friends of the user via the 'friendships' table (mutual follows)
                        const { data: whoIFollow } = await supabase.from('friendships').select('friend_id').eq('user_id', sessionUser.id);
                        const { data: whoFollowsMe } = await supabase.from('friendships').select('user_id').eq('friend_id', sessionUser.id);

                        if (whoIFollow && whoFollowsMe) {
                            const followIds = whoIFollow.map((f: any) => f.friend_id);
                            const mutualIds = whoFollowsMe.filter((f: any) => followIds.includes(f.user_id)).map((f: any) => f.user_id);

                            if (mutualIds.length > 0) {
                                const { data: friendsData } = await supabase.from('users').select('*').in('id', mutualIds);
                                if (friendsData) {
                                    const parsedFriends = friendsData.map((f: any) => ({
                                        ...f,
                                        profileVector: typeof f.profile_vector === 'string' ? JSON.parse(f.profile_vector) : f.profile_vector
                                    }));
                                    setMyFriends(parsedFriends);
                                }
                            }
                        }
                    }

                    const hasSeen = await AsyncStorage.getItem(`@has_seen_create_onboarding_${sessionUser.id}`);
                    if (!hasSeen) {
                        setTimeout(() => setCreateTooltipStep(0), 500);
                    }
                } catch (e) {
                    console.warn(e);
                }
            };
            checkCreateOnboarding();
        }, [])
    );

    const [categorySearch, setCategorySearch] = useState('');

    // Manual Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(new Date());
    const [durationStr, setDurationStr] = useState('1 hour'); // New Duration state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [selectedCategoryIcon, setSelectedCategoryIcon] = useState('');
    const [showDurationPicker, setShowDurationPicker] = useState(false);

    const mapRef = React.useRef<MapView>(null);
    const [currentRegion, setCurrentRegion] = useState<Region>({
        latitude: 39.92077,
        longitude: 32.85411,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });

    const handleZoom = (zoomIn: boolean) => {
        const factor = zoomIn ? 0.5 : 2;
        const newRegion = {
            ...currentRegion,
            latitudeDelta: currentRegion.latitudeDelta * factor,
            longitudeDelta: currentRegion.longitudeDelta * factor,
        };
        setCurrentRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 300);
    };
    const [capacity, setCapacity] = useState('10');
    const [isPrivate, setIsPrivate] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [locationSearchQuery, setLocationSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{id: string; name: string; latitude: number; longitude: number; source: 'local' | 'remote'}[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearchLocation = async () => {
        if (!locationSearchQuery.trim()) return;
        setIsSearching(true);
        
        try {
            // 1. Local matches (already showing via onChangeText, but ensure they're set)
            const localMatches = searchLocations(locationSearchQuery).map(n => ({
                id: n.id,
                name: n.label,
                latitude: n.latitude,
                longitude: n.longitude,
                source: 'local' as const,
            }));

            // 2. Also try geocoding, but STRICTLY filter to Ankara bounds
            const queryWithCity = locationSearchQuery.toLowerCase().includes('ankara')
                ? locationSearchQuery
                : `${locationSearchQuery}, Ankara, Turkey`;

            try {
                const locRes = await Location.geocodeAsync(queryWithCity);
                if (locRes && locRes.length > 0) {
                    // Filter: ONLY results within Ankara geographic bounds
                    const ankaraResults = locRes.filter(r => isWithinAnkara(r.latitude, r.longitude));
                    
                    if (ankaraResults.length > 0) {
                        const resultsWithAddresses = await Promise.all(
                            ankaraResults.slice(0, 3).map(async (res) => {
                                const addr = await Location.reverseGeocodeAsync({ latitude: res.latitude, longitude: res.longitude });
                                const a = addr[0];
                                const name = a
                                    ? [a.street, a.district, a.subregion].filter(Boolean).join(', ')
                                    : `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`;
                                return {
                                    id: `geo-${res.latitude.toFixed(5)}-${res.longitude.toFixed(5)}`,
                                    name: name || 'Ankara',
                                    latitude: res.latitude,
                                    longitude: res.longitude,
                                    source: 'remote' as const,
                                };
                            })
                        );

                        // Combine: local first, then remote (no duplicates)
                        const combined: {id: string; name: string; latitude: number; longitude: number; source: 'local' | 'remote'}[] = [...localMatches];
                        resultsWithAddresses.forEach(remote => {
                            const isDuplicate = combined.some(l =>
                                Math.abs(l.latitude - remote.latitude) < 0.002 &&
                                Math.abs(l.longitude - remote.longitude) < 0.002
                            );
                            if (!isDuplicate) combined.push(remote);
                        });
                        setSearchResults(combined);
                    } else {
                        // No Ankara results from geocoding, just show local
                        setSearchResults(localMatches);
                    }
                } else {
                    setSearchResults(localMatches);
                }
            } catch {
                // Geocoding failed, show local matches only
                setSearchResults(localMatches);
            }

            if (localMatches.length === 0) {
                // Check if we have anything to show at all
                // (searchResults may have been set above with remote results)
            }
        } catch (e) {
            console.error(e);
            showToast("Search failed", "error");
        } finally {
            setIsSearching(false);
        }
    };

    // Live autocomplete from local list as user types
    const handleSearchTextChange = (txt: string) => {
        setLocationSearchQuery(txt);
        if (txt.trim().length === 0) {
            setSearchResults([]);
            return;
        }
        // Instant local filtering
        const matches = searchLocations(txt).slice(0, 8).map(n => ({
            id: n.id,
            name: n.label,
            latitude: n.latitude,
            longitude: n.longitude,
            source: 'local' as const,
        }));
        setSearchResults(matches);
    };

    const moveToLocation = (latitude: number, longitude: number) => {
        const newRegion = {
            ...currentRegion,
            latitude,
            longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
        };
        setCurrentRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
    };

    const updateSearchQueryFromCoords = async (lat: number, lng: number) => {
        try {
            const addr = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (addr && addr[0]) {
                const parts = [
                    addr[0].name,
                    addr[0].street,
                    addr[0].district,
                    addr[0].city
                ].filter(Boolean);
                setLocationSearchQuery(parts.slice(0, 2).join(', '));
            }
        } catch (e) {
            console.log("Reverse geocode failed", e);
        }
    };

    const handleMapPress = (coord: { latitude: number, longitude: number }) => {
        setSelectedLocation(coord);
        updateSearchQueryFromCoords(coord.latitude, coord.longitude);
        setSearchResults([]);
    };

    const params = useLocalSearchParams();

    useEffect(() => {
        if (params.lat && params.lng) {
            const lat = parseFloat(params.lat as string);
            const lng = parseFloat(params.lng as string);

            // Only update if coordinates are different to prevent infinite loops
            if (!selectedLocation || selectedLocation.latitude !== lat || selectedLocation.longitude !== lng) {
                setSelectedLocation({ latitude: lat, longitude: lng });
                showToast('Location pre-selected from map', 'success');
            }
        }
    }, [params.lat, params.lng]);

    const DURATIONS = [
        '30 mins', '1 hour', '1.5 hours', '2 hours', '2.5 hours', '3 hours', '4 hours', '5 hours'
    ];

    const onChangeDate = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false); // iOS modal/spinner stays open differently, but for simplicity we toggle
        if (selectedDate) setDate(selectedDate);
    };

    const onChangeTime = (event: any, selectedDate?: Date) => {
        setShowTimePicker(false);
        if (selectedDate) {
            setDate(selectedDate);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const handleManualCreate = async (forceCreate: boolean = false) => {
        if (!title || !category || !date || !selectedLocation) {
            showToast('Please fill all required fields including location.', 'error');
            return;
        }

        if (date <= new Date()) {
            showToast('Event time cannot be in the past.', 'error');
            return;
        }

        setGlobalLoading(true);
        try {
            const res = await eventController.createEvent({
                title,
                sub_category: category,
                time: date,
                duration: durationStr,
                location_lat: selectedLocation.latitude,
                location_lng: selectedLocation.longitude,
                is_private: isPrivate
            } as any, forceCreate);

            if (res.status === 409) {
                setGlobalLoading(false);
                Alert.alert(
                    "Schedule Conflict",
                    res.message || "You have a conflicting event or class. Create anyway?",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Yes, Create Anyway", style: "destructive", onPress: () => handleManualCreate(true) }
                    ]
                );
                return;
            }

            if (res.status === 500 || (res.status !== 201 && res.status !== 200)) {
                showToast(res.message || 'Event creation failed', 'error');
                return;
            }

            // Event oluşturulduktan sonra, eğer AI tarafından önerilen user'lar varsa onlara notification gönderilecek
            if (aiSuggestedFriends.length > 0 && currentUser) {
                const notificationService = NotificationService.getInstance();
                for (const friend of aiSuggestedFriends) {
                    if (friend.id) {
                        await notificationService.sendEventInvite(
                            friend.id,
                            title,
                            res.data?.id || 'unknown',
                            currentUser.full_name || "Your friend",
                            currentUser.id
                        );
                    }
                }
                showToast(`Event Created & Invites sent to ${aiSuggestedFriends.length} friends!`, 'success');
                setAiSuggestedFriends([]); // Reset state
            } else {
                showToast('Event Created Successfully!', 'success');
            }

            router.back();
        } catch (e: any) {
            showToast(e.message || 'Creation failed', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleAIPlan = async () => {
        setGlobalLoading(true);
        try {
            if (!currentUser) {
                showToast("User session not found. Please log in again.", "error");
                return;
            }

            // Check if any selected friend is busy
            const busyFriends = selectedFriends.filter((f: any) => f?.is_available === false || f?.status === 'busy');
            if (busyFriends.length > 0) {
                const names = busyFriends.map((f: any) => f?.full_name).join(', ');
                Alert.alert(
                    "Unavailable",
                    `${names} is currently in busy mode and is too busy for a new event.`
                );
                setGlobalLoading(false);
                return;
            }

            // O anki userın kendisi (vector parse edilmiş hali) ve seçtiği arkadaşları
            const myVector = typeof currentUser.profile_vector === 'string' ? JSON.parse(currentUser.profile_vector) : currentUser.profile_vector;
            const currentUserWithVec = { ...currentUser, profileVector: myVector };

            const allPlanUsers = [currentUserWithVec, ...selectedFriends];

            // RecommendationEngine üzerinden getGroupSuggestion'ı doğrudan çağırıyoruz
            // Bu metod içeride 939 boyutlu input dizisini kendisi üretiyor
            const suggestionResult = await recommendationEngine.getGroupSuggestion(allPlanUsers);

            // The combined 939-dimensional input ready for ONNX:
            const sharedEmbedding = suggestionResult.features;
            // TODO: Run assets/models/group_model.onnx with sharedEmbedding

            if (suggestionResult && suggestionResult.proposal) {
                const prop = suggestionResult.proposal;
                const catName = prop.suggestedCategory || 'Social';
                const sDate = prop.suggestedTime || new Date();

                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const dayStr = days[sDate.getDay()];
                const hourStr = sDate.getHours().toString().padStart(2, '0');

                showToast(`AI chose ${dayStr} ${hourStr}:00 for ${catName}!`, 'success');

                // Verilerin otomatik olarak manuel event kısmına geçirilmesi (Autofill)
                setTitle(`Group ${catName}`);
                setCategory(catName);
                setDate(sDate);
                setIsPrivate(true);

                // Gerçek arkadaş datasını Suggestion olarak devrettik ki Notification atabilelim.
                setAiSuggestedFriends(selectedFriends);

                setActiveTab('manual');
            } else {
                showToast('AI Planning failed', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'AI Planning failed', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const renderManualForm = () => (
        <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>1. Details</Text>
            <TextInput style={styles.input} placeholder="Event Title" placeholderTextColor={theme.textSecondary} value={title} onChangeText={setTitle} />

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={styles.flex1}>
                    <Text style={styles.label}>Category</Text>
                    <TouchableOpacity
                        style={[styles.input, { justifyContent: 'center' }]}
                        onPress={() => setShowCategoryPicker(true)}
                    >
                        <Text style={{ color: category ? theme.textPrimary : theme.textSecondary }}>{category || 'Select'}</Text>
                        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} style={{ position: 'absolute', right: 16 }} />
                    </TouchableOpacity>
                </View>

                <View style={styles.flex1}>
                    <Text style={styles.label}>Duration</Text>
                    <TouchableOpacity
                        style={[styles.input, { justifyContent: 'center' }]}
                        onPress={() => setShowDurationPicker(true)}
                    >
                        <Text style={{ color: theme.textPrimary }}>{durationStr}</Text>
                        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} style={{ position: 'absolute', right: 16 }} />
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={styles.sectionTitle}>2. Date & Time</Text>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                <TouchableOpacity
                    style={[styles.input, { flex: 1, justifyContent: 'center' }]}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text style={{ color: theme.textPrimary }}>{formatDate(date)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.input, { flex: 1, justifyContent: 'center' }]}
                    onPress={() => setShowTimePicker(true)}
                >
                    <Text style={{ color: theme.textPrimary }}>{formatTime(date)}</Text>
                </TouchableOpacity>
            </View>

            {showDatePicker && (
                <Modal transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select Date</Text>
                            {Platform.OS === 'ios' ? (
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display="spinner"
                                    textColor={theme.textPrimary}
                                    onChange={(e, d) => { if (d) setDate(d); }}
                                />
                            ) : (
                                <PremiumWheelPicker
                                    mode="date"
                                    value={date}
                                    onChange={(d) => setDate(d)}
                                    onClose={() => setShowDatePicker(false)}
                                />
                            )}
                            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.modalSubmitBtn}>
                                <Text style={styles.modalSubmitText}>Confirm Date</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {showTimePicker && (
                <Modal transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select Time</Text>
                            {Platform.OS === 'ios' ? (
                                <DateTimePicker
                                    value={date}
                                    mode="time"
                                    display="spinner"
                                    textColor={theme.textPrimary}
                                    onChange={(e, d) => {
                                        if (d) setDate(d);
                                    }}
                                />
                            ) : (
                                <PremiumWheelPicker
                                    mode="time"
                                    value={date}
                                    onChange={(d) => setDate(d)}
                                    onClose={() => setShowTimePicker(false)}
                                />
                            )}
                            <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.modalSubmitBtn}>
                                <Text style={styles.modalSubmitText}>Confirm Time</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Category Picker Modal — Searchable Interest Tags */}
            <Modal visible={showCategoryPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => { setShowCategoryPicker(false); setCategorySearch(''); }} />
                    <View style={[styles.modalContentList, { maxHeight: '70%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderText}>Select Category</Text>
                            <TouchableOpacity onPress={() => { setShowCategoryPicker(false); setCategorySearch(''); }}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
                        </View>
                        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', marginBottom: 0, paddingHorizontal: 12 }]}>
                                <Ionicons name="search" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
                                <TextInput
                                    style={{ flex: 1, color: theme.textPrimary, fontSize: 16, height: 44 }}
                                    placeholder="Search interests..."
                                    placeholderTextColor={theme.textSecondary}
                                    value={categorySearch}
                                    onChangeText={setCategorySearch}
                                    autoFocus={true}
                                />
                                {categorySearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setCategorySearch('')}>
                                        <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        <FlatList
                            data={INTEREST_TAGS.filter(tag =>
                                tag.title.toLowerCase().includes(categorySearch.toLowerCase()) ||
                                tag.category.toLowerCase().includes(categorySearch.toLowerCase())
                            )}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.modalListItem, category === item.title && { backgroundColor: item.color + '15' }]}
                                    onPress={() => {
                                        setCategory(item.title);
                                        setSelectedCategoryIcon(item.icon);
                                        setShowCategoryPicker(false);
                                        setCategorySearch('');
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.color + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                            <Ionicons name={item.icon as any} size={18} color={item.color} />
                                        </View>
                                        <View>
                                            <Text style={[styles.modalListText, category === item.title && { color: item.color, fontWeight: '700' }]}>{item.title}</Text>
                                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>{item.category}</Text>
                                        </View>
                                    </View>
                                    {category === item.title && <Ionicons name="checkmark-circle" size={22} color={item.color} />}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={{ padding: 24, alignItems: 'center' }}>
                                    <Ionicons name="search-outline" size={40} color={theme.textSecondary} />
                                    <Text style={{ color: theme.textSecondary, marginTop: 8, fontSize: 14 }}>No matching interests found</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>

            {/* Duration Picker Modal */}
            <Modal visible={showDurationPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowDurationPicker(false)} />
                    <View style={styles.modalContentList}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderText}>Select Duration</Text>
                            <TouchableOpacity onPress={() => setShowDurationPicker(false)}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {DURATIONS.map(dur => (
                                <TouchableOpacity key={dur} style={styles.modalListItem} onPress={() => { setDurationStr(dur); setShowDurationPicker(false); }}>
                                    <Text style={[styles.modalListText, durationStr === dur && { color: theme.primary, fontWeight: '700' }]}>{dur}</Text>
                                    {durationStr === dur && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <View style={[styles.mapContainer, { paddingTop: 0, height: 400 }]}>
                {/* Search Bar Overlay - Professional Native Style */}
                <View style={styles.floatingSearchContainer}>
                    <View style={styles.searchBarWrapper}>
                        <Ionicons name="location" size={20} color={theme.primary} style={{ marginLeft: 12 }} />
                        <TextInput 
                            style={styles.floatingSearchInput}
                            placeholder="Find a location..."
                            placeholderTextColor={theme.textSecondary}
                            value={locationSearchQuery}
                            onChangeText={handleSearchTextChange}
                            onSubmitEditing={handleSearchLocation}
                        />
                        {isSearching ? (
                            <View style={{ marginRight: 12 }}><Text style={{ color: theme.primary, fontSize: 12 }}>...</Text></View>
                        ) : (
                            <TouchableOpacity style={{ padding: 10 }} onPress={handleSearchLocation}>
                                <Ionicons name="search" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        )}
                        {locationSearchQuery.length > 0 && (
                            <TouchableOpacity style={{ padding: 10 }} onPress={() => { setLocationSearchQuery(''); setSearchResults([]); }}>
                                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Results Selection List */}
                    {searchResults.length > 0 && (
                        <View style={styles.searchResultsDropdown}>
                            {searchResults.map((item, index) => (
                                <TouchableOpacity
                                    key={item.id || index.toString()}
                                    style={[
                                        styles.searchResultItem,
                                        index !== searchResults.length - 1 && styles.searchResultBorder
                                    ]}
                                    onPress={() => {
                                        moveToLocation(item.latitude, item.longitude);
                                        setSelectedLocation({ latitude: item.latitude, longitude: item.longitude });
                                        setLocationSearchQuery(item.name);
                                        setSearchResults([]);
                                    }}
                                >
                                    <View style={styles.resultIconContainer}>
                                        <Ionicons 
                                            name={item.source === 'local' ? "location" : "navigate"} 
                                            size={18} 
                                            color={item.source === 'local' ? theme.primary : theme.textSecondary} 
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.searchResultText} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        {item.source === 'local' && (
                                            <Text style={styles.searchResultSubtext}>GatherUp Verified Location</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                <MapView
                    ref={mapRef}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    style={{ flex: 1 }}
                    initialRegion={currentRegion}
                    onRegionChangeComplete={(region) => setCurrentRegion(region)}
                    onPress={(e) => handleMapPress(e.nativeEvent.coordinate)}
                >
                    {selectedLocation && (
                        <Marker coordinate={selectedLocation} pinColor={theme.primary} />
                    )}
                </MapView>
                {!selectedLocation && (
                    <View style={styles.mapOverlayHint}>
                        <Text style={styles.mapOverlayText}>Tap map to select location</Text>
                    </View>
                )}

                {/* Zoom Controls */}
                <View style={styles.zoomControls}>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom(true)} activeOpacity={0.7}>
                        <Ionicons name="add" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom(false)} activeOpacity={0.7}>
                        <Ionicons name="remove" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={styles.sectionTitle}>4. Settings</Text>
            <View style={styles.settingsRow}>
                <View style={styles.flex1}>
                    <Text style={styles.label}>Max Capacity</Text>
                    <TextInput style={styles.input} keyboardType="number-pad" value={capacity} onChangeText={setCapacity} />
                </View>
                <View style={{ width: 16 }} />
                <View style={styles.flex1}>
                    <Text style={styles.label}>Privacy</Text>
                    <TouchableOpacity
                        style={[styles.toggleBtn, isPrivate ? styles.toggleActive : null]}
                        onPress={() => setIsPrivate(!isPrivate)}>
                        <Text style={styles.toggleText}>{isPrivate ? 'Private' : 'Public'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={() => handleManualCreate(false)}>
                <Text style={styles.submitButtonText}>Create Event</Text>
            </TouchableOpacity>
        </View >
    );

    const renderAIForm = () => (
        <View style={styles.aiContainer}>
            <View style={styles.aiHeaderIcon}>
                <Ionicons name="sparkles" size={56} color="#A78BFA" />
            </View>
            <Text style={styles.aiTitle}>Intelligent Planning</Text>
            <Text style={styles.aiSubtitle}>Let our AI analyze availability, locations, and interests with your friends to find the perfect common ground instantly.</Text>

            {/* Changed from Trusted Circle to Friends */}
            <View style={styles.trustedCircleLabelContainer}>
                <Ionicons name="people" size={18} color="#94A3B8" />
                <Text style={styles.trustedCircleLabel}>FRIENDS INCLUDED</Text>
            </View>

            <View style={styles.mockFriendList}>
                {myFriends.length === 0 ? (
                    <Text style={{ padding: 16, color: theme.textSecondary, textAlign: 'center' }}>You don&apos;t have any friends to include yet.</Text>
                ) : (
                    myFriends?.map(friend => {
                        const isOnline = friend?.current_status === 'online';
                        const isBusy = friend?.is_available === false || friend?.status === 'busy';
                        const isSelected = selectedFriends.some(f => f?.id === friend?.id);
                        const isAiSuggested = aiSuggestedFriends.some(f => f?.id === friend?.id);

                        return (
                            <TouchableOpacity
                                key={friend?.id || Math.random().toString()}
                                style={[
                                    styles.friendRow,
                                    isSelected && { backgroundColor: theme.primaryLight + '20' },
                                    isAiSuggested && { borderColor: '#8B5CF6', borderWidth: 1 }
                                ]}
                                onPress={() => {
                                    if (isBusy) {
                                        Alert.alert(
                                            "Unavailable",
                                            `${friend?.full_name || 'This user'} is currently in busy mode and is too busy for a new event.`
                                        );
                                        return;
                                    }
                                    if (isSelected) {
                                        setSelectedFriends(prev => prev.filter((f: any) => f?.id !== friend?.id));
                                    } else {
                                        setSelectedFriends(prev => [...prev, friend]);
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.friendAvatar, isBusy && { backgroundColor: theme.textSecondary }]}>
                                    <Text style={styles.friendInitial}>{friend?.full_name ? friend.full_name.charAt(0) : 'F'}</Text>
                                </View>
                                <View style={styles.friendInfo}>
                                    <Text style={[styles.mockFriendName, isBusy && { color: theme.textSecondary }]}>{friend?.full_name}</Text>
                                    <Text style={isBusy ? styles.friendStatusBusy : (isSelected ? styles.friendStatusOnline : styles.friendStatusOffline)}>
                                        {isBusy ? 'Busy (Unavailable)' : (isSelected ? 'Included in Plan' : 'Tap to Include')}
                                    </Text>
                                </View>
                                {isBusy ? (
                                    <Ionicons name="remove-circle-outline" size={24} color={theme.textSecondary} />
                                ) : (
                                    <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? theme.success : theme.textSecondary} />
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>

            <TouchableOpacity style={styles.aiButton} onPress={handleAIPlan} activeOpacity={0.8}>
                <Ionicons name="flash" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.aiButtonText}>Generate Optimal Plan</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={{ position: 'absolute', bottom: 10, left: '74%', transform: [{ translateX: -20 }], width: 40, height: 10, zIndex: 999 }} pointerEvents="none">
                <OnboardingTooltip
                    isVisible={createTooltipStep === 0}
                    content="Create an event! Use this tab to make your own plan or get help from AI."
                    placement="top"
                    onNext={handleNextCreateTooltip}
                    onClose={handleSkipCreateTooltip}
                >
                    <View style={{ width: '100%', height: '100%' }} />
                </OnboardingTooltip>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

                {/* Custom Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="close" size={28} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Host an Event</Text>
                    <View style={{ width: 28 }} />
                </View>

                {/* Tab Switcher */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'manual' && styles.activeTab]}
                        onPress={() => setActiveTab('manual')}
                        activeOpacity={0.7}
                    >
                        <View style={{ position: 'absolute', width: '100%', height: 5, bottom: 0 }} pointerEvents="none">
                            <OnboardingTooltip
                                isVisible={createTooltipStep === 1}
                                content="You can manually create your own event with all the details from this tab."
                                placement="bottom"
                                onNext={handleNextCreateTooltip}
                                onClose={handleSkipCreateTooltip}
                            >
                                <View style={{ width: '100%', height: '100%' }} />
                            </OnboardingTooltip>
                        </View>
                        <Text style={[styles.tabText, activeTab === 'manual' && styles.activeTabText]}>Manual</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'ai' && styles.activeTabAI]}
                        onPress={() => setActiveTab('ai')}
                        activeOpacity={0.7}
                    >
                        <View style={{ position: 'absolute', width: '100%', height: 5, bottom: 0 }} pointerEvents="none">
                            <OnboardingTooltip
                                isVisible={createTooltipStep === 2}
                                content="Plan the best common time and place for your friends' schedules in seconds with our AI assistant!"
                                placement="bottom"
                                onNext={handleNextCreateTooltip}
                                onClose={handleSkipCreateTooltip}
                            >
                                <View style={{ width: '100%', height: '100%' }} />
                            </OnboardingTooltip>
                        </View>
                        <Ionicons name="sparkles" size={16} color={activeTab === 'ai' ? '#FFF' : '#A78BFA'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>Plan with AI</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    {activeTab === 'manual' ? renderManualForm() : renderAIForm()}
                </ScrollView>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 16 },
    backBtn: { minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 22, fontWeight: '800', color: theme.textPrimary, letterSpacing: 0.5 },

    tabContainer: { flexDirection: 'row', backgroundColor: theme.card, marginHorizontal: 20, borderRadius: 16, padding: 6, marginBottom: 24, borderWidth: 1, borderColor: theme.cardBorder },
    tab: { flex: 1, flexDirection: 'row', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    activeTab: { backgroundColor: theme.primary, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    activeTabAI: { backgroundColor: '#8B5CF6', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
    tabText: { color: theme.textSecondary, fontWeight: '700', fontSize: 16 },
    activeTabText: { color: '#FFFFFF' },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    formContainer: { flex: 1 },
    sectionTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 16, letterSpacing: 0.5 },
    input: { backgroundColor: theme.inputBg, color: theme.textPrimary, height: 56, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.inputBorder, fontSize: 16 },

    categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.inputBorder, marginRight: 10, height: 40, justifyContent: 'center' },
    categoryChipActive: { backgroundColor: theme.primary, borderColor: theme.primary, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
    categoryChipText: { color: theme.textSecondary, fontWeight: '600' },
    categoryChipTextActive: { color: '#FFFFFF', fontWeight: '800' },

    inputError: { borderColor: theme.danger, borderWidth: 1.5, backgroundColor: theme.dangerBg },
    errorText: { color: theme.danger, fontSize: 13, marginBottom: 16, marginTop: -8, fontWeight: '500' },

    settingsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    flex1: { flex: 1 },
    label: { color: theme.textSecondary, fontSize: 13, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    mapContainer: {
        height: 380,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#2D3748',
    },
    floatingSearchContainer: {
        position: 'absolute',
        top: 16,
        left: 12,
        right: 12,
        zIndex: 100,
    },
    searchBarWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.card,
        borderRadius: 12,
        height: 50,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        borderWidth: 1,
        borderColor: theme.cardBorder,
    },
    floatingSearchInput: {
        flex: 1,
        height: '100%',
        color: theme.textPrimary,
        fontSize: 15,
        paddingHorizontal: 12,
    },
    searchResultsDropdown: {
        backgroundColor: theme.card,
        marginTop: 6,
        borderRadius: 12,
        maxHeight: 200,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        overflow: 'hidden',
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    searchResultBorder: {
        borderBottomWidth: 1,
        borderBottomColor: theme.cardBorder,
    },
    resultIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    searchResultText: {
        color: theme.textPrimary,
        fontSize: 15,
        fontWeight: '600',
    },
    searchResultSubtext: {
        color: theme.primary,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    mapOverlayHint: { position: 'absolute', bottom: 16, alignSelf: 'center', backgroundColor: theme.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    mapOverlayText: { color: theme.textPrimary, fontSize: 13, fontWeight: '600' },
    toggleBtn: { backgroundColor: theme.inputBg, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.inputBorder },
    toggleActive: { backgroundColor: theme.primary, borderColor: theme.primary, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    toggleText: { color: theme.textSecondary, fontWeight: '700', fontSize: 15 },
    submitButton: { backgroundColor: theme.success, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 40, shadowColor: theme.success, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    submitButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
    buttonDisabled: { backgroundColor: theme.cardBorder, shadowOpacity: 0, elevation: 0 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 5, 15, 0.85)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1A1625', padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
    modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 24, textAlign: 'center' },
    modalSubmitBtn: { backgroundColor: '#7C3AED', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 32, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
    modalSubmitText: { color: '#FFF', fontSize: 18, fontWeight: '800' },

    modalBackdrop: { flex: 1, width: '100%' },
    modalContentList: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, width: '100%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
    modalHeaderText: { color: theme.textPrimary, fontSize: 18, fontWeight: '800' },
    modalListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
    modalListText: { color: theme.textPrimary, fontSize: 16, fontWeight: '500' },

    aiContainer: { flex: 1, alignItems: 'center', paddingTop: 32 },
    aiHeaderIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: theme.cardBorder },
    aiTitle: { fontSize: 28, fontWeight: '900', color: theme.textPrimary, marginBottom: 12, letterSpacing: -0.5 },
    aiSubtitle: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 40, paddingHorizontal: 10 },

    trustedCircleLabelContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12, paddingHorizontal: 4 },
    trustedCircleLabel: { color: theme.textSecondary, fontSize: 12, fontWeight: '800', marginLeft: 8, letterSpacing: 1 },

    mockFriendList: { width: '100%', backgroundColor: theme.card, borderRadius: 20, marginBottom: 40, borderWidth: 1, borderColor: theme.cardBorder, overflow: 'hidden' },
    friendRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
    friendAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    friendInitial: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    friendInfo: { flex: 1 },
    mockFriendName: { color: theme.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    friendStatusOnline: { color: theme.success, fontSize: 13, fontWeight: '500' },
    friendStatusOffline: { color: theme.textSecondary, fontSize: 13, fontWeight: '500' },
    friendStatusBusy: { color: theme.danger, fontSize: 13, fontWeight: '500' },

    aiButton: { flexDirection: 'row', backgroundColor: theme.primary, height: 60, width: '100%', borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
    aiButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },

    zoomControls: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 10,
        gap: 8,
    },
    zoomBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.cardBorder,
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.5, 
        shadowRadius: 5, 
        elevation: 6,
    },
});

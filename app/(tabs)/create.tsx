import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { EventController } from '../../src/controllers/EventController';
import { EventManager } from '../../src/core/event/EventManager';
import { useUIStore } from '../../src/store/uiStore';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';

// DI Stub
const eventController = new EventController(EventManager.getInstance(), {} as any, {} as any);

export default function CreateEventScreen() {
    const { showToast, setGlobalLoading } = useUIStore();
    const theme = useTheme();
    const styles = createStyles(theme);
    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');

    const CATEGORIES = ['Sports', 'Academic', 'Social', 'Gaming', 'Music', 'Tech'];

    // Manual Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(new Date());
    const [durationStr, setDurationStr] = useState('1 hour'); // New Duration state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [capacity, setCapacity] = useState('10');
    const [isPrivate, setIsPrivate] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);

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
            // Simulating the conflict check
            if (selectedDate.getHours() === 10) {
                setConflictWarning('⚠️ Warning: You have a scheduled class around this time!');
            } else {
                setConflictWarning(null);
            }
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const handleManualCreate = async () => {
        if (!title || !category || !date || !selectedLocation) {
            showToast('Please fill all required fields including location.', 'error');
            return;
        }

        setGlobalLoading(true);
        try {
            // Mock parsing
            await eventController.createEvent({
                title,
                category,
                time: date, // Pass the Date object
                duration: durationStr, // Added duration
                location_lat: selectedLocation.latitude,
                location_lng: selectedLocation.longitude
            } as any); // Passing as any for now depending on EventController definition
            showToast('Event Created Successfully!', 'success');
            router.back();
        } catch (e: any) {
            // e.g. ScheduleOverlapException
            showToast(e.message || 'Creation failed', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleAIPlan = async () => {
        setGlobalLoading(true);
        try {
            // Simulating call to RecommendationEngine.getGroupSuggestion() inside a controller
            setTimeout(() => {
                setGlobalLoading(false);
                showToast('AI found a mutual free slot on Friday 18:00 for "Coffee"!', 'success');
                // Pre-fill manual form with AI suggestion for review
                setTitle('Group Coffee');
                setCategory('Social');
                const suggestionDate = new Date();
                suggestionDate.setDate(suggestionDate.getDate() + ((5 + 7 - suggestionDate.getDay()) % 7 || 7));
                suggestionDate.setHours(18, 0, 0, 0);
                setDate(suggestionDate);
                setActiveTab('manual');
            }, 2000);
        } catch (e) {
            setGlobalLoading(false);
            showToast('AI Planning failed', 'error');
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
                    style={[styles.input, { flex: 1, justifyContent: 'center', borderColor: conflictWarning ? theme.danger : theme.inputBorder }]}
                    onPress={() => setShowTimePicker(true)}
                >
                    <Text style={{ color: theme.textPrimary }}>{formatTime(date)}</Text>
                </TouchableOpacity>
            </View>

            {showDatePicker && (
                Platform.OS === 'ios' ? (
                    <Modal transparent animationType="slide">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display="spinner"
                                    textColor={theme.textPrimary}
                                    onChange={(e, d) => { if (d) setDate(d); }}
                                />
                                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.modalSubmitBtn}>
                                    <Text style={styles.modalSubmitText}>Confirm Date</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                ) : (
                    <DateTimePicker
                        value={date}
                        mode="date"
                        display="default"
                        onChange={onChangeDate}
                    />
                )
            )}

            {showTimePicker && (
                Platform.OS === 'ios' ? (
                    <Modal transparent animationType="slide">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <DateTimePicker
                                    value={date}
                                    mode="time"
                                    display="spinner"
                                    textColor={theme.textPrimary}
                                    onChange={(e, d) => {
                                        if (d) {
                                            setDate(d);
                                            if (d.getHours() === 10) setConflictWarning('⚠️ Warning: You have a scheduled class around this time!');
                                            else setConflictWarning(null);
                                        }
                                    }}
                                />
                                <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.modalSubmitBtn}>
                                    <Text style={styles.modalSubmitText}>Confirm Time</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                ) : (
                    <DateTimePicker
                        value={date}
                        mode="time"
                        display="default"
                        onChange={onChangeTime}
                    />
                )
            )}
            {conflictWarning ? <Text style={styles.errorText}>{conflictWarning}</Text> : null}

            {/* Category Picker Modal */}
            <Modal visible={showCategoryPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowCategoryPicker(false)} />
                    <View style={styles.modalContentList}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderText}>Select Category</Text>
                            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
                        </View>
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity key={cat} style={styles.modalListItem} onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}>
                                <Text style={[styles.modalListText, category === cat && { color: theme.primary, fontWeight: '700' }]}>{cat}</Text>
                                {category === cat && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                            </TouchableOpacity>
                        ))}
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

            <Text style={styles.sectionTitle}>3. Location</Text>
            <View style={styles.mapContainer}>
                <MapView
                    style={{ flex: 1 }}
                    initialRegion={{
                        latitude: 39.92077,
                        longitude: 32.85411,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)}
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

            <TouchableOpacity style={[styles.submitButton, conflictWarning ? styles.buttonDisabled : null]} onPress={handleManualCreate} disabled={!!conflictWarning}>
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
            <Text style={styles.aiSubtitle}>Let our AI analyze availability, locations, and interests within your Trusted Circle to find the perfect common ground instantly.</Text>

            {/* Premium Trusted Circle Selector */}
            <View style={styles.trustedCircleLabelContainer}>
                <Ionicons name="people" size={18} color="#94A3B8" />
                <Text style={styles.trustedCircleLabel}>TRUSTED CIRCLE</Text>
            </View>

            <View style={styles.mockFriendList}>
                <View style={styles.friendRow}>
                    <View style={styles.friendAvatar}><Text style={styles.friendInitial}>E</Text></View>
                    <View style={styles.friendInfo}>
                        <Text style={styles.mockFriendName}>Emir</Text>
                        <Text style={styles.friendStatusOnline}>Online • 2 km away</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>

                <View style={[styles.friendRow, { borderBottomWidth: 0 }]}>
                    <View style={[styles.friendAvatar, { backgroundColor: '#334155' }]}><Text style={styles.friendInitial}>A</Text></View>
                    <View style={styles.friendInfo}>
                        <Text style={styles.mockFriendName}>Ayşe</Text>
                        <Text style={styles.friendStatusBusy}>In a meeting until 14:00</Text>
                    </View>
                    <Ionicons name="ellipse-outline" size={24} color="#64748B" />
                </View>
            </View>

            <TouchableOpacity style={styles.aiButton} onPress={handleAIPlan} activeOpacity={0.8}>
                <Ionicons name="flash" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.aiButtonText}>Generate Optimal Plan</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
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
                        <Text style={[styles.tabText, activeTab === 'manual' && styles.activeTabText]}>Manual</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'ai' && styles.activeTabAI]}
                        onPress={() => setActiveTab('ai')}
                        activeOpacity={0.7}
                    >
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
    mapContainer: { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: theme.cardBorder },
    mapOverlayHint: { position: 'absolute', bottom: 16, alignSelf: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    mapOverlayText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
    toggleBtn: { backgroundColor: theme.inputBg, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.inputBorder },
    toggleActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    toggleText: { color: theme.textSecondary, fontWeight: '700', fontSize: 15 },

    submitButton: { backgroundColor: '#10B981', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 40, shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    submitButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
    buttonDisabled: { backgroundColor: theme.cardBorder, shadowOpacity: 0, elevation: 0 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: theme.card, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    modalSubmitBtn: { backgroundColor: theme.primary, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
    modalSubmitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    modalBackdrop: { flex: 1, width: '100%' },
    modalContentList: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, width: '100%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
    modalHeaderText: { color: theme.textPrimary, fontSize: 18, fontWeight: '800' },
    modalListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
    modalListText: { color: theme.textPrimary, fontSize: 16, fontWeight: '500' },

    aiContainer: { flex: 1, alignItems: 'center', paddingTop: 32 },
    aiHeaderIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(139, 92, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' },
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
    friendStatusOnline: { color: '#10B981', fontSize: 13, fontWeight: '500' },
    friendStatusBusy: { color: '#F59E0B', fontSize: 13, fontWeight: '500' },

    aiButton: { flexDirection: 'row', backgroundColor: '#8B5CF6', height: 60, width: '100%', borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
    aiButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});

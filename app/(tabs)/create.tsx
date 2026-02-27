import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { EventController } from '../../src/controllers/EventController';
import { EventManager } from '../../src/core/event/EventManager';
import { useUIStore } from '../../src/store/uiStore';

// DI Stub
const eventController = new EventController(new EventManager(), {} as any, {} as any);

export default function CreateEventScreen() {
    const { showToast, setGlobalLoading } = useUIStore();
    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');

    const CATEGORIES = ['Sports', 'Academic', 'Social', 'Gaming', 'Music', 'Tech'];

    // Manual Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(''); // Simplified for UI
    const [capacity, setCapacity] = useState('10');
    const [isPrivate, setIsPrivate] = useState(false);
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);

    // Focus simulation for real-time background check
    const handleTimeBlur = () => {
        if (date.includes('10:00')) {
            setConflictWarning('⚠️ Warning: You have a scheduled class at this time!');
        } else {
            setConflictWarning(null);
        }
    };

    const handleManualCreate = async () => {
        if (!title || !category || !date) {
            showToast('Please fill all required fields.', 'error');
            return;
        }

        setGlobalLoading(true);
        try {
            // Mock parsing
            await eventController.createEvent({
                title,
                category
            });
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
                setDate('Friday 18:00');
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
            <TextInput style={styles.input} placeholder="Event Title" placeholderTextColor="#7f8c8d" value={title} onChangeText={setTitle} />

            <Text style={styles.label}>Select Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                        onPress={() => setCategory(cat)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>2. Time & Venue</Text>
            <TextInput
                style={[styles.input, conflictWarning ? styles.inputError : null]}
                placeholder="Time (e.g. Today 10:00)"
                placeholderTextColor="#7f8c8d"
                value={date}
                onChangeText={setDate}
                onBlur={handleTimeBlur}
            />
            {conflictWarning && <Text style={styles.errorText}>{conflictWarning}</Text>}

            <Text style={styles.sectionTitle}>3. Settings</Text>
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
        </View>
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

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#020617' }, // Darker slate for premium feel
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 16 },
    backBtn: { minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', letterSpacing: 0.5 },

    tabContainer: { flexDirection: 'row', backgroundColor: '#0F172A', marginHorizontal: 20, borderRadius: 16, padding: 6, marginBottom: 24, borderWidth: 1, borderColor: '#1E293B' },
    tab: { flex: 1, flexDirection: 'row', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    activeTab: { backgroundColor: '#3B82F6', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    activeTabAI: { backgroundColor: '#8B5CF6', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
    tabText: { color: '#64748B', fontWeight: '700', fontSize: 16 },
    activeTabText: { color: '#FFFFFF' },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    // Manual Form
    formContainer: { flex: 1 },
    sectionTitle: { color: '#E2E8F0', fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 16, letterSpacing: 0.5 },
    input: { backgroundColor: '#0F172A', color: '#F8FAFC', height: 56, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1E293B', fontSize: 16 },

    categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', marginRight: 10, height: 40, justifyContent: 'center' },
    categoryChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
    categoryChipText: { color: '#94A3B8', fontWeight: '600' },
    categoryChipTextActive: { color: '#FFFFFF', fontWeight: '800' },

    inputError: { borderColor: '#EF4444', borderWidth: 1.5, backgroundColor: 'rgba(239, 68, 68, 0.05)' },
    errorText: { color: '#F87171', fontSize: 13, marginBottom: 16, marginTop: -8, fontWeight: '500' },

    settingsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    flex1: { flex: 1 },
    label: { color: '#94A3B8', fontSize: 13, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    toggleBtn: { backgroundColor: '#0F172A', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
    toggleActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    toggleText: { color: '#94A3B8', fontWeight: '700', fontSize: 15 },

    submitButton: { backgroundColor: '#10B981', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 40, shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    submitButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
    buttonDisabled: { backgroundColor: '#1E293B', shadowOpacity: 0, elevation: 0 },

    // AI Form (Premium Aesthetics)
    aiContainer: { flex: 1, alignItems: 'center', paddingTop: 32 },
    aiHeaderIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(139, 92, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' },
    aiTitle: { fontSize: 28, fontWeight: '900', color: '#F8FAFC', marginBottom: 12, letterSpacing: -0.5 },
    aiSubtitle: { fontSize: 15, color: '#94A3B8', textAlign: 'center', lineHeight: 24, marginBottom: 40, paddingHorizontal: 10 },

    trustedCircleLabelContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12, paddingHorizontal: 4 },
    trustedCircleLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '800', marginLeft: 8, letterSpacing: 1 },

    mockFriendList: { width: '100%', backgroundColor: '#0F172A', borderRadius: 20, marginBottom: 40, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden' },
    friendRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    friendAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    friendInitial: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    friendInfo: { flex: 1 },
    mockFriendName: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    friendStatusOnline: { color: '#10B981', fontSize: 13, fontWeight: '500' },
    friendStatusBusy: { color: '#F59E0B', fontSize: 13, fontWeight: '500' },

    aiButton: { flexDirection: 'row', backgroundColor: '#8B5CF6', height: 60, width: '100%', borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
    aiButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});

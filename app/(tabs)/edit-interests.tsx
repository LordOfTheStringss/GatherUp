import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useUIStore } from '../../src/store/uiStore';

const ALL_CATEGORIES = {
    "Spor": [
        "Voleybol", "Basketbol", "Futbol", "Tenis", "Yüzme", "Koşu", "Yoga", "Pilates",
        "Fitness", "Kaykay", "Bisiklet", "Okçuluk", "Dağcılık", "Boks", "Masa Tenisi"
    ],
    "Teknoloji & Bilim": [
        "Yazılım", "Yapay Zeka", "Veri Bilimi", "Siber Güvenlik", "Robotik",
        "Oyun Geliştirme", "Blockchain", "Astronomi", "Elektronik"
    ],
    "Sanat & Kültür": [
        "Tiyatro", "Sinema", "Konser", "Dans", "Resim", "Heykel", "Edebiyat",
        "Fotoğrafçılık", "Sergi", "Stand-up", "Müzeler", "Opera"
    ],
    "Hobiler & Yaşam Tarzı": [
        "Kamp", "Satranç", "Kitap", "Yemek", "Gastronomi", "Oyun", "E-spor",
        "Bahçecilik", "Seyahat", "Yabancı Dil", "Koleksiyon", "Müzik Enstrümanı"
    ],
    "Sosyal Etkinlikler": [
        "Gönüllülük", "Networking", "Kariyer Günleri", "Workshop"
    ]
};

// Mock Initial data that would come from the UserController
const MOCK_INITIAL_SELECTED = ["Yazılım", "Basketbol", "Sinema", "Kahve", "Kitap"];

export default function EditInterestsScreen() {
    const { showToast, setGlobalLoading } = useUIStore();
    const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set(MOCK_INITIAL_SELECTED));

    const toggleInterest = (interest: string) => {
        setSelectedInterests(prev => {
            const newSet = new Set(prev);
            if (newSet.has(interest)) {
                newSet.delete(interest);
            } else {
                newSet.add(interest);
            }
            return newSet;
        });
    };

    const handleSave = async () => {
        setGlobalLoading(true);
        try {
            // Mock network call
            await new Promise(resolve => setTimeout(resolve, 800));
            // e.g. await userController.updateProfile("mock-user", { interests: Array.from(selectedInterests) })
            setGlobalLoading(false);
            showToast('İlgi alanları başarıyla güncellendi!', 'success');
            router.back();
        } catch (error) {
            setGlobalLoading(false);
            showToast('Güncelleme başarısız oldu.', 'error');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>İlgi Alanlarımı Düzenle</Text>
                {/* Invisible spacer for center alignment */}
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.subtitle}>Sana uygun etkinlikler önerebilmemiz için beğendiğin kategorileri işaretle.</Text>

                {Object.entries(ALL_CATEGORIES).map(([categoryName, items]) => (
                    <View key={categoryName} style={styles.categorySection}>
                        <Text style={styles.categoryTitle}>{categoryName}</Text>
                        <View style={styles.chipsContainer}>
                            {items.map(item => {
                                const isSelected = selectedInterests.has(item);
                                return (
                                    <TouchableOpacity
                                        key={item}
                                        style={[styles.chip, isSelected ? styles.chipSelected : styles.chipUnselected]}
                                        onPress={() => toggleInterest(item)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : styles.chipTextUnselected]}>
                                            {item}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark" size={16} color="#FFF" style={{ marginLeft: 4 }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
                    <Text style={styles.saveButtonText}>Kaydet ({selectedInterests.size} seçilen)</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#020617' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    backBtn: { minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC' },

    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    subtitle: { fontSize: 15, color: '#94A3B8', marginBottom: 24, lineHeight: 22 },

    categorySection: { marginBottom: 32 },
    categoryTitle: { fontSize: 18, fontWeight: '800', color: '#E2E8F0', marginBottom: 16, letterSpacing: 0.5 },

    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
    chipUnselected: { backgroundColor: '#0F172A', borderColor: '#334155' },
    chipSelected: { backgroundColor: '#3B82F6', borderColor: '#3B82F6', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },

    chipText: { fontSize: 15, fontWeight: '600' },
    chipTextUnselected: { color: '#94A3B8' },
    chipTextSelected: { color: '#FFFFFF' },

    footer: { padding: 20, backgroundColor: '#020617', borderTopWidth: 1, borderTopColor: '#1E293B' },
    saveButton: { backgroundColor: '#10B981', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
    saveButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});

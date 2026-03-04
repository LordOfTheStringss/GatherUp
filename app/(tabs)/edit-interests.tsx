import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { UserController } from '../../src/controllers/UserController';
import { FriendshipManager } from '../../src/core/identity/FriendshipManager';
import { GamificationManager } from '../../src/core/identity/GamificationManager';
import { UserManager } from '../../src/core/identity/UserManager';
import { useUIStore } from '../../src/store/uiStore';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';

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

// DI stub
const userController = new UserController(
    UserManager.getInstance(),
    new FriendshipManager({} as any),
    new GamificationManager()
);

export default function EditInterestsScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const { showToast, setGlobalLoading } = useUIStore();
    const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        const fetchCurrentInterests = async () => {
            setGlobalLoading(true);
            try {
                const res = await userController.getMyProfile();
                if (res.status === 200 && res.data && res.data.interests) {
                    setSelectedInterests(new Set(res.data.interests));
                }
            } catch (e) {
                console.error("Failed to load interests:", e);
                showToast("Failed to load your interests.", "error");
            } finally {
                setGlobalLoading(false);
            }
        };
        fetchCurrentInterests();
    }, []);

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
        setHasChanges(true);
    };

    const handleSave = async () => {
        setGlobalLoading(true);
        try {
            await userController.updateProfile(undefined, { interests: Array.from(selectedInterests) });
            showToast('Interests updated successfully!', 'success');
            setHasChanges(false);
            // Explicitly route to profile instead of router.back() which might pop to index
            router.push('/(tabs)/profile');
        } catch (error) {
            console.error("Save error:", error);
            showToast('Failed to save interests.', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Interests</Text>
                {hasChanges ? (
                    <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                        <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 60 }} />
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={24} color={theme.primary} />
                    <Text style={styles.infoText}>
                        Your interests help us match you with events you'll love. Select all that apply!
                    </Text>
                </View>

                {Object.entries(ALL_CATEGORIES).map(([categoryName, items]) => (
                    <View key={categoryName} style={styles.categorySection}>
                        <Text style={styles.categoryTitle}>{categoryName}</Text>
                        <View style={styles.chipsContainer}>
                            {items.map(item => {
                                const isSelected = selectedInterests.has(item);
                                return (
                                    <TouchableOpacity
                                        key={item}
                                        style={[styles.chip, isSelected && styles.chipSelected]}
                                        onPress={() => toggleInterest(item)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                            {item}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
    backBtn: { minHeight: 44, justifyContent: 'center', width: 60 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary },
    saveBtn: { width: 60, alignItems: 'flex-end', justifyContent: 'center' },
    saveBtnText: { color: theme.primary, fontSize: 16, fontWeight: 'bold' },

    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

    infoBox: { flexDirection: 'row', backgroundColor: theme.primaryLight, padding: 16, borderRadius: 12, marginBottom: 24, alignItems: 'center' },
    infoText: { flex: 1, color: theme.textPrimary, marginLeft: 12, fontSize: 14, lineHeight: 20 },

    categorySection: { marginBottom: 32 },
    categoryTitle: { fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginBottom: 16, letterSpacing: 0.5 },

    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
    chipSelected: { backgroundColor: theme.primary, borderColor: theme.primary, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },

    chipText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    chipTextSelected: { color: '#FFFFFF', fontWeight: '800' },
});

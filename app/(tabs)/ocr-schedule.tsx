import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useUIStore } from '../../src/store/uiStore';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';

export default function OCRScheduleScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const { showToast, setGlobalLoading } = useUIStore();

    const handleCameraScan = () => {
        setGlobalLoading(true);
        setTimeout(() => {
            setGlobalLoading(false);
            showToast('Scan successful! Your schedule has been updated.', 'success');
            router.back();
        }, 2000);
    };

    const handleManualEntry = () => {
        showToast('Manual entry feature coming soon!', 'info');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Update Schedule</Text>
                <View style={{ width: 28 }} />
            </View>

            <View style={styles.container}>
                <View style={styles.iconContainer}>
                    <Ionicons name="calendar" size={80} color={theme.primary} />
                </View>

                <Text style={styles.title}>Keep Your Schedule Updated</Text>
                <Text style={styles.subtitle}>
                    Our AI needs to know your free time to help you plan events. Scan your university course schedule or enter times manually.
                </Text>

                <TouchableOpacity style={styles.actionBtn} onPress={handleCameraScan} activeOpacity={0.8}>
                    <Ionicons name="camera" size={24} color="#FFF" style={{ marginRight: 12 }} />
                    <Text style={styles.actionBtnText}>Scan with Camera (OCR)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={handleManualEntry} activeOpacity={0.8}>
                    <Ionicons name="create-outline" size={24} color={theme.primary} style={{ marginRight: 12 }} />
                    <Text style={styles.secondaryBtnText}>Enter Manually</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
    backBtn: { minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary },
    container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
    iconContainer: { width: 140, height: 140, borderRadius: 70, backgroundColor: theme.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
    title: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginBottom: 16, textAlign: 'center' },
    subtitle: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 48, paddingHorizontal: 16 },
    actionBtn: { flexDirection: 'row', width: '100%', backgroundColor: theme.primary, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    actionBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    secondaryBtn: { flexDirection: 'row', width: '100%', backgroundColor: theme.background, borderWidth: 2, borderColor: theme.primary, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    secondaryBtnText: { color: theme.primary, fontSize: 18, fontWeight: 'bold' }
});

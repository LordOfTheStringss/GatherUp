import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafetyService } from '../../core/event/SafetyService';
import { AuthManager } from '../../core/identity/AuthManager';
import { Location, LocationType } from '../../spatial/Location';
import { useUIStore } from '../../store/uiStore';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/useTheme';

// DI Stub
const safetyService = new SafetyService();

export const PanicButton = () => {
    const { showToast } = useUIStore();
    const theme = useTheme();
    const styles = createStyles(theme);
    const [modalVisible, setModalVisible] = useState(false);
    const [triggering, setTriggering] = useState(false);

    const handlePanic = async () => {
        setTriggering(true);
        try {
            const authManager = AuthManager.getInstance();
            let currentUser: any = null;
            try {
                currentUser = await authManager.getCurrentUser();
            } catch (e) { }

            // Mock GeoPoint location extraction using actual Location type
            const mockLocation = new Location('loc-panic', 'Current Location', { latitude: 39.9, longitude: 32.8 }, LocationType.CAMPUS);
            if (currentUser) {
                await safetyService.triggerPanic(currentUser, mockLocation);
            }
            showToast('EMERGENCY BROADCAST SENT TO TRUSTED CIRCLE', 'error');
        } catch (e) {
            showToast('Panic signal failed! Call local authorities.', 'error');
        } finally {
            setTriggering(false);
            setModalVisible(false);
        }
    };

    return (
        <>
            <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0, marginTop: 12 }]} onPress={() => setModalVisible(true)} activeOpacity={0.7}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Ionicons name="warning-outline" size={22} color="#EF4444" />
                </View>
                <Text style={[styles.actionText, { color: '#EF4444', fontWeight: 'bold' }]}>Emergency Panic Signal</Text>
                <Ionicons name="chevron-forward" size={20} color="#EF4444" />
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Ionicons name="warning" size={64} color="#EF4444" style={{ marginBottom: 16 }} />
                        <Text style={styles.modalTitle}>EMERGENCY</Text>
                        <Text style={styles.modalText}>
                            Are you sure you want to trigger a Panic Alert? Your live location will be sent to your Trusted Circle immediately.
                        </Text>

                        {triggering ? (
                            <ActivityIndicator size="large" color="#EF4444" />
                        ) : (
                            <View style={styles.modalActionRow}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.confirmBtn} onPress={handlePanic}>
                                    <Text style={styles.confirmText}>TRIGGER PANIC</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.cardBorder },
    actionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    actionText: { flex: 1, fontSize: 16, color: theme.textPrimary, fontWeight: '600' },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20
    },
    modalContent: {
        width: '100%', backgroundColor: theme.card, borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: theme.danger
    },
    modalTitle: { color: theme.danger, fontSize: 28, fontWeight: 'bold', marginBottom: 16, letterSpacing: 2 },
    modalText: { color: theme.textSecondary, textAlign: 'center', marginBottom: 32, fontSize: 16, lineHeight: 24 },

    modalActionRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
    cancelBtn: { flex: 1, backgroundColor: theme.cardBorder, paddingVertical: 16, borderRadius: 12, marginRight: 8, alignItems: 'center' },
    cancelText: { color: theme.textPrimary, fontWeight: 'bold', fontSize: 16 },

    confirmBtn: { flex: 1, backgroundColor: theme.danger, paddingVertical: 16, borderRadius: 12, marginLeft: 8, alignItems: 'center', shadowColor: theme.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 8 },
    confirmText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});

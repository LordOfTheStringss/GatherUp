import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafetyService } from '../../core/event/SafetyService';
import { User } from '../../core/identity/User';
import { Location, LocationType } from '../../spatial/Location';
import { useUIStore } from '../../store/uiStore';

// DI Stub
const safetyService = new SafetyService();

export const PanicButton = () => {
    const { showToast } = useUIStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [triggering, setTriggering] = useState(false);

    // Mock User
    const mockUser = new User('user-1', 'test@edu.tr');
    mockUser.fullName = 'John Doe';

    const handlePanic = async () => {
        setTriggering(true);
        try {
            // Mock GeoPoint location extraction using actual Location type
            const mockLocation = new Location('loc-panic', 'Current Location', { latitude: 39.9, longitude: 32.8 }, LocationType.CAMPUS);
            await safetyService.triggerPanic(mockUser, mockLocation);
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
            <TouchableOpacity
                style={styles.floatingButton}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
            >
                <Ionicons name="warning" size={24} color="#FFF" />
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
                            <View style={styles.actionRow}>
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

const styles = StyleSheet.create({
    floatingButton: {
        position: 'absolute',
        top: 60, // Top right corner globally
        right: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(239, 68, 68, 0.8)', // Semi-transparent Red
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 8,
        zIndex: 9997, // Just below Loading/Toast
        borderWidth: 2,
        borderColor: '#EF4444',
    },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20
    },
    modalContent: {
        width: '100%', backgroundColor: '#1E293B', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#EF4444'
    },
    modalTitle: { color: '#EF4444', fontSize: 28, fontWeight: 'bold', marginBottom: 16, letterSpacing: 2 },
    modalText: { color: '#E2E8F0', textAlign: 'center', marginBottom: 32, fontSize: 16, lineHeight: 24 },

    actionRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
    cancelBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 16, borderRadius: 12, marginRight: 8, alignItems: 'center' },
    cancelText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

    confirmBtn: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 12, marginLeft: 8, alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 8 },
    confirmText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});

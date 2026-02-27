import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScheduleController } from '../../src/controllers/ScheduleController';
import { OCRProcessor } from '../../src/core/schedule/OCRProcessor';
import { ScheduleManager } from '../../src/core/schedule/ScheduleManager';
import { useUIStore } from '../../src/store/uiStore';

// DI Stub
import * as ImagePicker from 'expo-image-picker';
const scheduleController = new ScheduleController(
    new ScheduleManager(),
    new OCRProcessor()
);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = ['09:00', '11:00', '13:00', '15:00']; // Simplified for mobile UI

type GridState = { [day: string]: { [hour: string]: boolean } }; // true = busy, false = free

export default function PlanTimeScreen() {
    const { showToast, setGlobalLoading } = useUIStore();
    const [step, setStep] = useState<'type_select' | 'upload' | 'edit'>('type_select');
    const [grid, setGrid] = useState<GridState>({});

    const startManualEntry = () => {
        // Initialize empty grid for manual entry (e.g. for Working professionals)
        const emptyGrid: GridState = {};
        DAYS.forEach(day => {
            emptyGrid[day] = {};
            HOURS.forEach(hour => {
                emptyGrid[day][hour] = false;
            });
        });
        setGrid(emptyGrid);
        setStep('edit');
    };

    const handleUpload = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 1,
            });

            if (result.canceled) {
                return;
            }

            setGlobalLoading(true);

            // 1. Upload mock / Pass to OCR
            const uploadRes = await scheduleController.uploadScheduleImage({ buffer: result.assets[0].uri, filename: 'schedule.jpg' });

            // 2. Process mock
            await scheduleController.processScheduleImage(uploadRes.data!);

            // Initialize mock grid representing OCR output
            const mockGrid: GridState = {};
            DAYS.forEach(day => {
                mockGrid[day] = {};
                HOURS.forEach(hour => {
                    // Randomly set some as busy to simulate processed schedule
                    mockGrid[day][hour] = Math.random() > 0.7;
                });
            });
            setGrid(mockGrid);
            setStep('edit');
            showToast('Schedule parsed! Tap slots to fix any mistakes.', 'success');
        } catch (e) {
            showToast('Processing failed', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const toggleSlot = (day: string, hour: string) => {
        setGrid(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                [hour]: !prev[day][hour]
            }
        }));
    };

    const handleConfirm = async () => {
        setGlobalLoading(true);
        try {
            // Typically we would map the visual grid back to DTOs
            await scheduleController.confirmSchedule([]);
            showToast('Schedule saved!', 'success');
            router.replace('/(tabs)');
        } catch (error) {
            showToast('Failed to save schedule', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    if (step === 'type_select') {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.title}>Welcome!</Text>
                    <Text style={styles.subtitle}>To help us find the best times for your events, tell us about your daily routine.</Text>

                    <TouchableOpacity style={styles.typeButton} onPress={() => setStep('upload')}>
                        <View style={styles.typeIconContainer}><Text style={{ fontSize: 24 }}>🎓</Text></View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.typeTitle}>I'm a Student</Text>
                            <Text style={styles.typeDesc}>Upload your class schedule (OCR) or set it manually.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.typeButton} onPress={startManualEntry}>
                        <View style={styles.typeIconContainer}><Text style={{ fontSize: 24 }}>💼</Text></View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.typeTitle}>I'm Working</Text>
                            <Text style={styles.typeDesc}>Manually set your working hours and availability.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={[styles.linkTouchTarget, { marginTop: 40 }]}>
                        <Text style={styles.linkText}>Skip for now</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (step === 'upload') {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.title}>Plan Your Time</Text>
                    <Text style={styles.subtitle}>Upload your University timetable. Our AI will automatically extract your busy hours.</Text>

                    <TouchableOpacity style={styles.uploadBox} onPress={handleUpload}>
                        <Text style={styles.uploadText}>📸 Tap to Choose from Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={startManualEntry} style={styles.linkTouchTarget}>
                        <Text style={styles.linkText}>Enter manually instead</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { paddingHorizontal: 20, paddingTop: 60 }]}>Verify Schedule</Text>
            <Text style={[styles.subtitle, { paddingHorizontal: 20, marginBottom: 20 }]}>
                Review and correct any mistakes. Red means busy, Green means free.
            </Text>

            <ScrollView horizontal style={styles.gridContainer}>
                <View>
                    <View style={styles.row}>
                        <View style={styles.cornerCell} />
                        {DAYS.map(day => (
                            <Text key={day} style={styles.headerCell}>{day}</Text>
                        ))}
                    </View>

                    {HOURS.map(hour => (
                        <View style={styles.row} key={hour}>
                            <Text style={styles.timeLabel}>{hour}</Text>
                            {DAYS.map(day => {
                                const isBusy = grid[day]?.[hour];
                                return (
                                    <TouchableOpacity
                                        key={`${day}-${hour}`}
                                        style={[styles.gridCell, isBusy ? styles.cellBusy : styles.cellFree]}
                                        onPress={() => toggleSlot(day, hour)}
                                    />
                                );
                            })}
                        </View>
                    ))}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.button} onPress={handleConfirm}>
                    <Text style={styles.buttonText}>Confirm & Finish</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#94A3B8', marginBottom: 32 },

    typeButton: {
        backgroundColor: '#1E293B',
        flexDirection: 'row',
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155'
    },
    typeIconContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    typeTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    typeDesc: { color: '#94A3B8', fontSize: 14, lineHeight: 20 },

    uploadBox: {
        height: 200,
        backgroundColor: '#1E293B',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#334155',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    uploadText: { fontSize: 18, color: '#3B82F6', fontWeight: 'bold' },

    gridContainer: { flex: 1, paddingHorizontal: 20 },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    cornerCell: { width: 60, height: 40 },
    headerCell: { width: 60, color: '#94A3B8', textAlign: 'center', fontWeight: 'bold' },
    timeLabel: { width: 60, color: '#94A3B8', fontSize: 12 },

    gridCell: {
        width: 60,
        height: 40,
        marginHorizontal: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#334155',
    },
    cellFree: { backgroundColor: '#10B981' }, // Emerald green
    cellBusy: { backgroundColor: '#EF4444' }, // Red

    footer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    button: {
        backgroundColor: '#3B82F6', height: 52, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center'
    },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

    linkTouchTarget: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    linkText: { color: '#94A3B8', fontSize: 16 }
});

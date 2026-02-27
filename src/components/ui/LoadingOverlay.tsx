import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useUIStore } from '../../store/uiStore';

export const LoadingOverlay = () => {
    const { isGlobalLoading } = useUIStore();

    if (!isGlobalLoading) return null;

    return (
        <View style={styles.container}>
            <View style={styles.background} />
            <ActivityIndicator size="large" color="#3498DB" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9998, // Just below Toast
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        opacity: 0.5,
    }
});

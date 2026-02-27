import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useUIStore } from '../../store/uiStore';

export const Toast = () => {
    const { toast } = useUIStore();
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (toast.visible) {
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            // uiStore auto-hides after 3s, fade out just before
            setTimeout(() => {
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            }, 2700);
        } else {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [toast.visible]);

    if (!toast.visible) return null;

    return (
        <Animated.View style={[
            styles.container,
            { opacity },
            toast.type === 'error' && styles.error,
            toast.type === 'success' && styles.success,
            toast.type === 'info' && styles.info,
        ]}>
            <Text style={styles.message}>{toast.message}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        padding: 15,
        borderRadius: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 9999, // Ensure it's always on top
    },
    error: { backgroundColor: '#E74C3C' }, // Red
    success: { backgroundColor: '#2ECC71' }, // Green
    info: { backgroundColor: '#3498DB' }, // Blue
    message: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    }
});

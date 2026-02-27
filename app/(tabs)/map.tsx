import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useUIStore } from '../../src/store/uiStore';

const { width, height } = Dimensions.get('window');

// Custom dark map style
const mapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#1d2c4d" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#8ec3b9" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1a3646" }] },
    { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] },
    { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#64779e" }] },
    { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#334e87" }] },
    { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#023e58" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#283d6a" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#6f9ba5" }] },
    { "featureType": "poi", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
    { "featureType": "poi.park", "elementType": "geometry.fill", "stylers": [{ "color": "#023e58" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#3C7680" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#304a7d" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#98a5be" }] },
    { "featureType": "road", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#2c6675" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#255763" }] },
    { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#b0d5ce" }] },
    { "featureType": "road.highway", "elementType": "labels.text.stroke", "stylers": [{ "color": "#023e58" }] },
    { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#98a5be" }] },
    { "featureType": "transit", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
    { "featureType": "transit.line", "elementType": "geometry.fill", "stylers": [{ "color": "#283d6a" }] },
    { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#3a4762" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0e1626" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#4e6d70" }] }
];

export default function MapScreen() {
    const { showToast, setGlobalLoading } = useUIStore();
    const [viewMode, setViewMode] = useState<'pins' | 'heatmap'>('pins');
    const [activeRegionStat, setActiveRegionStat] = useState<string | null>(null);

    const toggleHeatmap = () => {
        setViewMode(prev => prev === 'pins' ? 'heatmap' : 'pins');

        if (viewMode === 'pins') {
            // Switching TO heatmap
            setGlobalLoading(true);
            setTimeout(() => {
                setGlobalLoading(false);
                setActiveRegionStat('Kızılay: 70% Social, 30% Study Events currently active.');
                showToast('Heatmap data loaded via AnalyticsEngine', 'success');
            }, 1500);
        } else {
            setActiveRegionStat(null);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>

                {/* Absolute Header Overlay */}
                <View style={styles.headerOverlay}>
                    <Text style={styles.title}>Spatio-Temporal View</Text>
                    <TouchableOpacity
                        style={[styles.toggleButton, viewMode === 'heatmap' && styles.toggleActive]}
                        onPress={toggleHeatmap}
                    >
                        <Ionicons name="flame" size={20} color={viewMode === 'heatmap' ? '#FFF' : '#EF4444'} />
                        <Text style={[styles.toggleText, viewMode === 'heatmap' && { color: '#FFF' }]}>
                            {viewMode === 'heatmap' ? 'Hide Heatmap' : 'Show Heatmap'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* REAL MAP AREA */}
                <View style={styles.mapContainer}>
                    <MapView
                        style={styles.map}
                        customMapStyle={mapStyle}
                        initialRegion={{
                            latitude: 39.92077,
                            longitude: 32.85411,
                            latitudeDelta: 0.0922,
                            longitudeDelta: 0.0421,
                        }}
                        showsUserLocation={true}
                        showsMyLocationButton={false}
                    >
                        {/* Event Markers */}
                        {viewMode === 'pins' && (
                            <>
                                <Marker coordinate={{ latitude: 39.925, longitude: 32.85 }} title="Campus Football" description="Today 18:00 - Sports">
                                    <View style={[styles.markerBadge, { backgroundColor: '#3B82F6' }]}>
                                        <Ionicons name="football" size={16} color="#FFF" />
                                    </View>
                                </Marker>
                                <Marker coordinate={{ latitude: 39.915, longitude: 32.86 }} title="Coffee Break" description="Today 15:30 - Social">
                                    <View style={[styles.markerBadge, { backgroundColor: '#10B981' }]}>
                                        <Ionicons name="cafe" size={16} color="#FFF" />
                                    </View>
                                </Marker>
                                <Marker coordinate={{ latitude: 39.93, longitude: 32.84 }} title="Tech Meetup" description="Tomorrow 19:00 - Networking">
                                    <View style={[styles.markerBadge, { backgroundColor: '#8B5CF6' }]}>
                                        <Ionicons name="laptop" size={16} color="#FFF" />
                                    </View>
                                </Marker>
                            </>
                        )}

                        {/* Heatmap Overlay Simulation (Polygon) */}
                        {viewMode === 'heatmap' && (
                            <Polygon
                                coordinates={[
                                    { latitude: 39.93, longitude: 32.84 },
                                    { latitude: 39.93, longitude: 32.86 },
                                    { latitude: 39.91, longitude: 32.86 },
                                    { latitude: 39.91, longitude: 32.84 },
                                ]}
                                fillColor="rgba(239, 68, 68, 0.3)"
                                strokeColor="rgba(239, 68, 68, 0.6)"
                                strokeWidth={2}
                            />
                        )}
                    </MapView>
                </View>

                {/* Floating Region Stats Box */}
                {activeRegionStat && (
                    <View style={styles.statsBox}>
                        <Text style={styles.statsTitle}>Live Regional Analysis</Text>
                        <Text style={styles.statsText}>{activeRegionStat}</Text>
                    </View>
                )}

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0F172A' },
    container: { flex: 1 },

    headerOverlay: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 40 : 10,
        left: 20,
        right: 20,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8,
    },
    title: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
    toggleButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
    toggleActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    toggleText: { color: '#94A3B8', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },

    mapContainer: { flex: 1, overflow: 'hidden' },
    map: { width: '100%', height: '100%' },

    markerBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 5,
        borderWidth: 2,
        borderColor: '#FFF',
    },

    statsBox: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: '#1E293B',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#EF4444',
        shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10,
    },
    statsTitle: { color: '#EF4444', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
    statsText: { color: '#FFF', fontSize: 14, lineHeight: 22 },
});

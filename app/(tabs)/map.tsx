import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { EventController } from '../../src/controllers/EventController';
import { EventManager } from '../../src/core/event/EventManager';
import { useUIStore } from '../../src/store/uiStore';

const eventController = new EventController(EventManager.getInstance(), {} as any, {} as any);

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
    const [selectedCoord, setSelectedCoord] = useState<{ latitude: number, longitude: number } | null>(null);
    const [trendingEvents, setTrendingEvents] = useState<any[]>([]);

    const [allEvents, setAllEvents] = useState<any[]>([]);

    useEffect(() => {
        const fetchEvents = async () => {
            setGlobalLoading(true);
            try {
                const res = await eventController.getEvents({ category: 'All' });
                if (res.data) {
                    setAllEvents(res.data.filter((e: any) => e.location_lat && e.location_lng));
                }
            } catch (e) {
                console.error("Map fetch error:", e);
            } finally {
                setGlobalLoading(false);
            }
        };
        fetchEvents();
    }, []);

    const handleMapPress = (coord: { latitude: number, longitude: number }) => {
        setSelectedCoord(coord);

        const nearby = allEvents.filter(e =>
            Math.abs(e.location_lat - coord.latitude) < 0.05 &&
            Math.abs(e.location_lng - coord.longitude) < 0.05
        );

        const mappedTrending = nearby.map(e => ({
            id: e.id,
            title: e.title,
            participants: e.max_capacity || Math.floor(Math.random() * 50) + 5,
            category: e.sub_category
        }));

        setTrendingEvents(mappedTrending);
    };

    const [showHeatmap, setShowHeatmap] = useState(false);

    // Group events by rough location for heatmap
    const getHeatmapData = () => {
        const heatmap: any[] = [];
        // A very basic heatmap clustering simulation by category
        allEvents.forEach(evt => {
            const existingNode = heatmap.find(h =>
                Math.abs(h.latitude - evt.location_lat) < 0.02 &&
                Math.abs(h.longitude - evt.location_lng) < 0.02 &&
                h.category === evt.sub_category
            );

            if (existingNode) {
                existingNode.weight += 1;
            } else {
                heatmap.push({
                    id: `heat_${evt.id}`,
                    latitude: evt.location_lat,
                    longitude: evt.location_lng,
                    category: evt.sub_category,
                    weight: 1
                });
            }
        });
        return heatmap;
    };

    const heatmapData = getHeatmapData();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.headerControls}>
                    <TouchableOpacity
                        style={[styles.heatmapToggle, showHeatmap && styles.heatmapToggleActive]}
                        onPress={() => setShowHeatmap(!showHeatmap)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="flame" size={20} color={showHeatmap ? "#FFF" : "#F59E0B"} />
                        <Text style={[styles.heatmapToggleText, showHeatmap && { color: '#FFF' }]}>
                            {showHeatmap ? "Heatmap On" : "Show Heatmap"}
                        </Text>
                    </TouchableOpacity>
                </View>

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
                        onPress={(e) => handleMapPress(e.nativeEvent.coordinate)}
                    >
                        {/* Event Markers */}
                        {
                            selectedCoord && !showHeatmap && (
                                <Marker coordinate={selectedCoord}>
                                    <View style={[styles.markerBadge, { backgroundColor: '#F59E0B', width: 40, height: 40, borderRadius: 20 }]}>
                                        <Ionicons name="location" size={20} color="#FFF" />
                                    </View>
                                </Marker>
                            )
                        }
                        {/* Live Markers from DB */}
                        {
                            !selectedCoord && !showHeatmap && allEvents.map((evt: any) => (
                                <Marker
                                    key={evt.id}
                                    coordinate={{ latitude: evt.location_lat, longitude: evt.location_lng }}
                                    title={evt.title}
                                    description={evt.sub_category}
                                >
                                    <View style={[styles.markerBadge, { backgroundColor: '#3B82F6' }]}>
                                        <Ionicons name="location" size={16} color="#FFF" />
                                    </View>
                                </Marker>
                            ))
                        }

                        {/* Heatmap Nodes */}
                        {
                            showHeatmap && heatmapData.map((node: any) => (
                                <Marker
                                    key={node.id}
                                    coordinate={{ latitude: node.latitude, longitude: node.longitude }}
                                    title={`${node.category} Hotspot`}
                                    description={`${node.weight} events in this area`}
                                >
                                    <View style={[
                                        styles.heatmapNode,
                                        {
                                            width: Math.min(100, 30 + (node.weight * 15)),
                                            height: Math.min(100, 30 + (node.weight * 15)),
                                            borderRadius: Math.min(100, 30 + (node.weight * 15)) / 2,
                                            backgroundColor: `rgba(239, 68, 68, ${Math.min(0.8, 0.3 + (node.weight * 0.1))})`
                                        }
                                    ]}>
                                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>{node.category}</Text>
                                    </View>
                                </Marker>
                            ))
                        }
                    </MapView >
                </View >

                {/* Trending Events Bottom Panel */}
                {
                    selectedCoord && trendingEvents.length > 0 && (
                        <View style={styles.trendingPanel}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={styles.trendingPanelTitle}>Trending Nearby</Text>
                                <TouchableOpacity onPress={() => setSelectedCoord(null)}><Ionicons name="close" size={24} color="#94A3B8" /></TouchableOpacity>
                            </View>
                            {trendingEvents.map(event => (
                                <View key={event.id} style={styles.trendingEventRow}>
                                    <View style={styles.trendingEventIcon}>
                                        <Ionicons name="flash" size={16} color="#F59E0B" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.trendingEventTitle}>{event.title}</Text>
                                        <Text style={styles.trendingEventCategory}>{event.category}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.trendingEventStats}>{event.participants} going</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )
                }

                {/* Zero State Bottom Panel */}
                {
                    selectedCoord && trendingEvents.length === 0 && (
                        <View style={styles.trendingPanel}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.trendingPanelTitle}>No Events Nearby</Text>
                                <TouchableOpacity onPress={() => setSelectedCoord(null)}><Ionicons name="close" size={24} color="#94A3B8" /></TouchableOpacity>
                            </View>
                            <Text style={{ color: '#94A3B8', fontSize: 16, marginBottom: 20, lineHeight: 22 }}>Buralarda hiç aktivite oluşturulmamış, ilk sen oluştur!</Text>
                            <TouchableOpacity
                                style={[styles.joinButton, { width: '100%', alignItems: 'center' }]}
                                onPress={() => {
                                    const lat = selectedCoord.latitude;
                                    const lng = selectedCoord.longitude;
                                    setSelectedCoord(null);
                                    router.push({
                                        pathname: '/(tabs)/create',
                                        params: { lat, lng }
                                    });
                                }}
                            >
                                <Text style={styles.joinButtonText}>Create Event Here</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }

            </View >
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#15202B' },
    container: { flex: 1 },
    mapContainer: { flex: 1, overflow: 'hidden' },
    map: { width: '100%', height: '100%' },

    headerControls: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
    },
    heatmapToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C2733',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
    },
    heatmapToggleActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#F59E0B',
    },
    heatmapToggleText: {
        color: '#94A3B8',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    heatmapNode: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },

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
        backgroundColor: '#1C2733',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#EF4444',
        shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10,
    },
    statsTitle: { color: '#EF4444', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
    statsText: { color: '#FFF', fontSize: 14, lineHeight: 22 },

    trendingPanel: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#1C2733',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10,
    },
    trendingPanelTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    trendingEventRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    trendingEventIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(245, 158, 11, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    trendingEventTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 2 },
    trendingEventCategory: { color: '#94A3B8', fontSize: 13 },
    trendingEventStats: { color: '#F59E0B', fontSize: 14, fontWeight: 'bold' },

    joinButton: { backgroundColor: '#3B82F6', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    joinButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

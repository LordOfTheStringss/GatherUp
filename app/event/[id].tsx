import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, KeyboardAvoidingView, ScrollView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Dimensions } from 'react-native';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useUIStore } from '../../src/store/uiStore';
import { getColorForTag, getCategoryForTag } from '../../src/data/interestTags';
import { useTheme } from '../../src/theme/useTheme';
import { ThemeColors } from '../../src/theme/colors';

const { width } = Dimensions.get('window');

const BADGE_CONFIG: Record<string, { icon: string; title: string; color: string; desc: string }> = {
    FIRST_STEP: { icon: "footsteps", title: "First Step", color: "#3B82F6", desc: "1 Event Attended" },
    THE_REGULAR: { icon: "calendar", title: "The Regular", color: "#8B5CF6", desc: "10 Events Attended" },
    COMMUNITY_LEGEND: { icon: "star", title: "Community Legend", color: "#F59E0B", desc: "50 Events Attended" },
    THE_HOST: { icon: "home", title: "The Host", color: "#10B981", desc: "1 Event Hosted" },
    ACTIVE_ORGANIZER: { icon: "megaphone", title: "Active Organizer", color: "#EC4899", desc: "10 Events Hosted" },
    LISAN_AL_GAIB: { icon: "planet", title: "Lisan al-Gaib", color: "#F43F5E", desc: "30 Events Hosted" },
    TEAM_SPIRIT: { icon: "people", title: "Team Spirit", color: "#06B6D4", desc: "1 Group AI Plan" },
    THE_COORDINATOR: { icon: "options", title: "The Coordinator", color: "#6366F1", desc: "10 Group Plans" },
    THE_GANGMAKER: { icon: "flame", title: "The GangMaker", color: "#EAB308", desc: "25 Group Plans" },
    SPONTANEOUS: { icon: "flash", title: "Spontaneous", color: "#14B8A6", desc: "1 AI Suggestion" },
    THE_ADVENTURER: { icon: "compass", title: "The Adventurer", color: "#D946EF", desc: "10 AI Suggestions" },
    INDIANA_JONES: { icon: "map", title: "Indiana Jones", color: "#84CC16", desc: "25 AI Suggestions" },
};

export default function EventDetailScreen() {
    const { id } = useLocalSearchParams();
    const { showToast } = useUIStore();
    const theme = useTheme();
    const styles = createStyles(theme);

    const [inputText, setInputText] = useState('');
    const [messages, setMessages] = useState<any[]>([]);
    const [showParticipantModal, setShowParticipantModal] = useState(false);
    const [showChat, setShowChat] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [hasJoined, setHasJoined] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [participants, setParticipants] = useState<any[]>([]);
    const [eventDetails, setEventDetails] = useState<any | null>(null);
    const [organizerName, setOrganizerName] = useState('');
    const [isLoadingEvent, setIsLoadingEvent] = useState(true);

    useEffect(() => {
        let channel: any;

        const fetchEventData = async () => {
            setIsLoadingEvent(true);
            try {
                const { AuthManager } = await import('../../src/core/identity/AuthManager');
                const session = await AuthManager.getInstance().getCurrentUser();
                if (session) setCurrentUserId(session.id);

                const { SupabaseClient } = await import('../../src/infra/SupabaseClient');
                const supabase = SupabaseClient.getInstance().client;

                // Fetch full event details
                const { data: evData } = await supabase
                    .from('events')
                    .select('*, users!events_organizer_id_fkey(id, full_name, profile_image, badges)')
                    .eq('id', id)
                    .single();

                if (evData) {
                    setEventDetails(evData);
                    setOrganizerName(evData.users?.full_name || 'Anonymous');

                    if (session && evData.organizer_id === session.id) {
                        setIsHost(true);
                        setHasJoined(true);
                    }
                }

                // Fetch participants
                const { EventController } = await import('../../src/controllers/EventController');
                const { EventManager } = await import('../../src/core/event/EventManager');
                const evController = new EventController(EventManager.getInstance(), {} as any, {} as any);
                const pRes = await evController.getParticipants(id as string);

                let loadedParts: any[] = [];
                if (pRes.status === 200 && pRes.data) {
                    loadedParts = [...pRes.data];
                }

                // Ensure organizer is always in the list
                if (evData) {
                    const orgId = evData.organizer_id;
                    const hostAlreadyIn = loadedParts.some((p: any) => p.id === orgId);
                    
                    if (!hostAlreadyIn) {
                        // Fallback host object if evData.users relationship failed
                        const hostObj = evData.users ? {
                            id: orgId,
                            full_name: evData.users.full_name,
                            profile_image: evData.users.profile_image,
                            badges: evData.users.badges
                        } : {
                            id: orgId,
                            full_name: 'Organizer',
                            profile_image: null,
                            badges: []
                        };
                        loadedParts.unshift(hostObj);
                    }
                }

                setParticipants(loadedParts);
                if (session && loadedParts.some((p: any) => p.id === session.id)) {
                    setHasJoined(true);
                }

                // Fetch Chat History
                const { data: chatData, error: chatErr } = await supabase
                    .from('chat_messages')
                    .select('id, content, sender_id, created_at, users(full_name)')
                    .eq('event_id', id)
                    .order('created_at', { ascending: false });

                if (!chatErr && chatData) {
                    setMessages(chatData);
                }

                // Subscribe to Realtime Chat
                channel = supabase
                    .channel(`event-chat-${id}`)
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${id}` },
                        (payload: any) => {
                            const newMsg = payload.new;
                            setParticipants((currentParticipants) => {
                                const sender = currentParticipants.find(p => p.id === newMsg.sender_id);
                                if (sender) {
                                    newMsg.users = { full_name: sender.full_name };
                                }
                                return currentParticipants;
                            });
                            setMessages((prev) => {
                                const exists = prev.some(m => m.id === newMsg.id || (m.content === newMsg.content && m.sender_id === newMsg.sender_id && m.id.startsWith('temp-')));
                                if (exists) {
                                    return prev.map(m => (m.content === newMsg.content && m.sender_id === newMsg.sender_id && m.id.startsWith('temp-')) ? newMsg : m);
                                }
                                return [newMsg, ...prev];
                            });
                        }
                    )
                    .subscribe();

            } catch (error) {
                console.error("Failed to load event data", error);
            } finally {
                setIsLoadingEvent(false);
            }
        };

        fetchEventData();

        return () => {
            if (channel) channel.unsubscribe();
        };
    }, [id]);

    const handleJoinEvent = async (forceJoin: boolean = false) => {
        if (!forceJoin) {
            Alert.alert("Join Event", "Are you sure you want to join this event?", [
                { text: "Cancel", style: "cancel" },
                { text: "Join", onPress: () => performJoin(false) }
            ]);
        } else {
            performJoin(true);
        }
    };

    const performJoin = async (forceJoin: boolean) => {
        try {
            const { EventController } = await import('../../src/controllers/EventController');
            const { EventManager } = await import('../../src/core/event/EventManager');
            const evController = new EventController(EventManager.getInstance(), {} as any, {} as any);

            const res = await evController.joinEvent(id as string, forceJoin);
            
            if (res.status === 409) {
                // Schedule conflict — ask user if they want to force join
                Alert.alert(
                    "Schedule Conflict",
                    res.message || "You have a conflicting event. Join anyway?",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Yes, Join Anyway", style: "destructive", onPress: () => handleJoinEvent(true) }
                    ]
                );
                return;
            }
            
            if (res.status === 200) {
                showToast("Successfully joined event!", "success");
                setHasJoined(true);
                const { AuthManager } = await import('../../src/core/identity/AuthManager');
                const user = await AuthManager.getInstance().getCurrentUser();
                if (user) {
                    const { SupabaseClient } = await import('../../src/infra/SupabaseClient');
                    const { data: me } = await SupabaseClient.getInstance().client.from('users').select('id, full_name, profile_image, badges').eq('id', user.id).single();
                    if (me) {
                        setParticipants(prev => [...prev, me]);
                    }
                }
                const { SupabaseClient } = await import('../../src/infra/SupabaseClient');
                const { data: freshChat } = await SupabaseClient.getInstance().client
                    .from('chat_messages')
                    .select('id, content, sender_id, created_at, users(full_name)')
                    .eq('event_id', id)
                    .order('created_at', { ascending: false });
                if (freshChat) setMessages(freshChat);
            } else {
                showToast(res.message || "Could not join", "error");
            }
        } catch (e: any) {
            showToast(e.message || "Error joining", "error");
        }
    };

    const handleAddFriend = async (friendId: string) => {
        try {
            const { FriendshipManager } = await import('../../src/core/identity/FriendshipManager');
            const friendshipManager = FriendshipManager.getInstance();
            
            await friendshipManager.sendRequest(currentUserId, friendId);
            showToast("Friend request sent!", "success");
        } catch (e: any) {
            showToast("Could not send request: " + e.message, "error");
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim() || !currentUserId) return;
        const messageContent = inputText.trim();
        setInputText('');
        const optimisticMsg = {
            id: 'temp-' + Date.now(),
            content: messageContent,
            sender_id: currentUserId,
            created_at: new Date().toISOString(),
            users: { full_name: 'You' }
        };
        setMessages(prev => [optimisticMsg, ...prev]);
        try {
            const { SupabaseClient } = await import('../../src/infra/SupabaseClient');
            const { error } = await SupabaseClient.getInstance().client
                .from('chat_messages')
                .insert({
                    event_id: id,
                    sender_id: currentUserId,
                    content: messageContent
                });
            if (error) {
                console.error("Failed to send message:", error);
                showToast("Failed to send message", "error");
            }
        } catch (err) {
            console.error("Send error", err);
        }
    };

    const handleEndEvent = async () => {
        Alert.alert(
            "End Event?",
            "Are you sure you want to end this event? This will mark it as finished.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "End Event", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { EventController } = await import('../../src/controllers/EventController');
                            const { EventManager } = await import('../../src/core/event/EventManager');
                            const evController = new EventController(EventManager.getInstance(), {} as any, {} as any);
                            
                            await evController.endEvent(id as string);
                            showToast("Event finished! ✨", "success");
                            router.replace('/(tabs)');
                        } catch (e: any) {
                            showToast("Failed to end event", "error");
                        }
                    } 
                }
            ]
        );
    };

    const formatEventDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    };

    const formatEventTime = (start: string, end: string) => {
        const s = new Date(start);
        const e = new Date(end);
        return `${s.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMe = item.sender_id === currentUserId;
        const senderName = isMe ? 'You' : (item.users?.full_name?.split(' ')[0] || item.sender_id?.substring(0, 5));
        return (
            <View style={[styles.messageBubble, isMe ? styles.messageSent : styles.messageRecv]}>
                {!isMe && (
                    <TouchableOpacity onPress={() => router.push('/user/' + item.sender_id)}>
                        <Text style={styles.senderId}>{senderName}</Text>
                    </TouchableOpacity>
                )}
                <Text style={[styles.messageText, isMe && { color: '#FFF' }]}>{item.content}</Text>
            </View>
        );
    };

    const categoryColor = eventDetails ? getColorForTag(eventDetails.sub_category) : '#3B82F6';

    // Loading state — show spinner until data is fetched
    if (isLoadingEvent) {
        return (
        <View style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScreenHeader 
                title="Loading event..."
                onLeftPress={() => router.back()}
            />
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ color: theme.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '600' }}>Loading event...</Text>
            </View>
        </View>
        );
    }

    // If chat is open, show chat UI
    if (showChat && hasJoined) {
        return (
        <View style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <ScreenHeader 
                    title={eventDetails?.title || 'Chat'}
                    onLeftPress={() => setShowChat(false)}
                    rightText={isHost ? "End" : undefined}
                    onRightPress={isHost ? handleEndEvent : undefined}
                />

                    {/* Participants */}
                    <View style={styles.participantsContainer}>
                        <Text style={styles.sectionLabel}>Participants ({participants.length})</Text>
                        <FlatList
                            horizontal
                            data={participants}
                            keyExtractor={(p) => p.id}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.participantItem}
                                    onPress={() => {
                                        router.push('/user/' + item.id);
                                    }}
                                >
                                    <View style={styles.pAvatar}><Text style={styles.pAvatarText}>{item.full_name?.charAt(0) || 'U'}</Text></View>
                                    <Text style={styles.pName} numberOfLines={1}>{item.full_name?.split(' ')[0]}</Text>
                                    {item.id !== currentUserId && (
                                        <TouchableOpacity style={styles.pAddBtn} onPress={() => handleAddFriend(item.id)}>
                                            <Ionicons name="person-add" size={12} color="#FFF" />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>

                    <View style={styles.chatContainer}>
                        <FlatList
                            inverted
                            data={messages}
                            keyExtractor={(item, index) => item.id || `msg-${index}`}
                            renderItem={renderMessage}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Type a message..."
                            placeholderTextColor="#7f8c8d"
                        />
                        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                            <Ionicons name="send" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        );
    }

    // Info Screen (default view)
    return (
    <View style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader 
            title="Event Details"
            onLeftPress={() => router.back()}
            rightText={isHost ? "End" : undefined}
            onRightPress={isHost ? handleEndEvent : undefined}
        />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Badge Awarding Modal removed for streamlined UX */}
                {eventDetails && (
                    <View style={styles.infoCard}>
                        {/* Category Badge */}
                        <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20', borderColor: categoryColor + '40' }]}>
                            <Text style={[styles.categoryText, { color: categoryColor }]}>{eventDetails.sub_category || 'Event'}</Text>
                        </View>

                        {/* Title */}
                        <Text style={styles.eventTitle}>{(eventDetails.title || '').replace(/^Etkinliği - /i, '')}</Text>

                        {/* Organizer */}
                        <View style={styles.organizerRow}>
                            <View style={[styles.organizerAvatar, { backgroundColor: categoryColor }]}>
                                <Text style={styles.organizerInitial}>{organizerName.charAt(0)}</Text>
                            </View>
                            <View>
                                <Text style={styles.organizerName}>{organizerName}</Text>
                                <Text style={styles.organizerLabel}>Organizer</Text>
                            </View>
                        </View>

                        {/* Detail Rows */}
                        <View style={styles.detailsSection}>
                            <View style={styles.detailRow}>
                                <View style={styles.detailIcon}>
                                    <Ionicons name="calendar" size={18} color={categoryColor} />
                                </View>
                                <Text style={styles.detailText}>{formatEventDate(eventDetails.start_time)}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <View style={styles.detailIcon}>
                                    <Ionicons name="time" size={18} color={categoryColor} />
                                </View>
                                <Text style={styles.detailText}>{formatEventTime(eventDetails.start_time, eventDetails.end_time)}</Text>
                            </View>
                             <View style={styles.detailRow}>
                                 <View style={styles.detailIcon}>
                                     <Ionicons name="people" size={18} color={categoryColor} />
                                 </View>
                                 <Text style={styles.detailText}>{participants.length} {eventDetails.max_capacity > 0 ? `/ ${eventDetails.max_capacity}` : ''} participants</Text>
                             </View>
                            {eventDetails.is_private && (
                                <View style={styles.detailRow}>
                                    <View style={styles.detailIcon}>
                                        <Ionicons name="lock-closed" size={18} color="#F59E0B" />
                                    </View>
                                    <Text style={[styles.detailText, { color: '#F59E0B' }]}>Private Event</Text>
                                </View>
                            )}
                        </View>

                        {/* Description */}
                        {eventDetails.description ? (
                            <View style={styles.descriptionBox}>
                                <Text style={styles.descriptionTitle}>About</Text>
                                <Text style={styles.descriptionText}>{eventDetails.description}</Text>
                            </View>
                        ) : null}
                    </View>
                )}

                {/* Mini Map */}
                {eventDetails?.location_lat && eventDetails?.location_lng && (
                    <View style={styles.miniMapSection}>
                        <Text style={styles.sectionLabelOutside}>Location</Text>
                        <View style={styles.miniMapContainer}>
                            <MapView
                                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                                style={styles.miniMap}
                                scrollEnabled={false}
                                zoomEnabled={false}
                                rotateEnabled={false}
                                initialRegion={{
                                    latitude: eventDetails.location_lat,
                                    longitude: eventDetails.location_lng,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }}
                            >
                                <Marker coordinate={{ latitude: eventDetails.location_lat, longitude: eventDetails.location_lng }}>
                                    <View style={[styles.miniMapMarker, { backgroundColor: categoryColor }]}>
                                        <Ionicons name="location" size={18} color="#FFF" />
                                    </View>
                                </Marker>
                            </MapView>
                        </View>
                    </View>
                )}

                {/* Participants */}
                <View style={styles.participantsSectionOutside}>
                    <Text style={styles.sectionLabelOutside}>Participants ({participants.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
                        {participants.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.participantItem}
                                onPress={() => {
                                    router.push('/user/' + item.id);
                                }}
                            >
                                <View style={styles.pAvatar}><Text style={styles.pAvatarText}>{item.full_name?.charAt(0) || 'U'}</Text></View>
                                <Text style={styles.pName} numberOfLines={1}>{item.full_name?.split(' ')[0]}</Text>
                                {item.id !== currentUserId && (
                                    <TouchableOpacity style={styles.pAddBtn} onPress={() => handleAddFriend(item.id)}>
                                        <Ionicons name="person-add" size={12} color="#FFF" />
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        ))}
                        {participants.length === 0 && (
                            <Text style={{ color: '#94A3B8', fontSize: 14, padding: 16 }}>No one has joined yet. Be the first!</Text>
                        )}
                    </ScrollView>
                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                {!hasJoined ? (
                    <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: categoryColor }]} onPress={() => handleJoinEvent()}>
                        <Ionicons name="enter" size={22} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.mainActionText}>Join Event</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => setShowChat(true)}>
                        <Ionicons name="chatbubbles" size={22} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.mainActionText}>Open Chat</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Badge Economy Modal removed for simplified UX */}

            {/* Participant Profile Modal removed globally */}
        </View>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1 },
    headerTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: 'bold', flex: 1, textAlign: 'center' },
    endBtn: { backgroundColor: theme.danger, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    endBtnText: { color: '#FFF', fontWeight: 'bold' },

    // Info Card
    infoCard: {
        margin: 16,
        backgroundColor: theme.card,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: theme.cardBorder,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    categoryText: {
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    eventTitle: {
        color: theme.textPrimary,
        fontSize: 26,
        fontWeight: '900',
        marginBottom: 20,
        lineHeight: 32,
    },
    organizerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.cardBorder,
    },
    organizerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    organizerInitial: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    organizerName: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
    organizerLabel: { color: theme.textSecondary, fontSize: 13, marginTop: 2 },
    detailsSection: { gap: 14 },
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    detailIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    detailText: { color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
    descriptionBox: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: theme.cardBorder,
    },
    descriptionTitle: { color: theme.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    descriptionText: { color: theme.textSecondary, fontSize: 15, lineHeight: 22 },

    // Mini Map
    miniMapSection: { marginHorizontal: 16, marginBottom: 16 },
    sectionLabelOutside: { color: theme.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingHorizontal: 4 },
    miniMapContainer: {
        height: 180,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.cardBorder,
    },
    miniMap: { width: '100%', height: '100%' },
    miniMapMarker: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 5,
    },

    // Participants section (outside card)
    participantsSectionOutside: {
        marginHorizontal: 16,
        marginBottom: 16,
    },

    // Bottom Action Bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.background,
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        borderTopWidth: 1,
        borderTopColor: theme.cardBorder,
    },
    mainActionBtn: {
        flexDirection: 'row',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    mainActionText: { color: '#FFF', fontSize: 18, fontWeight: '800' },

    // Chat
    chatContainer: { flex: 1, padding: 16 },
    messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },
    messageSent: { alignSelf: 'flex-end', backgroundColor: theme.primary, borderBottomRightRadius: 4 },
    messageRecv: { alignSelf: 'flex-start', backgroundColor: theme.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.cardBorder },
    senderId: { color: theme.textSecondary, fontSize: 10, marginBottom: 4, fontWeight: 'bold' },
    messageText: { color: theme.textPrimary, fontSize: 16 },

    inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.cardBorder },
    input: { flex: 1, backgroundColor: theme.card, color: theme.textPrimary, height: 44, borderRadius: 22, paddingHorizontal: 16, marginRight: 12, borderWidth: 1, borderColor: theme.cardBorder },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', backgroundColor: theme.card, borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: theme.cardBorder },
    modalTitle: { color: theme.textPrimary, fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    modalText: { color: theme.textSecondary, textAlign: 'center', marginBottom: 24 },
    badgeTarget: { color: theme.primary, fontWeight: 'bold', marginBottom: 16 },

    badgeGrid: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 32 },
    badgeBtn: { flex: 1, alignItems: 'center', backgroundColor: theme.background, marginHorizontal: 4, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.cardBorder },
    emoji: { fontSize: 32, marginBottom: 8 },
    badgeName: { color: theme.textPrimary, fontWeight: 'bold' },
    badgeSmall: { alignItems: 'center', marginHorizontal: 8, width: 70 },

    skipBtn: { paddingVertical: 12 },
    skipText: { color: theme.textSecondary, fontSize: 16, fontWeight: 'bold' },

    // Participants
    participantsContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.cardBorder
    },
    sectionLabel: {
        color: theme.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 12
    },
    participantItem: {
        alignItems: 'center',
        marginRight: 16,
        width: 60
    },
    pAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8
    },
    pAvatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 20 },
    pName: { color: theme.textPrimary, fontSize: 12, textAlign: 'center' },
    pAddBtn: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: theme.success,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.background
    }
});


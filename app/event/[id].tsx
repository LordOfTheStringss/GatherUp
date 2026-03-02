import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChatRoom } from '../../src/core/event/ChatRoom';
import { Message } from '../../src/core/event/Message';
import { useUIStore } from '../../src/store/uiStore';

export default function EventDetailScreen() {
    const { id } = useLocalSearchParams();
    const { showToast } = useUIStore();

    const [inputText, setInputText] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
    const [showBadgePopup, setShowBadgePopup] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [participants, setParticipants] = useState<any[]>([]);

    useEffect(() => {
        // 1. Initialize logic
        const fetchEventData = async () => {
            try {
                // Auth
                const { AuthManager } = await import('../../src/core/identity/AuthManager');
                const session = await AuthManager.getInstance().getCurrentUser();
                if (session) setCurrentUserId(session.id);

                // Fetch participants
                const { EventController } = await import('../../src/controllers/EventController');
                const { EventManager } = await import('../../src/core/event/EventManager');
                const evController = new EventController(EventManager.getInstance(), {} as any, {} as any);
                const pRes = await evController.getParticipants(id as string);
                if (pRes.status === 200 && pRes.data) {
                    setParticipants(pRes.data);
                }

                // Create mock chatroom
                const room = new ChatRoom(`room-${id}`);
                const mockHist: Message[] = [];
                room.messages = mockHist; // Internal mutation for UI test
                setChatRoom(room);
                setMessages([...mockHist]);
            } catch (error) {
                console.error("Failed to load event data", error);
            }
        };

        fetchEventData();
    }, [id]);

    const handleAddFriend = async (friendId: string) => {
        try {
            const { SupabaseClient } = await import('../../src/infra/SupabaseClient');
            const { error: insertErr } = await SupabaseClient.getInstance().client.from('friendships').insert({
                user_id: currentUserId,
                friend_id: friendId
            });
            if (insertErr) throw insertErr;
            showToast("Friend request sent!", "success");
        } catch (e: any) {
            showToast("Could not send request: " + e.message, "error");
        }
    };

    const sendMessage = () => {
        if (!inputText.trim() || !chatRoom || !currentUserId) return;

        // Create new message
        const newMsg = new Message(`msg-${Date.now()}`, chatRoom.roomId, currentUserId, inputText);

        setMessages(prev => [...prev, newMsg]);
        setInputText('');
    };

    const handleEndEvent = () => {
        // Show Gamification Popup
        setShowBadgePopup(true);
    };

    const awardBadge = (userId: string, badgeName: string) => {
        showToast(`Awarded ${badgeName} badge! ✨`, 'success');
        setShowBadgePopup(false);

        // Simulate navigation back home after event ends
        setTimeout(() => {
            router.replace('/(tabs)');
        }, 1500);
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.senderId === currentUserId;
        return (
            <View style={[styles.messageBubble, isMe ? styles.messageSent : styles.messageRecv]}>
                {!isMe && <Text style={styles.senderId}>{item.senderId}</Text>}
                <Text style={[styles.messageText, isMe && { color: '#FFF' }]}>{item.content}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={28} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Event Chat</Text>
                    <TouchableOpacity onPress={handleEndEvent} style={styles.endBtn}>
                        <Text style={styles.endBtnText}>End</Text>
                    </TouchableOpacity>
                </View>

                {/* Top Section - Participants (Horizontal list or small view) */}
                <View style={styles.participantsContainer}>
                    <Text style={styles.sectionTitle}>Participants ({participants.length})</Text>
                    <FlatList
                        horizontal
                        data={participants}
                        keyExtractor={(p) => p.id}
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <View style={styles.participantItem}>
                                <View style={styles.pAvatar}><Text style={styles.pAvatarText}>{item.full_name?.charAt(0) || 'U'}</Text></View>
                                <Text style={styles.pName} numberOfLines={1}>{item.full_name?.split(' ')[0]}</Text>
                                {item.id !== currentUserId && (
                                    <TouchableOpacity style={styles.pAddBtn} onPress={() => handleAddFriend(item.id)}>
                                        <Ionicons name="person-add" size={12} color="#FFF" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    />
                </View>

                {/* Chat Area */}
                <View style={styles.chatContainer}>
                    <FlatList
                        data={messages}
                        keyExtractor={(item, index) => item.id || `msg-${index}`}
                        renderItem={renderMessage}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </View>

                {/* Input Area */}
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

                {/* Badge Economy Modal */}
                <Modal visible={showBadgePopup} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Ionicons name="medal" size={64} color="#F59E0B" style={{ marginBottom: 16 }} />
                            <Text style={styles.modalTitle}>Event Finished!</Text>
                            <Text style={styles.modalText}>Award badges to participants to boost their trust score within your network.</Text>

                            <Text style={styles.badgeTarget}>Participant: user-2</Text>

                            <View style={styles.badgeGrid}>
                                <TouchableOpacity style={styles.badgeBtn} onPress={() => awardBadge('user-2', 'Punctual')}>
                                    <Text style={styles.emoji}>⏱️</Text>
                                    <Text style={styles.badgeName}>Punctual</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.badgeBtn} onPress={() => awardBadge('user-2', 'Fun')}>
                                    <Text style={styles.emoji}>🎉</Text>
                                    <Text style={styles.badgeName}>Fun</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.badgeBtn} onPress={() => awardBadge('user-2', 'Helpful')}>
                                    <Text style={styles.emoji}>🤝</Text>
                                    <Text style={styles.badgeName}>Helpful</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(tabs)')}>
                                <Text style={styles.skipText}>Skip for now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0F172A' },
    container: { flex: 1 },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: Platform.OS === 'android' ? 40 : 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    backBtn: { minHeight: 44, justifyContent: 'center' },
    headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
    endBtn: { backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    endBtnText: { color: '#FFF', fontWeight: 'bold' },

    chatContainer: { flex: 1, padding: 16 },
    messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },
    messageSent: { alignSelf: 'flex-end', backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
    messageRecv: { alignSelf: 'flex-start', backgroundColor: '#1E293B', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#334155' },
    senderId: { color: '#94A3B8', fontSize: 10, marginBottom: 4, fontWeight: 'bold' },
    messageText: { color: '#E2E8F0', fontSize: 16 },

    inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#0F172A', borderTopWidth: 1, borderTopColor: '#1E293B' },
    input: { flex: 1, backgroundColor: '#1E293B', color: '#FFF', height: 44, borderRadius: 22, paddingHorizontal: 16, marginRight: 12, borderWidth: 1, borderColor: '#334155' },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', backgroundColor: '#1E293B', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    modalTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    modalText: { color: '#94A3B8', textAlign: 'center', marginBottom: 24 },
    badgeTarget: { color: '#3B82F6', fontWeight: 'bold', marginBottom: 16 },

    badgeGrid: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 32 },
    badgeBtn: { flex: 1, alignItems: 'center', backgroundColor: '#0F172A', marginHorizontal: 4, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
    emoji: { fontSize: 32, marginBottom: 8 },
    badgeName: { color: '#E2E8F0', fontWeight: 'bold' },

    skipBtn: { paddingVertical: 12 },
    skipText: { color: '#94A3B8', fontSize: 16, fontWeight: 'bold' },

    // Participants
    participantsContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#0F172A',
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B'
    },
    sectionTitle: {
        color: '#94A3B8',
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
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8
    },
    pAvatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 20 },
    pName: { color: '#E2E8F0', fontSize: 12, textAlign: 'center' },
    pAddBtn: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#10B981',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#0F172A'
    }
});

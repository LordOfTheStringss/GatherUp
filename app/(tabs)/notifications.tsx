import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthManager } from '../../src/core/identity/AuthManager';
import { NotificationService } from '../../src/infra/NotificationService';
import { SupabaseClient } from '../../src/infra/SupabaseClient';
import { useUIStore } from '../../src/store/uiStore';
import { ThemeColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/useTheme';

export default function NotificationsScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const { showToast } = useUIStore();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadNotifications = async () => {
        try {
            setLoading(true);
            const user = await AuthManager.getInstance().getCurrentUser();
            if (!user) return;

            const supabase = SupabaseClient.getInstance().client;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data || []);

            // Mark all unread notifications as read
            const unreadIds = data?.filter((n: any) => !n.is_read).map((n: any) => n.id) || [];
            if (unreadIds.length > 0) {
                await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .in('id', unreadIds);
            }

            // Reset badge
            useUIStore.getState().setUnreadCount(0);
        } catch (error: any) {
            showToast('Failed to load notifications', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    const renderItem = ({ item }: { item: any }) => {
        const isRequest = item.type === 'friend_request';

        return (
            <View style={[styles.notificationCard, !item.is_read && { backgroundColor: theme.primaryLight + '20' }]}>
                <View style={[styles.iconContainer, !item.is_read && { backgroundColor: theme.primaryLight }]}>
                    <Ionicons
                        name={isRequest ? "person-add" : "calendar"}
                        size={24}
                        color={theme.primary}
                    />
                </View>
                <View style={styles.contentContainer}>
                    <Text style={[styles.title, !item.is_read && { fontWeight: '800' }]}>{item.title}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 28 }} />
            </View>
            <FlatList
                data={notifications}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    !loading ? <Text style={styles.emptyText}>No notifications yet.</Text> : null
                }
            />
        </SafeAreaView>
    );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 16 },
    backBtn: { minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 22, fontWeight: '800', color: theme.textPrimary, letterSpacing: 0.5 },
    listContainer: { padding: 20 },
    notificationCard: { flexDirection: 'row', backgroundColor: theme.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.cardBorder },
    iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    contentContainer: { flex: 1 },
    title: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
    body: { fontSize: 14, color: theme.textSecondary, marginBottom: 12 },
    actionsRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, flex: 1, alignItems: 'center' },
    actionText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    emptyText: { textAlign: 'center', color: theme.textSecondary, marginTop: 40, fontSize: 16 }
});

import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { LoadingOverlay } from "../src/components/ui/LoadingOverlay";
import { Toast } from "../src/components/ui/Toast";
import { AuthManager } from "../src/core/identity/AuthManager";
import { SupabaseClient } from "../src/infra/SupabaseClient";
import { useAuthStore } from "../src/store/authStore";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

function RealtimeNotifications() {
    const { sessionToken } = useAuthStore();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        if (sessionToken) {
            AuthManager.getInstance().getCurrentUser().then(u => {
                if (u) setUserId(u.id);
            });
        } else {
            setUserId(null);
        }
    }, [sessionToken]);

    useEffect(() => {
        let subscription: any;

        const setupListener = async () => {
            if (!userId) return;

            const client = SupabaseClient.getInstance().client;

            subscription = client.channel(`public:notifications:user_id=eq.${userId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                }, (payload: any) => {
                    const title = payload.new.title || 'GatherUp';
                    const body = payload.new.body || 'You have a new notification';

                    // Show local notification if app is in background or foreground
                    Notifications.scheduleNotificationAsync({
                        content: {
                            title: title,
                            body: body,
                            data: payload.new.data || {},
                        },
                        trigger: null,
                    });
                })
                .subscribe();

            // Request permissions for local notifications
            await Notifications.requestPermissionsAsync();
        };

        setupListener();

        return () => {
            if (subscription) {
                SupabaseClient.getInstance().client.removeChannel(subscription);
            }
        };
    }, [userId]);

    return null;
}

export default function RootLayout() {
    return (
        <>
            <RealtimeNotifications />
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
            <Toast />
            <LoadingOverlay />
        </>
    );
}

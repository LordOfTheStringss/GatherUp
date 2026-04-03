import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { LoadingOverlay } from "../src/components/ui/LoadingOverlay";
import { Toast } from "../src/components/ui/Toast";
import { AuthManager } from "../src/core/identity/AuthManager";
import { SupabaseClient } from "../src/infra/SupabaseClient";
import { useAuthStore } from "../src/store/authStore";
import { AuthProvider, useAuth } from "../hooks/useAuth";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
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
        <AuthProvider>
            <RootContent />
        </AuthProvider>
    );
}

function RootContent() {
    const { session, isLoading } = useAuth();

    // Shield: If we are still checking auth status, show the global loading overlay
    // This prevents any "flash" of protected content before the bouncer can kick out a banned user.
    if (isLoading) {
        return (
            <>
                <LoadingOverlay />
                <Toast />
            </>
        );
    }

    return (
        <>
            <RealtimeNotifications />
            <Stack screenOptions={{ headerShown: false }}>
                {session ? (
                    // Authenticated & Bouncer-Checked Stack
                    <Stack.Screen name="(tabs)" />
                ) : (
                    // Unauthenticated / Banned Layout
                    <Stack.Screen name="(auth)" />
                )}
            </Stack>
            <Toast />
            <LoadingOverlay />
        </>
    );
}

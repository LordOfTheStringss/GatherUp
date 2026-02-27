import { Stack } from "expo-router";
import { LoadingOverlay } from "../src/components/ui/LoadingOverlay";
import { Toast } from "../src/components/ui/Toast";

export default function RootLayout() {
    return (
        <>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
            <Toast />
            <LoadingOverlay />
        </>
    );
}

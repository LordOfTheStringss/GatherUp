import { Stack } from "expo-router";
import "react-native-get-random-values";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="interests" />
      <Stack.Screen name="plan" />
    </Stack>
  );
}

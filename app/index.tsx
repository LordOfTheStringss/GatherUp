import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/authStore";

export default function Index() {
  const { sessionToken } = useAuthStore();

  if (sessionToken) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
/*
export default function Index() {
  // DİKKAT: Test bitince burayı eski haline almayı unutma!
  // Uygulama açılır açılmaz direkt plan (Onboarding) ekranına atar.
  return <Redirect href="/(auth)/interests" />;
}
*/

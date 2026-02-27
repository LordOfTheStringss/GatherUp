import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';
// Import yolunu (tabs) klasöründen çıkacak şekilde güncelledik

export default function App() {

  // Supabase bağlantısını test etmek için basit bir fonksiyon
  const checkSupabase = async () => {
    console.log("Supabase URL:", process.env.EXPO_PUBLIC_SUPABASE_URL ? "Tanımlı" : "Eksik");
    alert("Supabase Altyapısı Hazır!");
  };

  return (
    <View style={styles.container}>
      <Text>Gather Up Projesine Hoş Geldiniz!</Text>
      <Button title="Supabase Bağlantısını Test Et" onPress={checkSupabase} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
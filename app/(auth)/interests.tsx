import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { UserController } from "../../src/controllers/UserController";
import { FriendshipManager } from "../../src/core/identity/FriendshipManager";
import { GamificationManager } from "../../src/core/identity/GamificationManager";
import { UserManager } from "../../src/core/identity/UserManager";
import { useUIStore } from "../../src/store/uiStore";

// Tema sistemi importları
import { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/useTheme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 120;

// Categorized for later use in profile, but flattened for swiping
const ALL_INTERESTS = [
  // Spor
  "Voleybol",
  "Basketbol",
  "Futbol",
  "Tenis",
  "Yüzme",
  "Koşu",
  "Yoga",
  "Pilates",
  "Fitness",
  "Kaykay",
  "Bisiklet",
  "Okçuluk",
  "Dağcılık",
  "Boks",
  "Masa Tenisi",
  // Teknoloji & Bilim
  "Yazılım",
  "Yapay Zeka",
  "Veri Bilimi",
  "Siber Güvenlik",
  "Robotik",
  "Oyun Geliştirme",
  "Blockchain",
  "Astronomi",
  "Elektronik",
  // Sanat & Kültür
  "Tiyatro",
  "Sinema",
  "Konser",
  "Dans",
  "Resim",
  "Heykel",
  "Edebiyat",
  "Fotoğrafçılık",
  "Sergi",
  "Stand-up",
  "Müzeler",
  "Opera",
  // Hobiler & Yaşam Tarzı
  "Kamp",
  "Satranç",
  "Kitap",
  "Yemek",
  "Gastronomi",
  "Oyun",
  "E-spor",
  "Bahçecilik",
  "Seyahat",
  "Yabancı Dil",
  "Koleksiyon",
  "Müzik Enstrümanı",
  // Sosyal Etkinlikler
  "Gönüllülük",
  "Networking",
  "Kariyer Günleri",
  "Workshop",
];

// Shuffle interests so it's fun
const SHUFFLED_INTERESTS = [...ALL_INTERESTS].sort(() => 0.5 - Math.random());

// DI stub
const userController = new UserController(
  UserManager.getInstance(),
  new FriendshipManager({} as any),
  new GamificationManager(),
);

export default function InterestsScreen() {
  const { showToast, setGlobalLoading } = useUIStore();
  const theme = useTheme(); // Tema Hook'u
  const styles = createStyles(theme); // Stiller temaya bağlandı

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const position = useRef(new Animated.ValueXY()).current;

  // We only force the user to swipe through a subset so they don't get bored.
  const MAX_ONBOARDING_CARDS = 15;
  const isFinished =
    currentIndex >= Math.min(SHUFFLED_INTERESTS.length, MAX_ONBOARDING_CARDS);

  // Use a ref to keep track of the latest index for the PanResponder closure
  const currentIndexRef = useRef(currentIndex);
  React.useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (event, gesture) => {
        return Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10;
      },
      onPanResponderMove: (event, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (event, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe("right");
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe("left");
        } else {
          resetPosition();
        }
      },
    }),
  ).current;

  const forceSwipe = (direction: "right" | "left") => {
    const x = direction === "right" ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = (direction: "right" | "left") => {
    if (direction === "right") {
      const currentInterest = SHUFFLED_INTERESTS[currentIndexRef.current];
      setSelectedInterests((prev) => [...prev, currentInterest]);
    }
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex((prev) => prev + 1);
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 4,
      useNativeDriver: false,
    }).start();
  };

  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: ["-30deg", "0deg", "30deg"],
    });
    return {
      ...position.getLayout(),
      transform: [{ rotate }],
    };
  };

  // Opacities for the overlaid NOPE / LIKE badges during swipe
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 4],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const saveProfile = async () => {
    setGlobalLoading(true);
    try {
      await userController.updateProfile(undefined, {
        interests: selectedInterests,
      });
      setGlobalLoading(false);
      showToast("Değerlendirmeler kaydedildi!", "success");
      router.replace("/(auth)/plan");
    } catch {
      setGlobalLoading(false);
      showToast("Kaydedilemedi.", "error");
    }
  };

  if (isFinished) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Ionicons
            name="checkmark-circle"
            size={80}
            color="#10B981"
            style={{ alignSelf: "center", marginBottom: 24 }}
          />
          <Text style={styles.titleCentred}>Harika!</Text>
          <Text style={styles.subtitleCentred}>
            {selectedInterests.length} ilgi alanı seçtin. Bunları daha sonra
            profilinden düzenleyebilirsin.
          </Text>

          <View style={styles.chipsContainer}>
            {selectedInterests.slice(0, 8).map((interest) => (
              <View key={interest} style={styles.chip}>
                <Text style={styles.chipText}>{interest}</Text>
              </View>
            ))}
            {selectedInterests.length > 8 && (
              <Text style={{ color: theme.textSecondary, alignSelf: "center" }}>
                + {selectedInterests.length - 8} daha
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.button} onPress={saveProfile}>
            <Text style={styles.buttonText}>Devam Et</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nelerden Hoşlanırsın?</Text>
        <Text style={styles.subtitle}>
          İlgi alanlarına göre etkinlikler bulalım.
        </Text>
        <Text style={styles.counter}>
          {currentIndex + 1} / {MAX_ONBOARDING_CARDS}
        </Text>
      </View>

      <View style={styles.cardContainer}>
        {/* Render the next card beneath to prevent blank flash */}
        {currentIndex + 1 < MAX_ONBOARDING_CARDS && (
          <View
            style={[
              styles.card,
              {
                position: "absolute",
                transform: [{ scale: 0.95 }],
                top: 60,
                opacity: 0.5,
              },
            ]}
          >
            <Text style={styles.cardText}>
              {SHUFFLED_INTERESTS[currentIndex + 1]}
            </Text>
          </View>
        )}

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            getCardStyle(),
            styles.card,
            { position: "absolute", top: 40 },
          ]}
        >
          <Animated.View
            style={[styles.badge, styles.likeBadge, { opacity: likeOpacity }]}
          >
            <Text style={styles.likeBadgeText}>LIKE</Text>
          </Animated.View>
          <Animated.View
            style={[styles.badge, styles.nopeBadge, { opacity: nopeOpacity }]}
          >
            <Text style={styles.nopeBadgeText}>NOPE</Text>
          </Animated.View>

          <Text style={styles.cardText}>
            {SHUFFLED_INTERESTS[currentIndex]}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.nopeButton]}
          onPress={() => forceSwipe("left")}
        >
          <Ionicons name="close" size={36} color={theme.danger || "#EF4444"} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => forceSwipe("right")}
        >
          <Ionicons name="heart" size={32} color="#10B981" />
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: "center", paddingBottom: 20 }}>
        <TouchableOpacity onPress={() => router.replace("/(auth)/plan")}>
          <Text
            style={{
              color: theme.textSecondary,
              fontSize: 16,
              fontWeight: "600",
              textDecorationLine: "underline",
            }}
          >
            Şimdilik Atla
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Stiller tamamen dinamik temaya (ThemeColors) bağlandı!
const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingTop: 60, paddingHorizontal: 20, alignItems: "center" },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: theme.textPrimary,
      letterSpacing: 0.5,
    },
    subtitle: { fontSize: 16, color: theme.textSecondary, marginTop: 8 },
    counter: {
      fontSize: 14,
      color: theme.primary,
      marginTop: 12,
      fontWeight: "700",
    },

    titleCentred: {
      fontSize: 32,
      fontWeight: "900",
      color: theme.textPrimary,
      textAlign: "center",
      marginBottom: 16,
    },
    subtitleCentred: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 24,
      paddingHorizontal: 20,
    },

    cardContainer: { flex: 1, alignItems: "center", position: "relative" },
    card: {
      width: SCREEN_WIDTH - 40,
      height: SCREEN_WIDTH,
      backgroundColor: theme.card,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.cardBorder,
      elevation: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
    },
    cardText: {
      fontSize: 36,
      fontWeight: "800",
      color: theme.textPrimary,
      textAlign: "center",
      padding: 20,
    },

    badge: {
      position: "absolute",
      top: 40,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 3,
    },
    likeBadge: {
      left: 40,
      borderColor: "#10B981",
      transform: [{ rotate: "-15deg" }],
    },
    nopeBadge: {
      right: 40,
      borderColor: theme.danger || "#EF4444",
      transform: [{ rotate: "15deg" }],
    },
    likeBadgeText: {
      color: "#10B981",
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: 2,
    },
    nopeBadgeText: {
      color: theme.danger || "#EF4444",
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: 2,
    },

    actions: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 40,
      paddingBottom: 60,
    },
    actionButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: "center",
      alignItems: "center",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    nopeButton: {
      backgroundColor: theme.card,
      borderWidth: 2,
      borderColor: theme.danger || "#EF4444",
      shadowColor: theme.danger || "#EF4444",
    },
    likeButton: {
      backgroundColor: theme.card,
      borderWidth: 2,
      borderColor: "#10B981",
      shadowColor: "#10B981",
    },

    content: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
    chipsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginVertical: 30,
      justifyContent: "center",
    },
    chip: {
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    chipText: { color: theme.textPrimary, fontWeight: "bold" },

    button: {
      backgroundColor: theme.primary,
      height: 60,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    buttonText: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
  });

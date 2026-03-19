import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useUIStore } from "../../src/store/uiStore";
import { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/useTheme";

const { width, height } = Dimensions.get("window");

// DİKKAT: 54 MADDELİK TAM LİSTE (İNGİLİZCE)
const CARDS = [
  // SPORTS
  {
    id: "1",
    title: "Volleyball",
    category: "Sports",
    icon: "fitness",
    color: "#3B82F6",
  },
  {
    id: "2",
    title: "Basketball",
    category: "Sports",
    icon: "basketball",
    color: "#3B82F6",
  },
  {
    id: "3",
    title: "Football",
    category: "Sports",
    icon: "football",
    color: "#3B82F6",
  },
  {
    id: "4",
    title: "Tennis",
    category: "Sports",
    icon: "tennisball",
    color: "#3B82F6",
  },
  {
    id: "5",
    title: "Swimming",
    category: "Sports",
    icon: "water",
    color: "#3B82F6",
  },
  {
    id: "6",
    title: "Running",
    category: "Sports",
    icon: "walk",
    color: "#3B82F6",
  },
  {
    id: "7",
    title: "Yoga",
    category: "Sports",
    icon: "body",
    color: "#3B82F6",
  },
  {
    id: "8",
    title: "Pilates",
    category: "Sports",
    icon: "body-outline",
    color: "#3B82F6",
  },
  {
    id: "9",
    title: "Fitness",
    category: "Sports",
    icon: "barbell",
    color: "#3B82F6",
  },
  {
    id: "10",
    title: "Skateboarding",
    category: "Sports",
    icon: "bicycle",
    color: "#3B82F6",
  },
  {
    id: "11",
    title: "Cycling",
    category: "Sports",
    icon: "bicycle",
    color: "#3B82F6",
  },
  {
    id: "12",
    title: "Archery",
    category: "Sports",
    icon: "navigate",
    color: "#3B82F6",
  },
  {
    id: "13",
    title: "Mountaineering",
    category: "Sports",
    icon: "image",
    color: "#3B82F6",
  },
  {
    id: "14",
    title: "Boxing",
    category: "Sports",
    icon: "hand-left",
    color: "#3B82F6",
  },
  {
    id: "15",
    title: "Table Tennis",
    category: "Sports",
    icon: "tennisball-outline",
    color: "#3B82F6",
  },

  // TECH & SCIENCE
  {
    id: "16",
    title: "Software",
    category: "Tech & Science",
    icon: "code-slash",
    color: "#8B5CF6",
  },
  {
    id: "17",
    title: "AI",
    category: "Tech & Science",
    icon: "hardware-chip",
    color: "#8B5CF6",
  },
  {
    id: "18",
    title: "Data Science",
    category: "Tech & Science",
    icon: "bar-chart",
    color: "#8B5CF6",
  },
  {
    id: "19",
    title: "Cyber Security",
    category: "Tech & Science",
    icon: "shield-checkmark",
    color: "#8B5CF6",
  },
  {
    id: "20",
    title: "Robotics",
    category: "Tech & Science",
    icon: "cog",
    color: "#8B5CF6",
  },
  {
    id: "21",
    title: "Game Dev",
    category: "Tech & Science",
    icon: "game-controller",
    color: "#8B5CF6",
  },
  {
    id: "22",
    title: "Blockchain",
    category: "Tech & Science",
    icon: "link",
    color: "#8B5CF6",
  },
  {
    id: "23",
    title: "Astronomy",
    category: "Tech & Science",
    icon: "planet",
    color: "#8B5CF6",
  },
  {
    id: "24",
    title: "Electronics",
    category: "Tech & Science",
    icon: "bulb",
    color: "#8B5CF6",
  },

  // ARTS & CULTURE
  {
    id: "25",
    title: "Theater",
    category: "Arts & Culture",
    icon: "color-palette",
    color: "#EC4899",
  },
  {
    id: "26",
    title: "Cinema",
    category: "Arts & Culture",
    icon: "film",
    color: "#EC4899",
  },
  {
    id: "27",
    title: "Concerts",
    category: "Arts & Culture",
    icon: "musical-notes",
    color: "#EC4899",
  },
  {
    id: "28",
    title: "Dance",
    category: "Arts & Culture",
    icon: "body",
    color: "#EC4899",
  },
  {
    id: "29",
    title: "Painting",
    category: "Arts & Culture",
    icon: "brush",
    color: "#EC4899",
  },
  {
    id: "30",
    title: "Sculpture",
    category: "Arts & Culture",
    icon: "hammer",
    color: "#EC4899",
  },
  {
    id: "31",
    title: "Literature",
    category: "Arts & Culture",
    icon: "book",
    color: "#EC4899",
  },
  {
    id: "32",
    title: "Photography",
    category: "Arts & Culture",
    icon: "camera",
    color: "#EC4899",
  },
  {
    id: "33",
    title: "Exhibitions",
    category: "Arts & Culture",
    icon: "images",
    color: "#EC4899",
  },
  {
    id: "34",
    title: "Stand-up",
    category: "Arts & Culture",
    icon: "mic",
    color: "#EC4899",
  },
  {
    id: "35",
    title: "Museums",
    category: "Arts & Culture",
    icon: "business",
    color: "#EC4899",
  },
  {
    id: "36",
    title: "Opera",
    category: "Arts & Culture",
    icon: "musical-notes-outline",
    color: "#EC4899",
  },

  // HOBBIES & LIFESTYLE (Mor Renk)
  {
    id: "37",
    title: "Camping",
    category: "Hobbies",
    icon: "leaf",
    color: "#8910b9",
  },
  {
    id: "38",
    title: "Chess",
    category: "Hobbies",
    icon: "extension-puzzle",
    color: "#8910b9",
  },
  {
    id: "39",
    title: "Reading",
    category: "Hobbies",
    icon: "book-outline",
    color: "#8910b9",
  },
  {
    id: "40",
    title: "Cooking",
    category: "Hobbies",
    icon: "restaurant",
    color: "#8910b9",
  },
  {
    id: "41",
    title: "Gastronomy",
    category: "Hobbies",
    icon: "fast-food",
    color: "#8910b9",
  },
  {
    id: "42",
    title: "E-sports",
    category: "Hobbies",
    icon: "headset",
    color: "#8910b9",
  },
  {
    id: "43",
    title: "Gardening",
    category: "Hobbies",
    icon: "flower",
    color: "#8910b9",
  },
  {
    id: "44",
    title: "Traveling",
    category: "Hobbies",
    icon: "airplane",
    color: "#8910b9",
  },
  {
    id: "45",
    title: "Languages",
    category: "Hobbies",
    icon: "language",
    color: "#8910b9",
  },
  {
    id: "46",
    title: "Collecting",
    category: "Hobbies",
    icon: "albums",
    color: "#8910b9",
  },
  {
    id: "47",
    title: "Guitar",
    category: "Hobbies",
    icon: "musical-note",
    color: "#8910b9",
  },
  {
    id: "48",
    title: "Piano",
    category: "Hobbies",
    icon: "musical-note",
    color: "#8910b9",
  },
  {
    id: "49",
    title: "Violin",
    category: "Hobbies",
    icon: "musical-note",
    color: "#8910b9",
  },

  // SOCIAL
  {
    id: "50",
    title: "Volunteering",
    category: "Social",
    icon: "heart-half",
    color: "#10B981",
  },
  {
    id: "51",
    title: "Networking",
    category: "Social",
    icon: "chatbubbles",
    color: "#10B981",
  },
  {
    id: "52",
    title: "Career Fairs",
    category: "Social",
    icon: "briefcase",
    color: "#10B981",
  },
  {
    id: "53",
    title: "Workshops",
    category: "Social",
    icon: "construct",
    color: "#10B981",
  },
  {
    id: "54",
    title: "Board Games",
    category: "Social",
    icon: "dice",
    color: "#10B981",
  },
];

// Kartları rastgele karıştırmak istersen (isteğe bağlı)
const SHUFFLED_CARDS = CARDS.sort(() => Math.random() - 0.5);

const PROGRESS_COLORS = ["#E11D48", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];

export default function InterestsScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { showToast, setGlobalLoading } = useUIStore();

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  const position = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 120) {
          forceSwipe("right");
        } else if (gestureState.dx < -120) {
          forceSwipe("left");
        } else {
          resetPosition();
        }
      },
    }),
  ).current;

  const forceSwipe = (direction: "right" | "left") => {
    const x = direction === "right" ? width + 100 : -width - 100;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = (direction: "right" | "left") => {
    const activeIndex = currentIndexRef.current;
    const item = SHUFFLED_CARDS[activeIndex]; // Karışık listeyi kullanıyoruz

    if (direction === "right" && item) {
      setSelectedInterests((prev) => {
        if (!prev.includes(item.title)) {
          return [...prev, item.title];
        }
        return prev;
      });
    }

    position.setValue({ x: 0, y: 0 });
    currentIndexRef.current += 1;
    setCurrentIndex(currentIndexRef.current);
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 4,
      useNativeDriver: false,
    }).start();
  };

  const swipeLeft = () => forceSwipe("left");
  const swipeRight = () => forceSwipe("right");

  const handleContinue = async () => {
    if (selectedInterests.length < 5) {
      showToast("Please swipe right on at least 5 items!", "error");
      return;
    }

    setGlobalLoading(true);
    try {
      const { UserController } =
        await import("../../src/controllers/UserController");
      const { UserManager } =
        await import("../../src/core/identity/UserManager");
      const controller = new UserController(
        UserManager.getInstance(),
        {} as any,
        {} as any,
      );

      await controller.updateProfile(undefined, {
        interests: selectedInterests,
      });

      showToast("Interests saved!", "success");
      router.replace("/(auth)/plan");
    } catch (e) {
      showToast("Failed to save interests.", "error");
    } finally {
      setGlobalLoading(false);
    }
  };

  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ["-10deg", "0deg", "10deg"],
    extrapolate: "clamp",
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, width / 4],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-width / 4, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const renderCards = () => {
    if (currentIndex >= SHUFFLED_CARDS.length) {
      return (
        <View style={styles.noMoreCards}>
          <Text style={styles.noMoreTitle}>All caught up!</Text>
          <Text style={styles.noMoreText}>
            You have reviewed all {SHUFFLED_CARDS.length} interests.
          </Text>
        </View>
      );
    }

    return SHUFFLED_CARDS.map((item, i) => {
      if (i < currentIndex) return null;

      if (i === currentIndex) {
        return (
          <Animated.View
            key={item.id}
            style={[
              styles.cardStyle,
              {
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate: rotate },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Animated.View
              style={[
                styles.stampContainer,
                styles.likeStamp,
                { opacity: likeOpacity },
              ]}
            >
              <Text style={styles.likeText}>LIKE</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.stampContainer,
                styles.nopeStamp,
                { opacity: nopeOpacity },
              ]}
            >
              <Text style={styles.nopeText}>NOPE</Text>
            </Animated.View>

            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: item.color + "20" },
              ]}
            >
              <Ionicons name={item.icon as any} size={80} color={item.color} />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardCategory}>{item.category}</Text>
          </Animated.View>
        );
      }

      return (
        <Animated.View
          key={item.id}
          style={[styles.cardStyle, { top: 10, transform: [{ scale: 0.95 }] }]}
        >
          <View
            style={[styles.cardIconBox, { backgroundColor: item.color + "20" }]}
          >
            <Ionicons name={item.icon as any} size={80} color={item.color} />
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardCategory}>{item.category}</Text>
        </Animated.View>
      );
    }).reverse();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>What do you like?</Text>
        <Text style={styles.subtitle}>
          Swipe Right ❤️ if you like it, Left ❌ to pass.
        </Text>

        <View style={styles.progressRow}>
          <View style={styles.progressContainer}>
            {[0, 1, 2, 3, 4].map((index) => {
              const isFilled = selectedInterests.length > index;
              return (
                <View
                  key={`bubble-${index}`}
                  style={[
                    styles.bubble,
                    isFilled
                      ? {
                          backgroundColor: PROGRESS_COLORS[index],
                          borderColor: PROGRESS_COLORS[index],
                        }
                      : {},
                  ]}
                >
                  {isFilled && (
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  )}
                </View>
              );
            })}
          </View>
          <Text style={styles.counterText}>
            {selectedInterests.length} selected
          </Text>
        </View>
      </View>

      <View style={styles.cardsContainer}>{renderCards()}</View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.passBtn}
          onPress={swipeLeft}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={32} color="#EF4444" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.likeBtn}
          onPress={swipeRight}
          activeOpacity={0.7}
        >
          <Ionicons name="heart" size={32} color="#10B981" />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueBtn,
            selectedInterests.length < 5 && styles.continueBtnDisabled,
          ]}
          onPress={handleContinue}
          activeOpacity={selectedInterests.length < 5 ? 1 : 0.8}
        >
          <Text style={styles.continueBtnText}>
            {selectedInterests.length < 5
              ? `Swipe ${5 - selectedInterests.length} more`
              : "Continue"}
          </Text>
          {selectedInterests.length >= 5 && (
            <Ionicons
              name="arrow-forward"
              size={20}
              color="#FFF"
              style={{ marginLeft: 8 }}
            />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    header: {
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 10,
      zIndex: 10,
    },
    title: {
      fontSize: 32,
      fontWeight: "900",
      color: theme.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      marginBottom: 20,
      lineHeight: 22,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    progressContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
    bubble: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: theme.cardBorder,
      backgroundColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
    },
    counterText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "bold",
    },
    cardsContainer: { flex: 1, alignItems: "center", marginTop: 20, zIndex: 1 },
    cardStyle: {
      width: width * 0.85,
      height: height * 0.45,
      backgroundColor: theme.card,
      borderRadius: 24,
      position: "absolute",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 8,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      padding: 20,
    },
    cardIconBox: {
      width: 140,
      height: 140,
      borderRadius: 70,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
    },
    cardTitle: {
      fontSize: 32,
      fontWeight: "900",
      color: theme.textPrimary,
      marginBottom: 8,
      textAlign: "center",
    },
    cardCategory: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    stampContainer: {
      position: "absolute",
      top: 40,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 4,
      transform: [{ rotate: "-20deg" }],
      zIndex: 10,
    },
    likeStamp: { left: 40, borderColor: "#10B981" },
    nopeStamp: {
      right: 40,
      borderColor: "#EF4444",
      transform: [{ rotate: "20deg" }],
    },
    likeText: {
      color: "#10B981",
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: 2,
    },
    nopeText: {
      color: "#EF4444",
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: 2,
    },
    noMoreCards: { flex: 1, justifyContent: "center", alignItems: "center" },
    noMoreTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.textPrimary,
      marginBottom: 8,
    },
    noMoreText: { fontSize: 15, color: theme.textSecondary },
    actionButtons: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 30,
      marginBottom: 120,
      zIndex: 10,
    },
    passBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#EF4444",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.3)",
    },
    likeBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#10B981",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
      borderWidth: 1,
      borderColor: "rgba(16, 185, 129, 0.3)",
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 24,
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.cardBorder,
      zIndex: 20,
    },
    continueBtn: {
      backgroundColor: theme.primary,
      flexDirection: "row",
      height: 56,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    continueBtnDisabled: { backgroundColor: theme.cardBorder },
    continueBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  });

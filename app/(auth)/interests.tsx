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
import { INTEREST_TAGS } from "../../src/data/interestTags";

const { width, height } = Dimensions.get("window");

const CARDS = INTEREST_TAGS;

// Shuffle cards
const SHUFFLED_CARDS = [...CARDS].sort(() => Math.random() - 0.5);

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
      const controller = new UserController();

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
    likeStamp: { left: 40, borderColor: theme.success },
    nopeStamp: {
      right: 40,
      borderColor: theme.danger,
      transform: [{ rotate: "20deg" }],
    },
    likeText: {
      color: theme.success,
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: 2,
    },
    nopeText: {
      color: theme.danger,
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
      shadowColor: theme.danger,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
      borderWidth: 1,
      borderColor: theme.danger + "4D", // 30% alpha
    },
    likeBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
      borderWidth: 1,
      borderColor: theme.success + "4D", // 30% alpha
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

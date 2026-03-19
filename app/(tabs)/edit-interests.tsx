import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useUIStore } from "../../src/store/uiStore";
import { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/useTheme";

// DİKKAT: 54 MADDELİK TAM LİSTE BURAYA DA EKLENDİ!
const INTEREST_CATEGORIES = [
  {
    title: "Sports",
    icon: "fitness",
    items: [
      "Volleyball",
      "Basketball",
      "Football",
      "Tennis",
      "Swimming",
      "Running",
      "Yoga",
      "Pilates",
      "Fitness",
      "Skateboarding",
      "Cycling",
      "Archery",
      "Mountaineering",
      "Boxing",
      "Table Tennis",
    ],
  },
  {
    title: "Tech & Science",
    icon: "flask",
    items: [
      "Software",
      "AI",
      "Data Science",
      "Cyber Security",
      "Robotics",
      "Game Dev",
      "Blockchain",
      "Astronomy",
      "Electronics",
    ],
  },
  {
    title: "Arts & Culture",
    icon: "color-palette",
    items: [
      "Theater",
      "Cinema",
      "Concerts",
      "Dance",
      "Painting",
      "Sculpture",
      "Literature",
      "Photography",
      "Exhibitions",
      "Stand-up",
      "Museums",
      "Opera",
    ],
  },
  {
    title: "Hobbies & Lifestyle",
    icon: "camera",
    items: [
      "Camping",
      "Chess",
      "Reading",
      "Cooking",
      "Gastronomy",
      "E-sports",
      "Gardening",
      "Traveling",
      "Languages",
      "Collecting",
      "Guitar",
      "Piano",
      "Violin",
    ],
  },
  {
    title: "Social Events",
    icon: "people",
    items: [
      "Volunteering",
      "Networking",
      "Career Fairs",
      "Workshops",
      "Board Games",
    ],
  },
];

export default function EditInterestsScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { showToast, setGlobalLoading } = useUIStore();

  const [selected, setSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // DİKKAT: ÇÖKME HATASI GİDERİLDİ (FriendshipManager eklendi)
  useFocusEffect(
    useCallback(() => {
      const loadInterests = async () => {
        setIsLoading(true);
        try {
          const { UserController } =
            await import("../../src/controllers/UserController");
          const { UserManager } =
            await import("../../src/core/identity/UserManager");
          const { FriendshipManager } =
            await import("../../src/core/identity/FriendshipManager");

          const controller = new UserController(
            UserManager.getInstance(),
            new FriendshipManager({} as any),
            {} as any,
          );
          const res = await controller.getMyProfile();

          if (res.status === 200 && res.data?.interests) {
            setSelected(res.data.interests);
          }
        } catch (e) {
          console.error("Failed to load interests:", e);
        } finally {
          setIsLoading(false);
        }
      };
      loadInterests();
    }, []),
  );

  const toggleInterest = (item: string) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  const handleSave = async () => {
    setGlobalLoading(true);
    try {
      const { UserController } =
        await import("../../src/controllers/UserController");
      const { UserManager } =
        await import("../../src/core/identity/UserManager");
      const { FriendshipManager } =
        await import("../../src/core/identity/FriendshipManager");

      const controller = new UserController(
        UserManager.getInstance(),
        new FriendshipManager({} as any),
        {} as any,
      );

      await controller.updateProfile(undefined, { interests: selected });
      showToast("Interests updated!", "success");

      router.replace("/profile");
    } catch (e) {
      showToast("Failed to save.", "error");
    } finally {
      setGlobalLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace("/profile")}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Interests</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.topBar}>
        <Text style={styles.subtitle}>Selected: {selected.length}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {INTEREST_CATEGORIES.map((category) => (
          <View key={category.title} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Ionicons
                name={category.icon as any}
                size={20}
                color={theme.textPrimary}
              />
              <Text style={styles.categoryTitle}>{category.title}</Text>
            </View>
            <View style={styles.chipsContainer}>
              {category.items.map((item) => {
                const isSelected = selected.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.chip,
                      isSelected && {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                      },
                    ]}
                    onPress={() => toggleInterest(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.chipText, isSelected && { color: "#FFF" }]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 16,
    },
    backBtn: { minHeight: 44, justifyContent: "center" },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.textPrimary,
      letterSpacing: 0.5,
    },

    topBar: { paddingHorizontal: 24, paddingBottom: 16 },
    subtitle: { fontSize: 14, color: theme.textSecondary, fontWeight: "600" },

    scrollView: { flex: 1, paddingHorizontal: 20 },
    categorySection: { marginBottom: 32 },
    categoryHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      gap: 8,
    },
    categoryTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.textPrimary,
    },
    chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.card,
    },
    chipText: { fontSize: 14, fontWeight: "600", color: theme.textPrimary },

    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 24,
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.cardBorder,
    },
    saveBtn: {
      backgroundColor: theme.primary,
      flexDirection: "row",
      height: 56,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  });

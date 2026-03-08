import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { PanicButton } from "../../src/components/ui/PanicButton";
import { useAuthStore } from "../../src/store/authStore";
import { useUIStore } from "../../src/store/uiStore";
import { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/useTheme";

const DAYS = [
  { label: "Pzt", index: 1 },
  { label: "Sal", index: 2 },
  { label: "Çar", index: 3 },
  { label: "Per", index: 4 },
  { label: "Cum", index: 5 },
  { label: "Cmt", index: 6 },
  { label: "Paz", index: 0 },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08:00 - 23:00

export default function ProfileScreen() {
  const { logout, userEmail } = useAuthStore();
  const { showToast, setGlobalLoading, themePreference, setThemePreference } =
    useUIStore();
  const theme = useTheme();
  const styles = createStyles(theme);

  // Stats & States
  const [isAvailable, setIsAvailable] = useState(true);
  const [stats, setStats] = useState({
    eventsAttended: 0,
    eventsHosted: 0,
    trustedCircleCount: 0,
    reputationScore: 0,
  });
  const [friendsModalVisible, setFriendsModalVisible] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [newFriendUsername, setNewFriendUsername] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchProfileData = async () => {
        setIsLoading(true);
        try {
          const { UserController } =
            await import("../../src/controllers/UserController");
          const { UserManager } =
            await import("../../src/core/identity/UserManager");
          const { FriendshipManager } =
            await import("../../src/core/identity/FriendshipManager");

          const userController = new UserController(
            UserManager.getInstance(),
            new FriendshipManager({} as any),
            {} as any,
          );
          const res = await userController.getMyProfile();

          if (res.status === 200 && res.data) {
            setUsername(res.data.fullName || null);
            setInterests(res.data.interests || []);
            if (res.data.stats) {
              setStats({
                eventsAttended: res.data.stats.eventsAttended,
                eventsHosted: res.data.stats.eventsHosted,
                trustedCircleCount: res.data.stats.trustedCircleCount,
                reputationScore: res.data.xp || 0,
              });
            }
          }

          const { ScheduleController } =
            await import("../../src/controllers/ScheduleController");
          const { ScheduleManager } =
            await import("../../src/core/schedule/ScheduleManager");
          const { OCRProcessor } =
            await import("../../src/core/schedule/OCRProcessor");

          const scheduleController = new ScheduleController(
            new ScheduleManager(),
            new OCRProcessor(),
          );
          const scheduleRes = await scheduleController.getMySchedule(
            new Date(),
          );

          if (scheduleRes.status === 200 && scheduleRes.data?.busyBlocks) {
            setSchedule(scheduleRes.data.busyBlocks);
          } else {
            setSchedule([]);
          }
        } catch (e) {
          console.error("Profile load err", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchProfileData();
    }, [activeTab]),
  );

  const getSlotForHour = (hourInt: number) => {
    return schedule.find((s: any) => {
      if (s.startTime && typeof s.startTime.getDay === "function") {
        return (
          s.startTime.getDay() === activeTab &&
          s.startTime.getHours() <= hourInt &&
          s.endTime.getHours() > hourInt
        );
      }
      return false;
    });
  };

  const loadFriends = async () => {
    try {
      setGlobalLoading(true);
      const { AuthManager } =
        await import("../../src/core/identity/AuthManager");
      const { FriendshipManager } =
        await import("../../src/core/identity/FriendshipManager");
      const sessionData = await AuthManager.getInstance().getCurrentUser();
      if (!sessionData) throw new Error("Not auth");
      const fm = new FriendshipManager({} as any);
      const circle = await fm.getTrustedCircle(sessionData.id);
      const requests = await fm.getPendingRequests(sessionData.id);
      setFriends(circle);
      setPendingRequests(requests);
      setFriendsModalVisible(true);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setGlobalLoading(true);
          try {
            await logout();
            router.replace("/(auth)/login");
          } catch {
            showToast("Logout failed", "error");
          } finally {
            setGlobalLoading(false);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.safeArea,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
            </Text>
            <View style={styles.badgeIcon}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </View>
          </View>
          <Text style={styles.userName}>{username || "USER"}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
          <View style={styles.reputationBadge}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.reputationText}>
              {stats.reputationScore} Trust Score
            </Text>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.eventsAttended}</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </View>
          <View style={styles.statBorder} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.eventsHosted}</Text>
            <Text style={styles.statLabel}>Hosted</Text>
          </View>
          <View style={styles.statBorder} />
          <TouchableOpacity style={styles.statBox} onPress={loadFriends}>
            <Text style={styles.statValue}>{stats.trustedCircleCount}</Text>
            <Text style={[styles.statLabel, { color: theme.primary }]}>
              Friends
            </Text>
          </TouchableOpacity>
        </View>

        {/* Showcase: Interests */}
        <View style={styles.showcaseSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.showcaseTitle}>İlgi Alanlarım</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/edit-interests")}
            >
              <Ionicons name="pencil" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.chipsContainer}>
            {interests.map((it, idx) => (
              <View key={`interest-${idx}`} style={styles.chip}>
                <Text style={styles.chipText}>{it}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Showcase: Weekly Schedule */}
        <View style={[styles.showcaseSection, { paddingBottom: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.showcaseTitle}>Haftalık Programım</Text>
            <TouchableOpacity
              style={styles.editScheduleBtn}
              onPress={() => router.push("/(auth)/plan")}
            >
              <Ionicons name="create-outline" size={14} color="#FFF" />
              <Text style={styles.editScheduleText}>Düzenle</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tabsContainer}>
            {DAYS.map((d) => (
              <TouchableOpacity
                key={d.label}
                style={[styles.tab, activeTab === d.index && styles.activeTab]}
                onPress={() => setActiveTab(d.index)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === d.index && styles.activeTabText,
                  ]}
                >
                  {d.label}
                </Text>
                {activeTab === d.index && (
                  <View style={styles.activeTabIndicator} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.timelineContainer}>
            {HOURS.map((h) => {
              const slot = getSlotForHour(h);
              if (!slot) return null;
              const isM = slot.metadata?.type === "Müsait";
              return (
                <View style={styles.timelineRow} key={`hour-${h}`}>
                  <Text style={styles.timeLabel}>
                    {h.toString().padStart(2, "0")}:00
                  </Text>
                  <View style={styles.slotArea}>
                    <View
                      style={[
                        styles.scheduleCard,
                        isM
                          ? styles.cardMusait
                          : {
                              backgroundColor:
                                slot.metadata?.color || theme.primary,
                            },
                      ]}
                    >
                      <Ionicons
                        name={isM ? "checkmark-circle" : "book"}
                        size={20}
                        color={isM ? "#10B981" : "#FFF"}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.cardType,
                            isM ? { color: "#10B981" } : { color: "#FFF" },
                          ]}
                        >
                          {slot.metadata?.type || "Etkinlik"}
                        </Text>
                        {!isM && (
                          <Text style={{ color: "#FFF", fontSize: 13 }}>
                            {slot.metadata?.title}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Account Setup</Text>
          <PanicButton />
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push("/(tabs)/edit-profile")}
          >
            <Ionicons name="person-outline" size={22} color={theme.primary} />
            <Text style={styles.actionText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={[styles.actionText, { color: "#EF4444" }]}>
              Log Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Friends Modal */}
      {friendsModalVisible && (
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
            onPress={() => setFriendsModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Friends</Text>
              <TouchableOpacity onPress={() => setFriendsModalVisible(false)}>
                <Ionicons name="close" size={28} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView>{/* Friend List Mapping Here */}</ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { paddingBottom: 40 },
    header: { alignItems: "center", paddingTop: 40, paddingBottom: 32 },
    avatarContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    avatarText: { fontSize: 40, fontWeight: "800", color: "#FFF" },
    badgeIcon: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 2,
    },
    userName: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.textPrimary,
      marginBottom: 4,
    },
    userEmail: { fontSize: 15, color: theme.textSecondary, marginBottom: 16 },
    reputationBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(245, 158, 11, 0.15)",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    reputationText: { color: "#F59E0B", fontWeight: "700", marginLeft: 8 },
    statsContainer: {
      flexDirection: "row",
      backgroundColor: theme.card,
      marginHorizontal: 20,
      borderRadius: 20,
      paddingVertical: 20,
      marginBottom: 24,
    },
    statBox: { flex: 1, alignItems: "center" },
    statBorder: { width: 1, backgroundColor: theme.cardBorder },
    statValue: { fontSize: 24, fontWeight: "900", color: theme.textPrimary },
    statLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: "600" },
    availabilityContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.card,
      marginHorizontal: 20,
      borderRadius: 20,
      padding: 20,
      marginBottom: 32,
    },
    availabilityInfo: { flex: 1 },
    availabilityTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.textPrimary,
    },
    availabilityDesc: { fontSize: 13, color: theme.textSecondary },
    availabilityToggle: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 24,
    },
    toggleAvailable: { backgroundColor: "rgba(16, 185, 129, 0.1)" },
    toggleBusy: { backgroundColor: theme.dangerBg },
    toggleKnobWrapper: { marginRight: 8 },
    toggleKnob: { width: 8, height: 8, borderRadius: 4 },
    knobAvailable: { backgroundColor: "#10B981" },
    knobBusy: { backgroundColor: theme.danger },
    toggleText: { fontSize: 14, fontWeight: "800" },
    textAvailable: { color: "#10B981" },
    textBusy: { color: theme.danger },
    showcaseSection: { paddingHorizontal: 24, marginBottom: 20 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    showcaseTitle: {
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: "800",
    },
    chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    chip: {
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    chipText: { color: theme.textPrimary, fontWeight: "600", fontSize: 14 },
    addChip: {
      backgroundColor: "transparent",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderStyle: "dashed",
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    editScheduleBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    editScheduleText: {
      color: "#FFF",
      fontSize: 12,
      fontWeight: "bold",
      marginLeft: 4,
    },
    tabsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
      paddingBottom: 10,
    },
    tab: { alignItems: "center", paddingVertical: 8, width: 40 },
    activeTab: {},
    tabText: { color: theme.textSecondary, fontSize: 14 },
    activeTabText: { color: theme.primary, fontWeight: "bold" },
    activeTabIndicator: {
      width: 24,
      height: 4,
      backgroundColor: theme.primary,
      borderRadius: 2,
      position: "absolute",
      bottom: -10,
    },
    timelineContainer: { paddingTop: 20 },
    timelineRow: { flexDirection: "row", marginBottom: 12, minHeight: 70 },
    timeLabel: {
      width: 50,
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "bold",
      marginTop: 15,
    },
    slotArea: { flex: 1, marginLeft: 10 },
    scheduleCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      borderRadius: 16,
      minHeight: 75,
    },
    cardType: { fontSize: 14, fontWeight: "bold" },
    cardMusait: {
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#10B981",
      borderStyle: "dashed",
    },
    actionsContainer: { paddingHorizontal: 20 },
    sectionTitle: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: "800",
      marginBottom: 16,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      marginBottom: 12,
    },
    actionText: {
      flex: 1,
      fontSize: 16,
      color: theme.textPrimary,
      fontWeight: "600",
      marginLeft: 12,
    },
    modalContent: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.background,
      height: "80%",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    modalTitle: { fontSize: 22, fontWeight: "800", color: theme.textPrimary },
  });

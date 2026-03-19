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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars"; // TAKVİM GERİ GELDİ!
import { PanicButton } from "../../src/components/ui/PanicButton";
import { useAuthStore } from "../../src/store/authStore";
import { useUIStore } from "../../src/store/uiStore";
import { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/useTheme";

// TAKVİM İNGİLİZCE (Varsayılan olarak İngilizce ama emin olmak için)
LocaleConfig.locales["en"] = {
  monthNames: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  monthNamesShort: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  dayNames: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  today: "Today",
};
LocaleConfig.defaultLocale = "en";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08:00 - 23:00

// Tarihten gün indeksini (0-6) güvenli alan fonksiyon
const getDayIndexFromDateString = (dateString: string) => {
  const [year, month, day] = dateString.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.getDay();
};

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
  const [schedule, setSchedule] = useState<any[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // TAKVİM İÇİN SEÇİLİ GÜN STATE'İ
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const activeDayIndex = getDayIndexFromDateString(selectedDate);

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
    }, []),
  );

  const getSlotForHour = (hourInt: number) => {
    return schedule.find((s: any) => {
      if (!s.startTime) return false;
      const st = new Date(s.startTime);
      const et = new Date(s.endTime);
      return (
        st.getDay() === activeDayIndex &&
        st.getHours() <= hourInt &&
        et.getHours() > hourInt
      );
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

  const handleSendRequest = async () => {
    if (!newFriendUsername.trim()) return;
    try {
      const { SupabaseClient } = await import("../../src/infra/SupabaseClient");
      const { AuthManager } =
        await import("../../src/core/identity/AuthManager");
      const sClient = SupabaseClient.getInstance().client;
      const userSession = await AuthManager.getInstance().getCurrentUser();
      const { data, error } = await sClient
        .from("users")
        .select("id")
        .or(
          `full_name.ilike.%${newFriendUsername}%,email.ilike.%${newFriendUsername}%`,
        )
        .single();
      if (error || !data) {
        showToast("User not found!", "error");
        return;
      }
      const { error: insertErr } = await sClient
        .from("friendships")
        .insert({ user_id: userSession.id, friend_id: data.id });
      if (insertErr) throw new Error(insertErr.message);
      showToast("Friend request sent!", "success");
      setNewFriendUsername("");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleAccept = async (friendId: string) => {
    try {
      const { AuthManager } =
        await import("../../src/core/identity/AuthManager");
      const { FriendshipManager } =
        await import("../../src/core/identity/FriendshipManager");
      const session = await AuthManager.getInstance().getCurrentUser();
      const fm = new FriendshipManager({} as any);
      await fm.acceptRequest(session.id, friendId);
      showToast("Request accepted!", "success");
      loadFriends();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleReject = async (friendId: string) => {
    try {
      const { AuthManager } =
        await import("../../src/core/identity/AuthManager");
      const { FriendshipManager } =
        await import("../../src/core/identity/FriendshipManager");
      const session = await AuthManager.getInstance().getCurrentUser();
      const fm = new FriendshipManager({} as any);
      await fm.rejectRequest(session.id, friendId);
      showToast("Request rejected!", "success");
      loadFriends();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
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

        {/* Availability Toggle */}
        <View style={styles.availabilityContainer}>
          <View style={styles.availabilityInfo}>
            <Text style={styles.availabilityTitle}>Current Status</Text>
            <Text style={styles.availabilityDesc}>
              {isAvailable
                ? "AI can suggest events for you."
                : "Hidden mode. AI won't suggest events."}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.availabilityToggle,
              isAvailable ? styles.toggleAvailable : styles.toggleBusy,
            ]}
            onPress={() => setIsAvailable(!isAvailable)}
          >
            <View style={styles.toggleKnobWrapper}>
              <View
                style={[
                  styles.toggleKnob,
                  isAvailable ? styles.knobAvailable : styles.knobBusy,
                ]}
              />
            </View>
            <Text
              style={[
                styles.toggleText,
                isAvailable ? styles.textAvailable : styles.textBusy,
              ]}
            >
              {isAvailable ? "Available" : "Busy"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Showcase: Interests */}
        <View style={styles.showcaseSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.showcaseTitle}>My Interests</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/edit-interests")}
            >
              <Ionicons name="pencil" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.chipsContainer}>
            {interests.length === 0 && (
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                No interests selected yet.
              </Text>
            )}
            {interests.map((it, idx) => (
              <View key={`interest-${idx}`} style={styles.chip}>
                <Text style={styles.chipText}>{it}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addChip}
              onPress={() => router.push("/(tabs)/edit-interests")}
            >
              <Ionicons name="add" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Showcase: Takvim ve Program */}
        <View style={[styles.showcaseSection, { paddingBottom: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.showcaseTitle}>Schedule & Calendar</Text>
            <TouchableOpacity
              style={styles.editScheduleBtn}
              onPress={() => router.push("/ocr-schedule")}
            >
              <Ionicons name="create-outline" size={14} color="#FFF" />
              <Text style={styles.editScheduleText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Dinamik Tema Uyumlu Takvim (GERİ DÖNDÜ) */}
          <Calendar
            current={selectedDate}
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            firstDay={1}
            markedDates={{
              [selectedDate]: {
                selected: true,
                disableTouchEvent: true,
                selectedColor: theme.primary,
              },
            }}
            theme={{
              calendarBackground: theme.card,
              textSectionTitleColor: theme.textSecondary,
              selectedDayBackgroundColor: theme.primary,
              selectedDayTextColor: "#ffffff",
              todayTextColor: theme.primary,
              dayTextColor: theme.textPrimary,
              textDisabledColor: theme.cardBorder,
              monthTextColor: theme.textPrimary,
              arrowColor: theme.primary,
              textDayFontWeight: "500",
              textMonthFontWeight: "bold",
              textDayHeaderFontWeight: "600",
              textDayFontSize: 16,
              textMonthFontSize: 18,
            }}
            style={styles.calendarStyle}
          />

          {/* Seçili Günün Etkinlik Akışı */}
          <View style={styles.timelineContainer}>
            <Text style={styles.selectedDayTitle}>
              {new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>

            {HOURS.map((h) => {
              const slot = getSlotForHour(h);
              if (!slot) return null;

              const isM =
                slot.metadata?.type === "Müsait" ||
                slot.metadata?.type === "Available";
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
                          {isM ? "Available" : slot.metadata?.type || "Event"}
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

            {HOURS.filter((h) => getSlotForHour(h)).length === 0 && (
              <View style={{ alignItems: "center", marginTop: 20 }}>
                <Ionicons
                  name="cafe-outline"
                  size={40}
                  color={theme.textSecondary}
                />
                <Text
                  style={{
                    color: theme.textSecondary,
                    marginTop: 10,
                    textAlign: "center",
                  }}
                >
                  No events scheduled for this day.
                </Text>
              </View>
            )}
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
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              <Ionicons name="person-outline" size={22} color={theme.primary} />
            </View>
            <Text style={styles.actionText}>Edit Profile</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              const nextTheme =
                themePreference === "dark"
                  ? "light"
                  : themePreference === "light"
                    ? "system"
                    : "dark";
              setThemePreference(nextTheme);
            }}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              <Ionicons
                name="color-palette-outline"
                size={22}
                color={theme.primary}
              />
            </View>
            <Text style={styles.actionText}>
              Theme:{" "}
              {themePreference.charAt(0).toUpperCase() +
                themePreference.slice(1)}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: "rgba(239, 68, 68, 0.1)" },
              ]}
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            </View>
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
            <ScrollView>
              {pendingRequests.length > 0 && (
                <View>
                  <Text style={styles.modalSectionTitle}>Pending Requests</Text>
                  {pendingRequests.map((r) => (
                    <View key={r.id} style={styles.friendRow}>
                      <View style={styles.friendAvatar}>
                        <Text style={{ color: "#fff", fontWeight: "bold" }}>
                          {r.full_name?.charAt(0)}
                        </Text>
                      </View>
                      <Text style={styles.friendName}>{r.full_name}</Text>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAccept(r.id)}
                      >
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleReject(r.id)}
                      >
                        <Ionicons name="close" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.modalSectionTitle}>My Friends</Text>
              {friends.length === 0 && (
                <Text style={{ marginLeft: 20, color: theme.textSecondary }}>
                  No friends yet.
                </Text>
              )}
              {friends.map((f) => (
                <View key={f.id} style={styles.friendRow}>
                  <View style={styles.friendAvatar}>
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      {f.full_name?.charAt(0)}
                    </Text>
                  </View>
                  <Text style={styles.friendName}>{f.full_name}</Text>
                </View>
              ))}

              <Text style={[styles.modalSectionTitle, { marginTop: 32 }]}>
                Add Friend
              </Text>
              <View style={styles.addFriendRow}>
                <View style={styles.addFriendInputContainer}>
                  <Ionicons name="search" size={20} color="#64748B" />
                  <TextInput
                    style={styles.addFriendInput}
                    placeholder="Username or Email"
                    placeholderTextColor="#64748B"
                    value={newFriendUsername}
                    onChangeText={setNewFriendUsername}
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity
                  style={styles.sendReqBtn}
                  onPress={handleSendRequest}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    statBox: { flex: 1, alignItems: "center" },
    statBorder: { width: 1, backgroundColor: theme.cardBorder },
    statValue: { fontSize: 24, fontWeight: "900", color: theme.textPrimary },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "600",
      textTransform: "uppercase",
      marginTop: 4,
    },
    availabilityContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.card,
      marginHorizontal: 20,
      borderRadius: 20,
      padding: 20,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    availabilityInfo: { flex: 1 },
    availabilityTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.textPrimary,
      marginBottom: 4,
    },
    availabilityDesc: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    availabilityToggle: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "transparent",
    },
    toggleAvailable: {
      backgroundColor: "rgba(16, 185, 129, 0.1)",
      borderColor: "rgba(16, 185, 129, 0.3)",
    },
    toggleBusy: {
      backgroundColor: theme.dangerBg,
      borderColor: "rgba(239, 68, 68, 0.3)",
    },
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

    calendarStyle: {
      borderRadius: 16,
      paddingBottom: 10,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      marginBottom: 16,
    },
    selectedDayTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.textPrimary,
      marginBottom: 16,
      marginTop: 8,
    },

    timelineContainer: { paddingTop: 10 },
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

    actionsContainer: { paddingHorizontal: 20, paddingTop: 10 },
    sectionTitle: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: "800",
      marginBottom: 16,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    actionText: {
      flex: 1,
      fontSize: 16,
      color: theme.textPrimary,
      fontWeight: "600",
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
    modalSectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.textSecondary,
      marginBottom: 16,
      textTransform: "uppercase",
    },
    friendRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      padding: 12,
      borderRadius: 16,
      marginBottom: 12,
    },
    friendAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    friendName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    acceptBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#10B981",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
    },
    rejectBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      justifyContent: "center",
      alignItems: "center",
    },
    addFriendRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      marginBottom: 32,
    },
    addFriendInputContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      height: 50,
      borderRadius: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      marginRight: 12,
    },
    addFriendInput: {
      flex: 1,
      marginLeft: 8,
      color: theme.textPrimary,
      fontSize: 15,
    },
    sendReqBtn: {
      backgroundColor: theme.primary,
      height: 50,
      paddingHorizontal: 20,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
  });

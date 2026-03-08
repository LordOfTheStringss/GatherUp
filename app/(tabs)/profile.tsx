import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuthStore } from "../../src/store/authStore";

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
  const { userEmail } = useAuthStore();
  const [activeTab, setActiveTab] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  // Dinamik Profil State'leri
  const [fullName, setFullName] = useState("Kullanıcı");
  const [role, setRole] = useState("GatherUp Üyesi");
  const [interests, setInterests] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);

  // useFocusEffect: Kullanıcı bu sekmeye her geldiğinde (veya edit'ten dönünce) verileri yeniler
  useFocusEffect(
    useCallback(() => {
      const fetchProfileData = async () => {
        setLoading(true);
        try {
          // 1. Kullanıcı Bilgilerini Çek
          const { UserController } =
            await import("../../src/controllers/UserController");
          const { UserManager } =
            await import("../../src/core/identity/UserManager");
          const userController = new UserController(
            UserManager.getInstance(),
            {} as any,
            {} as any,
          );

          const profileRes = await userController.getMyProfile();
          if (profileRes.status === 200 && profileRes.data) {
            setFullName(profileRes.data.fullName || "İsimsiz Kullanıcı");
            setRole(profileRes.data.bio || "Öğrenci / Çalışan");
            // Eğer backend'den interests geliyorsa al, yoksa boş dizi
            setInterests(profileRes.data.interests || []);
          }

          // 2. Takvim Bilgilerini Çek
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
          // İleride getMySchedule güncellendiğinde burası direkt TimeSlot dizisini alacak
          const scheduleRes = await scheduleController.getMySchedule(
            new Date(),
          );

          // Şimdilik mock takvimi tamamen sildik, sadece sistemden gelen veriyi (veya boş diziyi) basıyoruz
          if (scheduleRes.status === 200 && scheduleRes.data?.busyBlocks) {
            setSchedule(scheduleRes.data.busyBlocks);
          } else {
            setSchedule([]); // Eğer sistemde takvim yoksa boş göster
          }
        } catch (error) {
          console.error("Profil yüklenirken hata oluştu:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchProfileData();
    }, []),
  );

  // Seçili gün ve saatteki takvim slotunu bulan fonksiyon
  const getSlotForHour = (hourInt: number) => {
    return schedule.find((s: any) => {
      // TimeSlot objesiyse (Date içerir)
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

  // Avatar için isim baş harflerini veya API'yi kullan
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3B82F6&color=fff&size=256`;

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ÜST BİLGİ BÖLÜMÜ */}
      <View style={styles.headerArea}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Profilim</Text>
          {/* Ayarlar İkonu artık edit-profile ekranına gidiyor! */}
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push("/(tabs)/edit-profile")}
          >
            <Ionicons name="settings-outline" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userRole}>{role}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>
        </View>
      </View>

      {/* İLGİ ALANLARI (CHIPS) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>İlgi Alanlarım</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/edit-interests")}
          >
            <Ionicons name="pencil" size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {interests.length === 0 ? (
          <Text style={styles.emptyText}>Henüz ilgi alanı eklemedin.</Text>
        ) : (
          <View style={styles.chipsContainer}>
            {interests.map((interest, index) => (
              <View key={index} style={styles.chip}>
                <Text style={styles.chipText}>{interest}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addChip}
              onPress={() => router.push("/(tabs)/edit-interests")}
            >
              <Ionicons name="add" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* HAFTALIK PROGRAM */}
      <View style={[styles.section, { paddingBottom: 40 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Haftalık Programım</Text>
          <TouchableOpacity
            style={styles.editScheduleBtn}
            onPress={() => router.push("/(auth)/plan")}
          >
            <Ionicons name="create-outline" size={16} color="#FFF" />
            <Text style={styles.editScheduleText}>Düzenle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabsContainer}>
          {DAYS.map((day) => {
            const isActive = activeTab === day.index;
            return (
              <TouchableOpacity
                key={day.label}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => setActiveTab(day.index)}
              >
                <Text
                  style={[styles.tabText, isActive && styles.activeTabText]}
                >
                  {day.label}
                </Text>
                {isActive && <View style={styles.activeTabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.timelineContainer}>
          {HOURS.map((hour) => {
            const slot = getSlotForHour(hour);
            if (!slot) return null;

            const isMusait = slot.metadata?.type === "Müsait";
            const color = slot.metadata?.color || "#3B82F6";

            return (
              <View style={styles.timelineRow} key={hour}>
                <Text style={styles.timeLabel}>
                  {hour.toString().padStart(2, "0")}:00
                </Text>
                <View style={styles.slotArea}>
                  <View
                    style={[
                      styles.card,
                      isMusait ? styles.cardMusait : { backgroundColor: color },
                    ]}
                  >
                    <Ionicons
                      name={
                        isMusait
                          ? "checkmark-circle"
                          : slot.metadata?.type === "İş"
                            ? "briefcase"
                            : slot.metadata?.type === "Etkinlik"
                              ? "people"
                              : "book"
                      }
                      size={20}
                      color={isMusait ? "#10B981" : "#FFF"}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.cardType,
                          isMusait ? { color: "#10B981" } : {},
                        ]}
                      >
                        {slot.metadata?.type || "Etkinlik"}
                      </Text>
                      {!isMusait && (
                        <View>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {slot.metadata?.title}
                          </Text>
                          {!!slot.metadata?.location && (
                            <Text style={styles.cardLocation} numberOfLines={1}>
                              📍 {slot.metadata.location}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          {HOURS.filter((h) => getSlotForHour(h)).length === 0 && (
            <View style={styles.emptyDayContainer}>
              <Ionicons name="cafe-outline" size={48} color="#334155" />
              <Text style={styles.emptyDayText}>
                Bu gün için planlanmış bir etkinlik veya ders yok. Tamamen
                boşsun!
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  headerArea: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#0F172A",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
  },
  profileCard: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#3B82F6",
  },
  profileInfo: { flex: 1, marginLeft: 16 },
  userName: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  userRole: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  userEmail: { color: "#64748B", fontSize: 12 },
  section: { paddingHorizontal: 24, paddingTop: 30 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: { color: "#F8FAFC", fontSize: 18, fontWeight: "800" },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  chipText: { color: "#E2E8F0", fontWeight: "600", fontSize: 14 },
  addChip: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { color: "#64748B", fontSize: 14, fontStyle: "italic" },
  editScheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
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
    borderBottomColor: "#1E293B",
    paddingBottom: 10,
    marginTop: 10,
  },
  tab: { alignItems: "center", paddingVertical: 8, width: 40 },
  activeTab: {},
  tabText: { color: "#64748B", fontSize: 14, fontWeight: "600" },
  activeTabText: { color: "#A855F7", fontWeight: "bold" },
  activeTabIndicator: {
    width: 24,
    height: 4,
    backgroundColor: "#A855F7",
    borderRadius: 2,
    position: "absolute",
    bottom: -10,
  },
  timelineContainer: { paddingTop: 20 },
  timelineRow: { flexDirection: "row", marginBottom: 12, minHeight: 70 },
  timeLabel: {
    width: 50,
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 15,
  },
  slotArea: { flex: 1, marginLeft: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 16,
    minHeight: 75,
  },
  cardType: { color: "#FFF", fontSize: 14, fontWeight: "bold" },
  cardTitle: { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 2 },
  cardLocation: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "500",
  },
  cardMusait: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#10B981",
    borderStyle: "dashed",
  },
  emptyDayContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyDayText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
    marginTop: 15,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
});

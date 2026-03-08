import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { v4 as uuidv4 } from "uuid";
import { ScheduleController } from "../../src/controllers/ScheduleController";
import { OCRProcessor } from "../../src/core/schedule/OCRProcessor";
import { ScheduleManager } from "../../src/core/schedule/ScheduleManager";
import {
  BlockType,
  DataSource,
  TimeSlot,
} from "../../src/core/schedule/TimeSlot";
import { useUIStore } from "../../src/store/uiStore";

// Tema sistemi importları eklendi
import { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/useTheme";

const scheduleController = new ScheduleController(
  new ScheduleManager(),
  new OCRProcessor(),
);

const DAYS = [
  { label: "Pzt", index: 1 },
  { label: "Sal", index: 2 },
  { label: "Çar", index: 3 },
  { label: "Per", index: 4 },
  { label: "Cum", index: 5 },
  { label: "Cmt", index: 6 },
  { label: "Paz", index: 0 },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

export default function PlanTimeScreen() {
  const { showToast, setGlobalLoading } = useUIStore();
  const theme = useTheme(); // Tema hook'u çağrıldı
  const styles = createStyles(theme); // Stiller temaya bağlandı

  const [step, setStep] = useState<
    "type_select" | "upload" | "manual_time" | "calendar_view"
  >("type_select");
  const [schedule, setSchedule] = useState<TimeSlot[]>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [workStart, setWorkStart] = useState("08:00");
  const [workEnd, setWorkEnd] = useState("17:00");

  const applyManualHours = () => {
    const startInt = parseInt(workStart.split(":")[0]);
    const endInt = parseInt(workEnd.split(":")[0]);

    if (startInt >= endInt || isNaN(startInt) || isNaN(endInt)) {
      showToast("Geçerli bir saat girin (Örn: 08:00 ve 17:00)", "error");
      return;
    }

    const newSlots: TimeSlot[] = [];
    const today = new Date();

    for (let i = 1; i <= 5; i++) {
      const diff = i - today.getDay();

      for (let h = startInt; h < endInt; h++) {
        const startDate = new Date(today);
        startDate.setDate(today.getDate() + diff);
        startDate.setHours(h, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(h + 1, 0, 0, 0);

        newSlots.push(
          new TimeSlot(
            uuidv4(),
            "user-123",
            startDate,
            endDate,
            BlockType.BUSY,
            DataSource.MANUAL,
            true,
            { title: "İş (Mesai)", type: "İş", color: "#F59E0B" }, // Turuncu tema rengi
          ),
        );
      }
    }

    setSchedule(newSlots);
    setStep("calendar_view");
    showToast("Hafta içi mesai saatlerin eklendi!", "success");
  };

  const handleUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets[0].base64) return;
      setGlobalLoading(true);
      const response = await scheduleController.processScheduleImage(
        result.assets[0].base64,
        "user-123",
      );
      if (response.status !== 200 || !response.data)
        throw new Error(response.message);

      const coloredSlots = response.data.map((slot: TimeSlot) => {
        slot.metadata.type = "Ders";
        slot.metadata.color = "#E11D48";
        if (!slot.metadata.title) slot.metadata.title = "Ders / Etkinlik";
        return slot;
      });
      setSchedule(coloredSlots);
      setStep("calendar_view");
      showToast("Ders programın analiz edildi!", "success");
    } catch (e: any) {
      showToast(e.message || "Analiz başarısız oldu.", "error");
    } finally {
      setGlobalLoading(false);
    }
  };

  const getSlotForHour = (hourInt: number) => {
    return schedule.find(
      (s) =>
        s.startTime.getDay() === activeTab &&
        s.startTime.getHours() === hourInt,
    );
  };

  const toggleAvailable = (hourInt: number) => {
    const existing = getSlotForHour(hourInt);
    if (existing) {
      if (existing.metadata?.type === "Müsait") {
        setSchedule((prev) => prev.filter((s) => s.slotId !== existing.slotId));
      } else {
        setSelectedSlot(existing);
      }
    } else {
      const today = new Date();
      const diff = activeTab - today.getDay();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + diff);
      startDate.setHours(hourInt, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(hourInt + 1, 0, 0, 0);
      const newSlot = new TimeSlot(
        uuidv4(),
        "user-123",
        startDate,
        endDate,
        BlockType.FREE,
        DataSource.MANUAL,
        true,
        { title: "Sosyalleşmeye Müsait", type: "Müsait", color: "#10B981" },
      );
      setSchedule((prev) => [...prev, newSlot]);
    }
  };

  const handleConfirm = async () => {
    setGlobalLoading(true);
    try {
      await scheduleController.confirmSchedule(schedule, "user-123");
      showToast("Programın profiline kaydedildi!", "success");
      router.replace("/(tabs)");
    } catch (error) {
      showToast("Kaydedilemedi.", "error");
    } finally {
      setGlobalLoading(false);
    }
  };

  if (step === "type_select") {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Hoş Geldin!</Text>
          <Text style={styles.subtitle}>
            Sana en uygun etkinlik zamanlarını bulabilmemiz için günlük rutinine
            ihtiyacımız var.
          </Text>
          <TouchableOpacity
            style={styles.typeButton}
            onPress={() => setStep("upload")}
          >
            <View style={styles.typeIconContainer}>
              <Text style={{ fontSize: 24 }}>🎓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeTitle}>Öğrenciyim</Text>
              <Text style={styles.typeDesc}>Ders programını (OBS) yükle.</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.typeButton}
            onPress={() => setStep("manual_time")}
          >
            <View style={styles.typeIconContainer}>
              <Text style={{ fontSize: 24 }}>💼</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeTitle}>Çalışıyorum</Text>
              <Text style={styles.typeDesc}>Mesai saatlerini belirle.</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.bottomNav}>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.skipText}>Şimdilik Atla</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === "manual_time" || step === "upload") {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {step === "upload" ? "Zamanını Planla" : "Mesai Saatlerin"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "upload"
              ? "Ders programını yükle, yapay zeka halletsin."
              : "Çalışma saatlerini gir, takvime dökelim."}
          </Text>
          {step === "upload" ? (
            <TouchableOpacity style={styles.uploadBox} onPress={handleUpload}>
              <Ionicons
                name="camera"
                size={48}
                color={theme.primary}
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.uploadText}>Galeriden Seç</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.timeInputContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Başlangıç</Text>
                <TextInput
                  style={styles.input}
                  value={workStart}
                  onChangeText={setWorkStart}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              <Text style={styles.dashText}>-</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bitiş</Text>
                <TextInput
                  style={styles.input}
                  value={workEnd}
                  onChangeText={setWorkEnd}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>
          )}
          {step === "manual_time" && (
            <TouchableOpacity style={styles.button} onPress={applyManualHours}>
              <Text style={styles.buttonText}>Tabloyu Oluştur</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.bottomNav}>
          <TouchableOpacity
            onPress={() => setStep("type_select")}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color={theme.textSecondary} />
            <Text style={styles.backText}>Geri Dön</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.skipText}>Şimdilik Atla</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <TouchableOpacity
          onPress={() => setStep("type_select")}
          style={styles.headerBackBtn}
        >
          <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Haftalık Programını Düzenle</Text>
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
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {day.label}
              </Text>
              {isActive && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.timelineContainer}
        showsVerticalScrollIndicator={false}
      >
        {HOURS.map((hour) => {
          const slot = getSlotForHour(hour);
          const isMusait = slot?.metadata?.type === "Müsait";

          return (
            <View style={styles.timelineRow} key={hour}>
              <Text style={styles.timeLabel}>
                {hour.toString().padStart(2, "0")}:00
              </Text>
              <View style={styles.slotArea}>
                {slot ? (
                  <TouchableOpacity
                    style={[
                      styles.card,
                      isMusait
                        ? styles.cardMusait
                        : {
                            backgroundColor:
                              slot.metadata?.color || theme.primary,
                          },
                    ]}
                    onPress={() => toggleAvailable(hour)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={
                        isMusait
                          ? "checkmark-circle"
                          : slot.metadata?.type === "İş"
                            ? "briefcase"
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
                        {slot.metadata?.type
                          ? String(slot.metadata.type)
                          : "Etkinlik"}
                      </Text>

                      {isMusait ? null : (
                        <View>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {slot.metadata?.title
                              ? String(slot.metadata.title)
                              : "Detay belirtilmedi"}
                          </Text>
                          {!!slot.metadata?.location && (
                            <Text style={styles.cardLocation} numberOfLines={1}>
                              📍 {String(slot.metadata.location)}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.emptySlot}
                    onPress={() => toggleAvailable(hour)}
                  >
                    <Ionicons
                      name="add"
                      size={24}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footerFloat}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmBtnText}>Profili Güncelle ve Bitir</Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color="#FFF"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>

      <Modal visible={!!selectedSlot} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View
              style={[
                styles.modalHeaderLine,
                {
                  backgroundColor:
                    selectedSlot?.metadata?.color || theme.primary,
                },
              ]}
            />
            <View style={styles.modalHeader}>
              <View style={styles.modalBadge}>
                <Text style={styles.modalBadgeText}>
                  {selectedSlot?.metadata?.type
                    ? String(selectedSlot.metadata.type)
                    : "Etkinlik"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSlot(null)}>
                <Ionicons
                  name="close-circle"
                  size={28}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>
              {selectedSlot?.metadata?.title
                ? String(selectedSlot.metadata.title)
                : "Detay belirtilmedi"}
            </Text>

            {!!selectedSlot?.metadata?.location && (
              <View style={styles.modalLocationRow}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text style={styles.modalTimeText}>
                  {String(selectedSlot.metadata.location)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalDeleteBtn}
              onPress={() => {
                setSchedule((prev) =>
                  prev.filter((s) => s.slotId !== selectedSlot?.slotId),
                );
                setSelectedSlot(null);
              }}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={theme.danger || "#EF4444"}
              />
              <Text style={styles.modalDeleteText}>Etkinliği Sil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Stiller Tema sistemine (ThemeColors) entegre edildi!
const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.textPrimary,
      marginBottom: 8,
    },
    subtitle: { fontSize: 15, color: theme.textSecondary, marginBottom: 20 },
    typeButton: {
      backgroundColor: theme.card,
      flexDirection: "row",
      padding: 20,
      borderRadius: 16,
      marginBottom: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    typeIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.cardBorder,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    typeTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: "bold" },
    typeDesc: { color: theme.textSecondary, fontSize: 13 },
    uploadBox: {
      height: 200,
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: theme.primary,
      borderStyle: "dashed",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    uploadText: { fontSize: 18, color: theme.primary, fontWeight: "bold" },
    timeInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 30,
    },
    inputGroup: { flex: 1 },
    inputLabel: { color: theme.textSecondary, marginBottom: 8, fontSize: 14 },
    input: {
      backgroundColor: theme.card,
      color: theme.textPrimary,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      fontSize: 16,
      textAlign: "center",
    },
    dashText: {
      color: theme.textSecondary,
      fontSize: 24,
      marginHorizontal: 15,
      marginTop: 20,
    },
    button: {
      backgroundColor: theme.primary,
      height: 52,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 10,
    },
    buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
    bottomNav: {
      padding: 24,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      marginLeft: -10,
    },
    backText: {
      color: theme.textSecondary,
      fontSize: 16,
      marginLeft: 6,
      fontWeight: "600",
    },
    skipText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: "600",
      textDecorationLine: "underline",
    },

    headerArea: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    headerBackBtn: { marginRight: 15 },
    headerTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: "bold" },
    tabsContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
      paddingBottom: 10,
    },
    tab: { alignItems: "center", paddingVertical: 10, width: 45 },
    activeTab: {},
    tabText: { color: theme.textSecondary, fontSize: 14, fontWeight: "600" },
    activeTabText: { color: theme.primary, fontWeight: "bold" },
    activeTabIndicator: {
      width: 30,
      height: 4,
      backgroundColor: theme.primary,
      borderRadius: 2,
      position: "absolute",
      bottom: -10,
    },

    timelineContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
    timelineRow: { flexDirection: "row", marginBottom: 15, minHeight: 70 },
    timeLabel: {
      width: 50,
      color: theme.textSecondary,
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
      height: 75,
    },
    cardType: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
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
    emptySlot: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      height: 75,
    },

    footerFloat: { position: "absolute", bottom: 30, left: 20, right: 20 },
    confirmBtn: {
      backgroundColor: theme.primary,
      flexDirection: "row",
      height: 56,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
    },
    confirmBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
      elevation: 10,
    },
    modalHeaderLine: {
      width: 60,
      height: 5,
      borderRadius: 3,
      alignSelf: "center",
      marginBottom: 20,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalBadge: {
      backgroundColor: "rgba(100,100,100,0.2)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    modalBadgeText: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "bold",
    },
    modalTitle: {
      color: theme.textPrimary,
      fontSize: 24,
      fontWeight: "800",
      marginBottom: 20,
    },
    modalLocationRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 30,
    },
    modalTimeText: {
      color: theme.textSecondary,
      fontSize: 16,
      marginLeft: 8,
      fontWeight: "500",
    },
    modalDeleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.3)",
      marginBottom: 20,
    },
    modalDeleteText: {
      color: theme.danger || "#EF4444",
      fontSize: 16,
      fontWeight: "bold",
      marginLeft: 8,
    },
  });

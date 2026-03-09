import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Modal,
  Platform,
  SafeAreaView,
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
import { ThemeColors } from "../../src/theme/colors";
import { useTheme } from "../../src/theme/useTheme";

const scheduleController = new ScheduleController(
  new ScheduleManager(),
  new OCRProcessor(),
);

const CATEGORIES = [
  { label: "Class", color: "#E11D48", icon: "book" },
  { label: "Work", color: "#F59E0B", icon: "briefcase" },
  { label: "Sports", color: "#3B82F6", icon: "fitness" },
  { label: "Tech", color: "#8B5CF6", icon: "code-working" },
  { label: "Art", color: "#EC4899", icon: "color-palette" },
  { label: "Hobby", color: "#8910b9", icon: "heart" },
  { label: "Social", color: "#10B981", icon: "people" },
];

const DAYS = [
  { label: "Mon", index: 1 },
  { label: "Tue", index: 2 },
  { label: "Wed", index: 3 },
  { label: "Thu", index: 4 },
  { label: "Fri", index: 5 },
  { label: "Sat", index: 6 },
  { label: "Sun", index: 0 },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

export default function OCRScheduleScreen() {
  const { showToast, setGlobalLoading } = useUIStore();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [step, setStep] = useState<"type_select" | "calendar_view">(
    "calendar_view",
  );
  const [schedule, setSchedule] = useState<TimeSlot[]>([]);
  const [activeTab, setActiveTab] = useState<number>(1);

  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: "",
    category: CATEGORIES[0],
    hour: 8,
  });

  const [workStart, setWorkStart] = useState<Date>(
    new Date(new Date().setHours(8, 0, 0, 0)),
  );
  const [workEnd, setWorkEnd] = useState<Date>(
    new Date(new Date().setHours(17, 0, 0, 0)),
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const formatTimeStr = (dateStr: Date | string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  useFocusEffect(
    useCallback(() => {
      const loadExistingSchedule = async () => {
        setGlobalLoading(true);
        try {
          const res = await scheduleController.getMySchedule(
            new Date(),
            "user-123",
          );
          if (res.status === 200 && res.data?.busyBlocks) {
            setSchedule(res.data.busyBlocks);
          }
        } catch (e) {
          console.error("Failed to load schedule", e);
        } finally {
          setGlobalLoading(false);
        }
      };
      loadExistingSchedule();
    }, []),
  );

  const applyManualHours = () => {
    const startInt = workStart.getHours();
    const endInt = workEnd.getHours();

    if (startInt >= endInt) {
      showToast("End time must be after start time", "error");
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
            { title: "Work", type: "Work", color: "#F59E0B" },
          ),
        );
      }
    }
    setSchedule([...schedule, ...newSlots]);
    setStep("calendar_view");
    showToast("Weekday work hours added!", "success");
  };

  const getSlotForHour = (hourInt: number) => {
    return schedule.find((s: any) => {
      if (!s.startTime) return false;
      const st = new Date(s.startTime);
      return st.getDay() === activeTab && st.getHours() === hourInt;
    });
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

      const coloredSlots = response.data.map((slot: any) => {
        return new TimeSlot(
          slot.slotId || uuidv4(),
          "user-123",
          new Date(slot.startTime),
          new Date(slot.endTime),
          BlockType.BUSY,
          DataSource.OCR,
          false,
          {
            title: slot.metadata?.title || "Class",
            type: "Class",
            color: "#E11D48",
          },
        );
      });

      setSchedule((prev) => [...prev, ...coloredSlots]);
      setStep("calendar_view");
      showToast("Schedule uploaded! Tap empty space to add events.", "success");
    } catch (e: any) {
      showToast(e.message || "Upload failed.", "error");
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleSlotPress = (slot: TimeSlot) => setSelectedSlot(slot);

  const handleAddPress = (hourInt: number) => {
    setNewEntry({ ...newEntry, hour: hourInt, title: "" });
    setIsAddModalVisible(true);
  };

  const confirmAddEntry = () => {
    if (!newEntry.title.trim()) {
      showToast("Please enter a title", "error");
      return;
    }
    const today = new Date();
    const diff = activeTab - today.getDay();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + diff);
    startDate.setHours(newEntry.hour, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(newEntry.hour + 1, 0, 0, 0);

    const newSlot = new TimeSlot(
      uuidv4(),
      "user-123",
      startDate,
      endDate,
      BlockType.BUSY,
      DataSource.MANUAL,
      true,
      {
        title: newEntry.title,
        type: newEntry.category.label,
        color: newEntry.category.color,
      },
    );

    setSchedule([...schedule, newSlot]);
    setIsAddModalVisible(false);
  };

  const confirmDeleteFromModal = () => {
    if (selectedSlot) {
      const updatedSchedule = schedule.filter(
        (s) => s.slotId !== selectedSlot.slotId,
      );
      setSchedule(updatedSchedule);
      setSelectedSlot(null);
    }
  };

  const handleConfirm = async () => {
    setGlobalLoading(true);
    try {
      await scheduleController.confirmSchedule(schedule, "user-123");
      showToast("All changes saved!", "success");
      router.replace("/profile");
    } catch (error) {
      showToast("Failed to save.", "error");
    } finally {
      setGlobalLoading(false);
    }
  };

  if (step === "type_select") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setStep("calendar_view")}
            style={styles.backBtn}
          >
            <Ionicons name="close" size={28} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Schedule</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {/* DİKKAT: TASARIM İLK EKRAN (ONBOARDING) İLE AYNI HALE GETİRİLDİ */}
          <TouchableOpacity style={styles.typeButton} onPress={handleUpload}>
            <View style={styles.typeIconContainer}>
              <Text style={{ fontSize: 24 }}>🎓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeTitle}>I am a Student</Text>
              <Text style={styles.typeDesc}>
                Upload your class schedule (OCR).
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <View
            style={{
              height: 1,
              backgroundColor: theme.cardBorder,
              marginVertical: 20,
            }}
          />

          <View>
            <View style={styles.timeInputContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Start</Text>
                <TouchableOpacity
                  style={[
                    styles.timePickerBtn,
                    showStartPicker && { borderColor: theme.primary },
                  ]}
                  onPress={() => {
                    setShowStartPicker(true);
                    setShowEndPicker(false);
                  }}
                >
                  <Text style={styles.timePickerText}>
                    {workStart.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.dashText}>-</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>End</Text>
                <TouchableOpacity
                  style={[
                    styles.timePickerBtn,
                    showEndPicker && { borderColor: theme.primary },
                  ]}
                  onPress={() => {
                    setShowEndPicker(true);
                    setShowStartPicker(false);
                  }}
                >
                  <Text style={styles.timePickerText}>
                    {workEnd.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {(showStartPicker || showEndPicker) && (
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowStartPicker(false);
                      setShowEndPicker(false);
                    }}
                  >
                    <Text style={styles.pickerCloseText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={showStartPicker ? workStart : workEnd}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={(event, date) => {
                    if (Platform.OS === "android") {
                      setShowStartPicker(false);
                      setShowEndPicker(false);
                    }
                    if (date) {
                      if (showStartPicker) setWorkStart(date);
                      if (showEndPicker) setWorkEnd(date);
                    }
                  }}
                />
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.button} onPress={applyManualHours}>
            <Text style={styles.buttonText}>Add to Weekdays</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setStep("type_select")}
          style={styles.backBtn}
        >
          <Ionicons name="camera-outline" size={28} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Weekly Schedule</Text>
        <TouchableOpacity onPress={() => router.replace("/profile")}>
          <Ionicons name="close" size={28} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        {DAYS.map((day) => (
          <TouchableOpacity
            key={day.label}
            style={[styles.tab, activeTab === day.index && styles.activeTab]}
            onPress={() => setActiveTab(day.index)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === day.index && styles.activeTabText,
              ]}
            >
              {day.label}
            </Text>
            {activeTab === day.index && (
              <View style={styles.activeTabIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.timelineContainer}
        showsVerticalScrollIndicator={false}
      >
        {HOURS.map((hour) => {
          const slot = getSlotForHour(hour);
          const isAvailable =
            slot?.metadata?.type === "Available" ||
            slot?.metadata?.type === "Müsait";
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
                      isAvailable
                        ? styles.cardAvailable
                        : {
                            backgroundColor:
                              slot.metadata?.color || theme.primary,
                          },
                    ]}
                    onPress={() => handleSlotPress(slot)}
                  >
                    <Ionicons
                      name="bookmark"
                      size={20}
                      color="#FFF"
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardType, { color: "#FFF" }]}>
                        {isAvailable
                          ? "Available"
                          : slot.metadata?.type || "Event"}
                      </Text>
                      {!isAvailable && (
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {slot.metadata?.title}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.emptySlot}
                    onPress={() => handleAddPress(hour)}
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
          <Text style={styles.confirmBtnText}>Save All & Finish</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isAddModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setIsAddModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalTopHeader}>
              <Text style={styles.modalTitle}>Plan for {newEntry.hour}:00</Text>
              <TouchableOpacity
                onPress={() => setIsAddModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Event name..."
              placeholderTextColor={theme.textSecondary}
              value={newEntry.title}
              onChangeText={(t) => setNewEntry({ ...newEntry, title: t })}
            />
            <Text style={styles.label}>Select Category:</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.label}
                  style={[
                    styles.catChip,
                    newEntry.category.label === cat.label && {
                      backgroundColor: cat.color,
                      borderColor: cat.color,
                    },
                  ]}
                  onPress={() => setNewEntry({ ...newEntry, category: cat })}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      newEntry.category.label === cat.label && {
                        color: "#FFF",
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAddModalVisible(false)}
              >
                <Text style={{ color: theme.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={confirmAddEntry}
              >
                <Text style={{ color: "#FFF", fontWeight: "bold" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedSlot} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setSelectedSlot(null)}
          />
          <View
            style={[
              styles.modalContent,
              {
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                alignItems: "center",
              },
            ]}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: theme.cardBorder,
                borderRadius: 2,
                marginBottom: 20,
              }}
            />

            <View style={styles.modalTopHeaderCenter}>
              <View style={{ width: 24 }} />
              <Text
                style={[
                  styles.modalTitle,
                  { textAlign: "center", marginBottom: 5 },
                ]}
              >
                {selectedSlot?.metadata?.title}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedSlot(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close-circle"
                  size={26}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {selectedSlot && (
              <Text
                style={{
                  color: theme.primary,
                  fontWeight: "800",
                  marginBottom: 15,
                  fontSize: 16,
                }}
              >
                {formatTimeStr(selectedSlot.startTime)} -{" "}
                {formatTimeStr(selectedSlot.endTime)}
              </Text>
            )}

            <Text
              style={{
                color: theme.textSecondary,
                textAlign: "center",
                marginBottom: 24,
                fontSize: 16,
              }}
            >
              Are you sure you want to delete this event from your schedule?
            </Text>
            <TouchableOpacity
              style={[styles.modalDeleteBtn, { width: "100%" }]}
              onPress={confirmDeleteFromModal}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={styles.modalDeleteText}>Yes, Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelBtn, { width: "100%", marginTop: 8 }]}
              onPress={() => setSelectedSlot(null)}
            >
              <Text
                style={{
                  color: theme.textPrimary,
                  textAlign: "center",
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
    },
    backBtn: { minHeight: 44, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "800", color: theme.textPrimary },
    content: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
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
    typeTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: "bold" },
    typeDesc: { color: theme.textSecondary, fontSize: 13 },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.textPrimary,
      marginBottom: 32,
    },

    timeInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    inputGroup: { flex: 1 },
    inputLabel: { color: theme.textSecondary, marginBottom: 8, fontSize: 14 },
    timePickerBtn: {
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    timePickerText: {
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: "bold",
    },
    dashText: {
      color: theme.textSecondary,
      fontSize: 24,
      marginHorizontal: 15,
      marginTop: 20,
    },

    pickerContainer: {
      backgroundColor: theme.card,
      borderRadius: 16,
      marginBottom: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    pickerHeader: {
      flexDirection: "row",
      justifyContent: "flex-end",
      padding: 12,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
    },
    pickerCloseText: { color: theme.primary, fontWeight: "bold", fontSize: 16 },

    button: {
      backgroundColor: theme.primary,
      height: 52,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 10,
    },
    buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },

    tabsContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
      paddingBottom: 10,
      paddingTop: 10,
    },
    tab: { alignItems: "center", paddingVertical: 10, width: 45 },
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
    activeTab: {},
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
    cardAvailable: {
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#10B981",
      borderStyle: "dashed",
    },
    cardType: { fontSize: 12, fontWeight: "bold", opacity: 0.8 },
    cardTitle: { color: "#FFF", fontSize: 14, fontWeight: "600", marginTop: 2 },
    emptySlot: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      height: 75,
      borderStyle: "dashed",
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    footerFloat: { position: "absolute", bottom: 30, left: 20, right: 20 },
    confirmBtn: {
      backgroundColor: theme.primary,
      height: 56,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    confirmBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    modalTopHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTopHeaderCenter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 5,
    },
    modalTitle: { fontSize: 20, fontWeight: "800", color: theme.textPrimary },
    input: {
      backgroundColor: theme.background,
      color: theme.textPrimary,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    label: { color: theme.textPrimary, fontWeight: "bold", marginBottom: 12 },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 24,
    },
    catChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    catChipText: {
      fontSize: 12,
      fontWeight: "bold",
      color: theme.textSecondary,
    },
    modalActions: { flexDirection: "row", gap: 12 },
    cancelBtn: {
      flex: 1,
      height: 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
    },
    saveBtn: {
      flex: 2,
      backgroundColor: theme.primary,
      height: 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
    },
    modalDeleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
    },
    modalDeleteText: {
      color: "#EF4444",
      fontSize: 16,
      fontWeight: "bold",
      marginLeft: 8,
    },
  });

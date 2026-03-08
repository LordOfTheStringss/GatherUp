import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
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

// KATEGORİLER İNGİLİZCE
const CATEGORIES = [
  { label: "Class", color: "#E11D48", icon: "book" },
  { label: "Work", color: "#F59E0B", icon: "briefcase" },
  { label: "Sports", color: "#3B82F6", icon: "fitness" },
  { label: "Tech", color: "#8B5CF6", icon: "code-working" },
  { label: "Art", color: "#EC4899", icon: "color-palette" },
  { label: "Hobby", color: "#8310b9", icon: "heart" },
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

export default function PlanTimeScreen() {
  const { showToast, setGlobalLoading } = useUIStore();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [step, setStep] = useState<
    "type_select" | "upload" | "manual_time" | "calendar_view"
  >("type_select");
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
    setSchedule(newSlots);
    setStep("calendar_view");
    showToast("Weekday work hours added!", "success");
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

      setSchedule(coloredSlots);
      setStep("calendar_view");
      showToast(
        "Schedule analyzed! You can add events to empty slots.",
        "success",
      );
    } catch (e: any) {
      showToast(e.message || "Analysis failed.", "error");
    } finally {
      setGlobalLoading(false);
    }
  };

  const getSlotForHour = (hourInt: number) => {
    return schedule.find((s: any) => {
      if (!s.startTime) return false;
      const st = new Date(s.startTime);
      return st.getDay() === activeTab && st.getHours() === hourInt;
    });
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
      showToast("Schedule saved successfully!", "success");
      router.replace("/(tabs)");
    } catch (error) {
      showToast("Failed to save.", "error");
    } finally {
      setGlobalLoading(false);
    }
  };

  if (step === "type_select") {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>
            We need your daily routine to suggest the best event times for you.
          </Text>
          <TouchableOpacity
            style={styles.typeButton}
            onPress={() => setStep("upload")}
          >
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
          <TouchableOpacity
            style={styles.typeButton}
            onPress={() => setStep("manual_time")}
          >
            <View style={styles.typeIconContainer}>
              <Text style={{ fontSize: 24 }}>💼</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeTitle}>I am Working</Text>
              <Text style={styles.typeDesc}>Set your working hours.</Text>
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
            <Text style={styles.skipText}>Skip for now</Text>
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
            {step === "upload" ? "Plan Your Schedule" : "Working Hours"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "upload"
              ? "Upload your schedule, let AI handle it."
              : "Enter your working hours to build your calendar."}
          </Text>

          {step === "upload" ? (
            <TouchableOpacity style={styles.uploadBox} onPress={handleUpload}>
              <Ionicons
                name="camera"
                size={48}
                color={theme.primary}
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.uploadText}>Choose from Gallery</Text>
            </TouchableOpacity>
          ) : (
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
          )}

          {step === "manual_time" && (
            <TouchableOpacity style={styles.button} onPress={applyManualHours}>
              <Text style={styles.buttonText}>Create Schedule</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.bottomNav}>
          <TouchableOpacity
            onPress={() => setStep("type_select")}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color={theme.textSecondary} />
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerArea}>
        <TouchableOpacity
          onPress={() => setStep("type_select")}
          style={styles.headerBackBtn}
        >
          <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Weekly Schedule</Text>
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
                      {
                        backgroundColor: slot.metadata?.color || theme.primary,
                      },
                    ]}
                    onPress={() => handleSlotPress(slot)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="bookmark"
                      size={20}
                      color="#FFF"
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardType, { color: "#FFF" }]}>
                        {slot.metadata?.type || "Event"}
                      </Text>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {slot.metadata?.title}
                      </Text>
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
          <Text style={styles.confirmBtnText}>Save Profile & Finish</Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color="#FFF"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>

      <Modal visible={isAddModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Event</Text>
            <TextInput
              style={styles.inputModal}
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
            <Text
              style={[
                styles.modalTitle,
                { textAlign: "center", marginBottom: 10 },
              ]}
            >
              {selectedSlot?.metadata?.title}
            </Text>
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
      paddingTop: 10,
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
    cardType: { fontSize: 13, fontWeight: "bold", opacity: 0.9 },
    cardTitle: { color: "#FFF", fontSize: 15, fontWeight: "600", marginTop: 2 },
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
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.textPrimary,
      marginBottom: 16,
    },
    inputModal: {
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

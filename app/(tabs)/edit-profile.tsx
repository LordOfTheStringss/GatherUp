import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useAuthStore } from "../../src/store/authStore";
import { useUIStore } from "../../src/store/uiStore";
import { useTheme } from "../../src/theme/useTheme";
import { ThemeColors } from "../../src/theme/colors";
import { ScreenHeader } from "../../src/components/ui/ScreenHeader";

export default function EditProfileScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { showToast, setGlobalLoading } = useUIStore();
  const { userEmail } = useAuthStore();

  // Local State
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [baseLoc, setBaseLoc] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { UserController } =
          await import("../../src/controllers/UserController");
        const { UserManager } =
          await import("../../src/core/identity/UserManager");
        const controller = new UserController();
        const res = await controller.getMyProfile();
        if (res.status === 200 && res.data) {
          setName(res.data.fullName || "");
          setBio(res.data.bio || "");
          setBaseLoc(res.data.baseLocation || "");
          setProfilePic(res.data.profileImage || null);
        }
      } catch (e) {
        console.error("Failed to load profile:", e);
      }
    };
    fetchProfile();
  }, []);

  const pickImage = async () => {
    // Request permissions
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      showToast("You need to grant permission to access your photos.", "error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfilePic(result.assets[0].uri);
      showToast("Profile photo updated!", "success");
    }
  };

  const handleSave = async () => {
    const { UserController } =
      await import("../../src/controllers/UserController");
    const { UserManager } = await import("../../src/core/identity/UserManager");

    const userController = new UserController();

    setGlobalLoading(true);
    try {
      let finalProfilePic = profilePic;
      if (profilePic && (profilePic.startsWith('file://') || profilePic.startsWith('content://'))) {
        const { AuthManager } = await import("../../src/core/identity/AuthManager");
        const userSession = await AuthManager.getInstance().getCurrentUser();
        if (userSession) {
          finalProfilePic = await UserManager.getInstance().uploadAvatar(userSession.id, profilePic);
        }
      }

      await userController.updateProfile(undefined, {
        name: name,
        bio: bio,
        baseLocation: baseLoc,
        profilePhoto: finalProfilePic || undefined,
      });
      setGlobalLoading(false);
      showToast("Profile details saved.", "success");

      // DİKKAT: Ana ekrana atmaması için rotayı kesin olarak Profil sekmesine yönlendirdik!
      router.navigate("/(tabs)/profile");
    } catch (error) {
      setGlobalLoading(false);
      showToast("Failed to save profile.", "error");
    }
  };

  return (
    <View style={styles.safeArea}>
      <ScreenHeader 
        title="Edit Profile"
        onLeftPress={() => router.navigate("/(tabs)/profile")}
      />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Profile Picture Section */}
        <View style={styles.imageSection}>
          <TouchableOpacity
            onPress={pickImage}
            style={styles.imageContainer}
            activeOpacity={0.8}
          >
            {profilePic ? (
              <ExpoImage 
                source={{ uri: profilePic }} 
                style={styles.profileImage} 
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Text style={styles.placeholderText}>
                  {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
                </Text>
              </View>
            )}
            <View style={styles.editIconBadge}>
              <Ionicons name="camera" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.imageHelpText}>
            Tap to change profile picture
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <Text style={styles.label}>DISPLAY NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholderTextColor="#64748B"
          />

          <Text style={styles.label}>BIO</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholderTextColor="#64748B"
            multiline={true}
            textAlignVertical="top"
          />

          <Text style={styles.label}>EMAIL ADDRESS (READ ONLY)</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={userEmail || ""}
            editable={false}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: { padding: 24, paddingBottom: 100 },

  imageSection: { alignItems: "center", marginBottom: 40 },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.primary,
    overflow: "hidden",
  },
  profileImage: { width: "100%", height: "100%" },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { fontSize: 48, fontWeight: "800", color: "#FFF" },
  editIconBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: theme.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: theme.background,
  },
  imageHelpText: {
    color: theme.textSecondary,
    fontSize: 13,
    marginTop: 16,
    fontWeight: "500",
  },

  formSection: { marginBottom: 32 },
  label: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: theme.card,
    color: theme.textPrimary,
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    fontSize: 16,
  },
  textArea: { height: 120, paddingTop: 16 },
  disabledInput: {
    backgroundColor: theme.surface,
    color: theme.textSecondary,
    borderColor: theme.cardBorder,
  },

  saveBtn: {
    backgroundColor: theme.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});

import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { InputField } from "@/components/InputField";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { storage, Appliance } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "EditAppliance">;

const APPLIANCE_TYPES: { id: Appliance["type"]; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "boiler", label: "Boiler", icon: "thermometer" },
  { id: "heating", label: "Heating", icon: "sun" },
  { id: "electrical", label: "Electrical", icon: "zap" },
  { id: "plumbing", label: "Plumbing", icon: "droplet" },
  { id: "other", label: "Other", icon: "box" },
];

export default function EditApplianceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const applianceId = route.params?.applianceId;

  const [name, setName] = useState("");
  const [type, setType] = useState<Appliance["type"]>("boiler");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditing = !!applianceId;

  useEffect(() => {
    if (applianceId) {
      loadAppliance();
    }
  }, [applianceId]);

  const loadAppliance = async () => {
    const appliances = await storage.getAppliances();
    const appliance = appliances.find((a) => a.id === applianceId);
    if (appliance) {
      setName(appliance.name);
      setType(appliance.type);
      setModel(appliance.model || "");
      setSerialNumber(appliance.serialNumber || "");
      setLocation(appliance.location || "");
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const appliances = await storage.getAppliances();

      if (isEditing) {
        const updatedAppliances = appliances.map((a) =>
          a.id === applianceId
            ? {
                ...a,
                name: name.trim(),
                type,
                model: model.trim() || undefined,
                serialNumber: serialNumber.trim() || undefined,
                location: location.trim() || undefined,
              }
            : a,
        );
        await storage.setAppliances(updatedAppliances);
      } else {
        const newAppliance: Appliance = {
          id: Date.now().toString(),
          name: name.trim(),
          type,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          location: location.trim() || undefined,
        };
        await storage.setAppliances([...appliances, newAppliance]);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to save appliance:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!applianceId) return;

    setIsDeleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const appliances = await storage.getAppliances();
      const updatedAppliances = appliances.filter((a) => a.id !== applianceId);
      await storage.setAppliances(updatedAppliances);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to delete appliance:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <InputField
        label="Name"
        placeholder="e.g., Main Boiler, Kitchen Radiator"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        testID="input-name"
      />

      <ThemedText
        type="small"
        style={[styles.label, { color: theme.textSecondary }]}
      >
        TYPE
      </ThemedText>
      <View style={styles.typeGrid}>
        {APPLIANCE_TYPES.map((typeOption) => (
          <Pressable
            key={typeOption.id}
            style={[
              styles.typeCard,
              { backgroundColor: theme.backgroundDefault },
              type === typeOption.id && {
                borderColor: theme.primary,
                borderWidth: 2,
              },
              Shadows.small,
            ]}
            onPress={() => {
              setType(typeOption.id);
              Haptics.selectionAsync();
            }}
          >
            <Feather
              name={typeOption.icon}
              size={20}
              color={type === typeOption.id ? theme.primary : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={[
                styles.typeLabel,
                type === typeOption.id && { color: theme.primary },
              ]}
            >
              {typeOption.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <InputField
        label="Model (Optional)"
        placeholder="e.g., Worcester Bosch Greenstar 8000"
        value={model}
        onChangeText={setModel}
        testID="input-model"
      />

      <InputField
        label="Serial Number (Optional)"
        placeholder="e.g., WB-2023-001234"
        value={serialNumber}
        onChangeText={setSerialNumber}
        autoCapitalize="characters"
        testID="input-serial"
      />

      <InputField
        label="Location (Optional)"
        placeholder="e.g., Utility Room, Kitchen"
        value={location}
        onChangeText={setLocation}
        autoCapitalize="words"
        testID="input-location"
      />

      <Button
        onPress={handleSubmit}
        disabled={!name.trim() || isSubmitting}
        style={styles.submitButton}
        testID="button-save"
      >
        {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Add Appliance"}
      </Button>

      {isEditing ? (
        <Pressable
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          <ThemedText type="body" style={{ color: theme.error }}>
            {isDeleting ? "Deleting..." : "Delete Appliance"}
          </ThemedText>
        </Pressable>
      ) : null}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
    marginBottom: Spacing.lg,
  },
  typeCard: {
    width: "31%",
    marginHorizontal: "1%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  typeLabel: {
    marginTop: Spacing.xs,
    fontWeight: "500",
    fontSize: 12,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
  deleteButton: {
    alignItems: "center",
    marginTop: Spacing.lg,
    padding: Spacing.md,
  },
});

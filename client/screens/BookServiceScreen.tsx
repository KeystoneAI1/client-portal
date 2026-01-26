import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { InputField } from "@/components/InputField";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { storage, Appliance, Job } from "@/lib/storage";

const SERVICE_TYPES = [
  { id: "repair", label: "Repair", icon: "tool" as const },
  { id: "service", label: "Annual Service", icon: "check-circle" as const },
  { id: "installation", label: "Installation", icon: "plus-circle" as const },
  { id: "inspection", label: "Inspection", icon: "search" as const },
];

export default function BookServiceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedAppliance, setSelectedAppliance] = useState<string>("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadAppliances();
  }, []);

  const loadAppliances = async () => {
    const data = await storage.getAppliances();
    setAppliances(data);
  };

  const handleSubmit = async () => {
    if (!selectedType || !description.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const existingJobs = await storage.getJobs();

      const newJob: Job = {
        id: Date.now().toString(),
        type: selectedType as Job["type"],
        status: "scheduled",
        description: description.trim(),
        scheduledDate: preferredDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        applianceId: selectedAppliance || undefined,
      };

      await storage.setJobs([...existingJobs, newJob]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to book service:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getApplianceIcon = (type: Appliance["type"]): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "boiler":
        return "thermometer";
      case "heating":
        return "sun";
      case "electrical":
        return "zap";
      case "plumbing":
        return "droplet";
      default:
        return "box";
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
      <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
        SERVICE TYPE
      </ThemedText>
      <View style={styles.typeGrid}>
        {SERVICE_TYPES.map((type) => (
          <Pressable
            key={type.id}
            style={[
              styles.typeCard,
              { backgroundColor: theme.backgroundDefault },
              selectedType === type.id && {
                borderColor: theme.primary,
                borderWidth: 2,
              },
              Shadows.small,
            ]}
            onPress={() => {
              setSelectedType(type.id);
              Haptics.selectionAsync();
            }}
          >
            <Feather
              name={type.icon}
              size={24}
              color={selectedType === type.id ? theme.primary : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={[
                styles.typeLabel,
                selectedType === type.id && { color: theme.primary },
              ]}
            >
              {type.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {appliances.length > 0 ? (
        <>
          <ThemedText
            type="small"
            style={[styles.label, { color: theme.textSecondary }]}
          >
            APPLIANCE (OPTIONAL)
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.applianceScroll}
          >
            <Pressable
              style={[
                styles.applianceChip,
                { backgroundColor: theme.backgroundDefault },
                !selectedAppliance && {
                  borderColor: theme.primary,
                  borderWidth: 2,
                },
              ]}
              onPress={() => {
                setSelectedAppliance("");
                Haptics.selectionAsync();
              }}
            >
              <ThemedText type="small">Not specified</ThemedText>
            </Pressable>
            {appliances.map((appliance) => (
              <Pressable
                key={appliance.id}
                style={[
                  styles.applianceChip,
                  { backgroundColor: theme.backgroundDefault },
                  selectedAppliance === appliance.id && {
                    borderColor: theme.primary,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => {
                  setSelectedAppliance(appliance.id);
                  Haptics.selectionAsync();
                }}
              >
                <Feather
                  name={getApplianceIcon(appliance.type)}
                  size={16}
                  color={
                    selectedAppliance === appliance.id
                      ? theme.primary
                      : theme.textSecondary
                  }
                  style={styles.applianceIcon}
                />
                <ThemedText
                  type="small"
                  style={
                    selectedAppliance === appliance.id
                      ? { color: theme.primary }
                      : undefined
                  }
                >
                  {appliance.name}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.formFields}>
        <InputField
          label="Description"
          placeholder="Describe the issue or service needed..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.textArea}
          testID="input-description"
        />

        <InputField
          label="Preferred Date (YYYY-MM-DD)"
          placeholder="e.g., 2025-02-15"
          value={preferredDate}
          onChangeText={setPreferredDate}
          keyboardType="numbers-and-punctuation"
          testID="input-date"
        />
      </View>

      <Button
        onPress={handleSubmit}
        disabled={!selectedType || !description.trim() || isSubmitting}
        style={styles.submitButton}
        testID="button-submit"
      >
        {isSubmitting ? "Booking..." : "Book Service"}
      </Button>
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
    marginTop: Spacing.lg,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  typeCard: {
    width: "48%",
    marginHorizontal: "1%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  typeLabel: {
    marginTop: Spacing.sm,
    fontWeight: "500",
  },
  applianceScroll: {
    marginBottom: Spacing.md,
  },
  applianceChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  applianceIcon: {
    marginRight: Spacing.xs,
  },
  formFields: {
    marginTop: Spacing.lg,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: Spacing.md,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
});

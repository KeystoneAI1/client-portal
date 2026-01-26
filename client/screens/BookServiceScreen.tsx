import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
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
import { useAuth } from "@/hooks/useAuth";
import { useProperty } from "@/lib/propertyContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

interface JobDescription {
  id: number;
  description: string;
  timetocomplete: number;
  price: number;
  appearincustomerlogin: boolean;
  appearinwebbooking: boolean;
}

interface SuggestedAppointment {
  date: string;
  starttime: string;
  endtime: string;
  engineerid: number;
  engineername?: string;
}

type BookServiceRouteProp = RouteProp<RootStackParamList, "BookService">;

export default function BookServiceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<BookServiceRouteProp>();
  const { user } = useAuth();
  const { selectedProperty } = useProperty();

  const preselectedId = route.params?.preselectedJobDescriptionId;
  const serviceName = route.params?.serviceName;

  const [selectedJob, setSelectedJob] = useState<JobDescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedAppointments, setSuggestedAppointments] = useState<SuggestedAppointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<SuggestedAppointment | null>(null);

  const generateMockAppointments = (): SuggestedAppointment[] => {
    const appointments: SuggestedAppointment[] = [];
    const now = new Date();
    
    for (let i = 2; i <= 10; i += 2) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      
      const morningSlot: SuggestedAppointment = {
        date: date.toISOString().split("T")[0],
        starttime: "09:00",
        endtime: "12:00",
        engineerid: 1,
        engineername: "Available Slot",
      };
      appointments.push(morningSlot);
      
      if (appointments.length < 5) {
        const afternoonSlot: SuggestedAppointment = {
          date: date.toISOString().split("T")[0],
          starttime: "13:00",
          endtime: "17:00",
          engineerid: 1,
          engineername: "Available Slot",
        };
        appointments.push(afternoonSlot);
      }
    }
    
    return appointments.slice(0, 5);
  };

  useEffect(() => {
    loadServiceForBooking();
  }, [preselectedId]);

  const loadServiceForBooking = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        new URL("/api/commusoft/jobdescriptions", getApiUrl()).toString()
      );
      if (response.ok) {
        const data = await response.json();
        const descriptions = data.jobdescription || [];
        
        if (preselectedId) {
          const preselected = descriptions.find((jd: JobDescription) => jd.id === preselectedId);
          if (preselected) {
            setSelectedJob(preselected);
            setSuggestedAppointments(generateMockAppointments());
          }
        }
      }
    } catch (error) {
      console.error("Failed to load job descriptions:", error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSubmit = async () => {
    if (!selectedJob) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const accountNumber = user?.accountNumber;
      if (!accountNumber) {
        throw new Error("No account number");
      }

      const jobData = {
        job: {
          description: selectedJob.description,
          jobdescriptionid: selectedJob.id,
          propertyid: selectedProperty?.id || accountNumber,
          contactid: user?.contactId,
          engineernotes: notes.trim() || undefined,
          priority: "Medium_Importance",
        },
      };

      const response = await fetch(
        new URL(`/api/commusoft/customer/${accountNumber}/jobs`, getApiUrl()).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jobData),
        }
      );

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.goBack();
      } else {
        throw new Error("Failed to create job");
      }
    } catch (error) {
      console.error("Failed to book service:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getServiceIcon = (description: string): keyof typeof Feather.glyphMap => {
    const lower = description.toLowerCase();
    if (lower.includes("boiler") || lower.includes("heating")) return "thermometer";
    if (lower.includes("gas")) return "wind";
    if (lower.includes("electric") || lower.includes("eicr")) return "zap";
    if (lower.includes("plumb")) return "droplet";
    if (lower.includes("air con") || lower.includes("ac ")) return "wind";
    if (lower.includes("cylinder")) return "disc";
    if (lower.includes("fire")) return "sun";
    if (lower.includes("diagnostic")) return "search";
    if (lower.includes("pat")) return "check-square";
    return "tool";
  };

  const formatPrice = (price: number) => {
    return `£${price.toFixed(2)}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const formatAppointmentDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatAppointmentTime = (startTime: string, endTime: string) => {
    const formatTime = (t: string) => {
      const [hours, minutes] = t.split(":");
      const h = parseInt(hours, 10);
      const ampm = h >= 12 ? "pm" : "am";
      const h12 = h % 12 || 12;
      return `${h12}:${minutes}${ampm}`;
    };
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Loading available services...
        </ThemedText>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {selectedProperty ? (
        <View style={[styles.propertyBanner, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="map-pin" size={16} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm }}>
            Booking for: {selectedProperty.addressLine1}, {selectedProperty.postcode}
          </ThemedText>
        </View>
      ) : null}

      {selectedJob ? (
        <>
          <View style={[styles.serviceCard, { backgroundColor: theme.backgroundDefault }, Shadows.small]}>
            <View style={styles.serviceIconContainer}>
              <Feather
                name={getServiceIcon(selectedJob.description)}
                size={28}
                color={theme.primary}
              />
            </View>
            <View style={styles.serviceInfo}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {serviceName || selectedJob.description}
              </ThemedText>
              <View style={styles.serviceMeta}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {formatDuration(selectedJob.timetocomplete)}
                </ThemedText>
                <View style={[styles.priceBadge, { backgroundColor: theme.primaryLight }]}>
                  <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                    {formatPrice(selectedJob.price)}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
            SELECT AN APPOINTMENT
          </ThemedText>

          <View style={styles.appointmentsGrid}>
            {suggestedAppointments.map((apt, index) => {
              const isSelected = selectedAppointment === apt;
              return (
                <Pressable
                  key={`${apt.date}-${apt.starttime}-${index}`}
                  style={[
                    styles.appointmentCard,
                    { backgroundColor: theme.backgroundDefault },
                    isSelected && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primaryLight },
                    Shadows.small,
                  ]}
                  onPress={() => {
                    setSelectedAppointment(apt);
                    Haptics.selectionAsync();
                  }}
                  testID={`appointment-${index}`}
                >
                  <ThemedText type="body" style={[styles.appointmentDate, isSelected && { color: theme.primary }]}>
                    {formatAppointmentDate(apt.date)}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {formatAppointmentTime(apt.starttime, apt.endtime)}
                  </ThemedText>
                  {isSelected ? (
                    <Feather name="check-circle" size={18} color={theme.primary} style={{ marginTop: Spacing.sm }} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
            ADDITIONAL NOTES (OPTIONAL)
          </ThemedText>
          <InputField
            placeholder="Any specific details or access instructions..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.textArea}
            testID="input-notes"
          />

          {selectedAppointment ? (
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                Booking Summary
              </ThemedText>
              <View style={styles.summaryRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Service:
                </ThemedText>
                <ThemedText type="small" numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>
                  {selectedJob.description}
                </ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Appointment:
                </ThemedText>
                <ThemedText type="small">
                  {formatAppointmentDate(selectedAppointment.date)} {formatAppointmentTime(selectedAppointment.starttime, selectedAppointment.endtime)}
                </ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Price:
                </ThemedText>
                <ThemedText type="body" style={{ color: theme.primary, fontWeight: "600" }}>
                  {formatPrice(selectedJob.price)}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Feather name="alert-circle" size={32} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No service selected
          </ThemedText>
        </View>
      )}

      <Button
        onPress={handleSubmit}
        disabled={!selectedJob || isSubmitting}
        style={styles.submitButton}
        testID="button-submit"
      >
        {isSubmitting ? "Booking..." : "Request Booking"}
      </Button>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  propertyBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  serviceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  appointmentsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  appointmentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 140,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  appointmentDate: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  label: {
    fontWeight: "600",
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  priceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: Spacing.md,
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  submitButton: {
    marginTop: Spacing.xl,
  },
});

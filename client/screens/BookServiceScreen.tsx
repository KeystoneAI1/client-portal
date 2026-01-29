import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
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
  const serviceReminderId = route.params?.serviceReminderId;

  const [selectedJob, setSelectedJob] = useState<JobDescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedAppointments, setSuggestedAppointments] = useState<SuggestedAppointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<SuggestedAppointment | null>(null);
  const [appointmentApiError, setAppointmentApiError] = useState(false);

  const SUPPORT_PHONE = "+441925234450";

  const handleCallSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
  };

  useEffect(() => {
    loadServiceForBooking();
  }, [preselectedId]);

  const fetchAppointmentsWithRetry = async (postcode: string, jobDescriptionId: number, propertyId: string | undefined, maxRetries: number = 3): Promise<SuggestedAppointment[] | null> => {
    // Get customer ID from user context
    const customerId = user?.accountNumber;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Fetching appointments attempt ${attempt}/${maxRetries} with propertyId: ${propertyId}, customerId: ${customerId}`);
        const appointmentsResponse = await fetch(
          new URL("/api/commusoft/suggested-appointments", getApiUrl()).toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postcode: postcode,
              jobdescriptionid: jobDescriptionId,
              duration: 60,
              propertyid: propertyId,
              customerid: customerId,
            }),
          }
        );
        
        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          console.log(`Attempt ${attempt}: API response:`, JSON.stringify(appointmentsData).substring(0, 200));
          
          // Handle multiple response formats
          let slots = appointmentsData.suggestedappointment || 
                      appointmentsData.suggested_appointments || 
                      appointmentsData.appointments || 
                      [];
          
          // Normalize slot format if needed (backend returns start_time/end_time, we need starttime/endtime)
          slots = slots.map((slot: any) => ({
            date: slot.date,
            starttime: slot.starttime || slot.start_time || "09:00",
            endtime: slot.endtime || slot.end_time || "17:00",
          }));
          
          if (slots.length > 0) {
            console.log(`Attempt ${attempt}: Got ${slots.length} slots`);
            return slots.slice(0, 5);
          }
          console.log(`Attempt ${attempt}: No slots returned`);
        } else {
          console.log(`Attempt ${attempt}: API returned error status ${appointmentsResponse.status}`);
        }
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return null;
  };

  const loadServiceForBooking = async () => {
    setIsLoading(true);
    setAppointmentApiError(false);
    try {
      const response = await fetch(
        new URL("/api/commusoft/jobdescriptions", getApiUrl()).toString()
      );
      if (response.ok) {
        const data = await response.json();
        const descriptions = data.jobdescription || [];
        
        let matchedJob: JobDescription | null = null;
        
        // First try to match by preselected ID
        if (preselectedId) {
          matchedJob = descriptions.find((jd: JobDescription) => jd.id === preselectedId) || null;
        }
        
        // If no match by ID, try to match by service name
        if (!matchedJob && serviceName) {
          console.log("[BookService] Looking up job description by service name:", serviceName);
          // Try exact match first
          matchedJob = descriptions.find((jd: JobDescription) => 
            jd.description.toLowerCase() === serviceName.toLowerCase()
          ) || null;
          
          // Try partial match if no exact match
          if (!matchedJob) {
            // Extract key words from service name (e.g., "Domestic AC Service" -> "ac service")
            const searchTerms = serviceName.toLowerCase()
              .replace("domestic", "")
              .replace("-", "")
              .trim();
            
            matchedJob = descriptions.find((jd: JobDescription) => 
              jd.description.toLowerCase().includes(searchTerms) ||
              searchTerms.includes(jd.description.toLowerCase())
            ) || null;
          }
          
          if (matchedJob) {
            console.log("[BookService] Found matching job description:", matchedJob.description, "ID:", matchedJob.id);
          }
        }
        
        if (matchedJob) {
          setSelectedJob(matchedJob);
          
          const postcode = selectedProperty?.postcode || "";
          if (postcode) {
            const slots = await fetchAppointmentsWithRetry(postcode, matchedJob.id, selectedProperty?.id, 3);
            if (slots && slots.length > 0) {
              setSuggestedAppointments(slots);
            } else {
              console.log("All retry attempts failed, showing error state");
              setAppointmentApiError(true);
              setSuggestedAppointments([]);
            }
          } else {
            setAppointmentApiError(true);
            setSuggestedAppointments([]);
          }
        } else {
          console.log("[BookService] No matching job description found for:", serviceName, "ID:", preselectedId);
          setAppointmentApiError(true);
        }
      }
    } catch (error) {
      console.error("Failed to load job descriptions:", error);
    } finally {
      setIsLoading(false);
    }
  };


  const [bookingSuccess, setBookingSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedJob || !selectedAppointment) {
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

      const startDateTime = `${selectedAppointment.date} ${selectedAppointment.starttime}:00`;
      const endDateTime = `${selectedAppointment.date} ${selectedAppointment.endtime}:00`;
      
      const jobData = {
        job: {
          uuid: crypto.randomUUID(),
          description: selectedJob.description,
          isservicejob: true,
          contactid: user?.contactId,
          startdatetime: startDateTime,
          enddatetime: endDateTime,
          engineernotes: notes.trim() || undefined,
          priority: "Medium_Importance",
          servicereminderinstances: serviceReminderId ? [serviceReminderId] : undefined,
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSubmitting(false);
      setBookingSuccess(true);
    } catch (error) {
      console.error("Failed to book service:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSubmitting(false);
      setBookingSuccess(true);
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

  if (bookingSuccess) {
    return (
      <View style={[styles.successContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.successIcon, { backgroundColor: theme.success + "20" }]}>
          <Feather name="check-circle" size={64} color={theme.success} />
        </View>
        <ThemedText type="title" style={{ marginTop: Spacing.xl, textAlign: "center" }}>
          Booking Confirmed
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
          Your {serviceName || selectedJob?.description} has been scheduled for{" "}
          {selectedAppointment ? formatAppointmentDate(selectedAppointment.date) : ""}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.lg, textAlign: "center" }}>
          We'll send you a confirmation shortly
        </ThemedText>
        <Button
          onPress={() => navigation.goBack()}
          style={{ marginTop: Spacing.xl, minWidth: 200 }}
          testID="button-done"
        >
          Done
        </Button>
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

          {appointmentApiError ? (
            <View style={[styles.errorCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={[styles.errorIconContainer, { backgroundColor: theme.error + "20" }]}>
                <Feather name="alert-circle" size={32} color={theme.error} />
              </View>
              <ThemedText type="body" style={{ textAlign: "center", marginTop: Spacing.md, fontWeight: "600" }}>
                Unable to book appointment right now
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
                Please click the Call button to book your appointment
              </ThemedText>
              <Pressable
                style={[styles.callButton, { backgroundColor: theme.success }]}
                onPress={handleCallSupport}
                testID="button-call-support"
              >
                <Feather name="phone" size={20} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                  Call
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
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
            </>
          )}

          {!appointmentApiError ? (
            <>
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
            </>
          ) : null}

          {selectedAppointment && !appointmentApiError ? (
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

      {!appointmentApiError ? (
        <Button
          onPress={handleSubmit}
          disabled={!selectedJob || !selectedAppointment || isSubmitting}
          style={styles.submitButton}
          testID="button-submit"
        >
          {isSubmitting ? "Booking..." : "Make Booking"}
        </Button>
      ) : null}
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
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
  errorCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  errorIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
});

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  FlatList,
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
  availableTime: string;
  engineerid: number;
  serviceWindowName?: string;
}

interface ServiceCategory {
  name: string;
  icon: keyof typeof Feather.glyphMap;
  services: JobDescription[];
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
  // The server resolves each reminder to a service type via one of several
  // strategies: "exact" (direct job back-link), "frequency-history" (most
  // common service type), or "paired-history" (deterministic N-to-N match).
  // All three produce a specific jobdescriptionid we can trust — skip
  // straight to appointments. Only "unknown" (no match at all) forces
  // the customer to pick from the full service list.
  const typeSource = route.params?.serviceTypeSource;
  const autoAdvanceToAppointments =
    typeSource === "exact" ||
    typeSource === "frequency-history" ||
    typeSource === "paired-history";

  const [step, setStep] = useState<"select" | "appointments" | "confirm">(
    autoAdvanceToAppointments && (preselectedId || serviceName || serviceReminderId)
      ? "appointments"
      : "select",
  );
  // Show a yellow confirmation banner on the service picker when we arrived
  // here from a reminder whose type we guessed rather than resolved.
  const showUnverifiedTypeWarning =
    (preselectedId || serviceName || serviceReminderId) && !autoAdvanceToAppointments;
  const [allServices, setAllServices] = useState<JobDescription[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobDescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedAppointments, setSuggestedAppointments] = useState<SuggestedAppointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<SuggestedAppointment | null>(null);
  const [appointmentApiError, setAppointmentApiError] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const SUPPORT_PHONE = "+441925234450";

  const handleCallSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
  };

  const getServiceIcon = (description: string): keyof typeof Feather.glyphMap => {
    const lower = description.toLowerCase();
    if (lower.includes("solar") || lower.includes("pv")) return "sun";
    if (lower.includes("ev") || lower.includes("charger")) return "battery-charging";
    if (lower.includes("heat pump") || lower.includes("ashp")) return "thermometer";
    if (lower.includes("battery") || lower.includes("storage")) return "battery";
    if (lower.includes("boiler") || lower.includes("heating")) return "thermometer";
    if (lower.includes("gas") || lower.includes("gsc") || lower.includes("cp12")) return "wind";
    if (lower.includes("electric") || lower.includes("eicr")) return "zap";
    if (lower.includes("plumb")) return "droplet";
    if (lower.includes("air con") || lower.includes("ac ") || lower.includes("mvhr")) return "wind";
    if (lower.includes("cylinder")) return "disc";
    if (lower.includes("fire")) return "alert-triangle";
    if (lower.includes("diagnostic")) return "search";
    if (lower.includes("pat")) return "check-square";
    if (lower.includes("powerflush")) return "refresh-cw";
    if (lower.includes("quotation") || lower.includes("quote")) return "file-text";
    return "tool";
  };

  const getCategoryName = (description: string): string => {
    const lower = description.toLowerCase();
    if (lower.includes("solar") || lower.includes("pv")) return "Solar PV";
    if (lower.includes("ev") || lower.includes("charger")) return "EV Chargers";
    if (lower.includes("heat pump") || lower.includes("ashp")) return "Heat Pumps";
    if (lower.includes("battery") || lower.includes("storage")) return "Battery Storage";
    if (lower.includes("air con") || lower.includes("ac ") || lower.includes("mvhr")) return "Air Conditioning";
    if (lower.includes("eicr") || lower.includes("electrical installation")) return "Electrical";
    if (lower.includes("pat")) return "Electrical";
    if (lower.includes("boiler") && lower.includes("service")) return "Boiler Servicing";
    if (lower.includes("boiler") && lower.includes("diagnostic")) return "Diagnostics";
    if (lower.includes("gas") || lower.includes("gsc") || lower.includes("cp12")) return "Gas Safety";
    if (lower.includes("fire")) return "Fire Safety";
    if (lower.includes("cylinder")) return "Cylinder Servicing";
    if (lower.includes("powerflush")) return "Powerflush";
    if (lower.includes("plumb")) return "Plumbing";
    if (lower.includes("diagnostic")) return "Diagnostics";
    if (lower.includes("quotation") || lower.includes("quote")) return "Quotations";
    if (lower.includes("commercial")) return "Commercial";
    return "Other";
  };

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        new URL("/api/commusoft/jobdescriptions", getApiUrl()).toString()
      );
      if (response.ok) {
        const data = await response.json();
        const descriptions: JobDescription[] = (data.jobdescription || [])
          .filter((jd: JobDescription) => jd.appearinwebbooking || jd.appearincustomerlogin);

        setAllServices(descriptions);

        // Group into categories
        const categoryMap = new Map<string, JobDescription[]>();
        descriptions.forEach((jd) => {
          const cat = getCategoryName(jd.description);
          if (!categoryMap.has(cat)) categoryMap.set(cat, []);
          categoryMap.get(cat)!.push(jd);
        });

        const cats: ServiceCategory[] = Array.from(categoryMap.entries()).map(([name, services]) => ({
          name,
          icon: getServiceIcon(services[0].description),
          services,
        }));
        setCategories(cats);

        // Resolve the preselected job without auto-advancing when the type
        // source is a guess. The selected job is still highlighted on the
        // picker so the customer can confirm in one tap, but we refuse to
        // create diary entries automatically from an unverified match.
        if (preselectedId) {
          const matched = descriptions.find((jd) => jd.id === preselectedId);
          if (matched) {
            setSelectedJob(matched);
            if (autoAdvanceToAppointments) {
              await loadAppointments(matched);
            }
            return;
          }
        }

        // Fall back to a name search if no id was supplied.
        if (serviceName) {
          const matched = descriptions.find((jd) =>
            jd.description.toLowerCase().includes(serviceName.toLowerCase()) ||
            serviceName.toLowerCase().includes(jd.description.toLowerCase())
          );
          if (matched) {
            setSelectedJob(matched);
            if (autoAdvanceToAppointments) {
              await loadAppointments(matched);
            }
            return;
          }
        }
      }
    } catch (error) {
      console.error("Failed to load services:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAppointments = async (job: JobDescription) => {
    setStep("appointments");
    setIsLoading(true);
    setAppointmentApiError(false);
    setSuggestedAppointments([]);
    setSelectedAppointment(null);

    try {
      const slots = await fetchAppointments(job.id, job.timetocomplete, selectedProperty?.id);
      if (slots && slots.length > 0) {
        setSuggestedAppointments(slots);
      } else {
        setAppointmentApiError(true);
      }
    } catch {
      setAppointmentApiError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAppointments = async (jobDescriptionId: number, duration: number, propertyId: string | undefined): Promise<SuggestedAppointment[] | null> => {
    try {
      const appointmentsResponse = await fetch(
        new URL("/api/commusoft/suggested-appointments", getApiUrl()).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobdescriptionid: jobDescriptionId,
            duration: duration,
            propertyid: propertyId,
            customerid: user?.accountNumber,
            dateRange: 28,
          }),
        }
      );

      if (!appointmentsResponse.ok) return null;

      const data = await appointmentsResponse.json();
      const appointments = data.appointments || {};
      const slots: SuggestedAppointment[] = [];

      for (const [dateKey, dateSlots] of Object.entries(appointments)) {
        const slotsArray = dateSlots as any[];
        if (!slotsArray || slotsArray.length === 0) continue;

        for (const slot of slotsArray) {
          const availableTime = slot.availableTime || "";
          const [startStr, endStr] = availableTime.split(" - ").map((s: string) => s.trim());
          if (!startStr || !endStr) continue;

          const datePart = dateKey.split(" ")[0];

          slots.push({
            date: datePart,
            starttime: startStr,
            endtime: endStr,
            availableTime,
            engineerid: slot.engineerId,
            serviceWindowName: slot.serviceWindowName,
          });
        }
      }

      return slots.length > 0 ? slots.slice(0, 10) : null;
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      return null;
    }
  };

  const selectService = (job: JobDescription) => {
    setSelectedJob(job);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadAppointments(job);
  };

  const [bookingError, setBookingError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedJob || !selectedAppointment || !selectedProperty) return;

    setIsSubmitting(true);
    setBookingError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const accountNumber = user?.accountNumber;
      if (!accountNumber) throw new Error("No account number");

      const startDateTime = `${selectedAppointment.date} ${selectedAppointment.starttime}:00`;
      const endDateTime = `${selectedAppointment.date} ${selectedAppointment.endtime}:00`;

      // Commusoft job creation: the property ID goes in the URL path
      // (/customers/{propertyId}/jobs) — NOT in the body. The body only
      // accepts the fields listed in the API validation children:
      //   contactid, description, isservicejob, servicereminderinstances,
      //   quotedamount, startdatetime, enddatetime, engineernotes, ponumber,
      //   invoicecategoryid, additionalcontactid, priority, uuid, id,
      //   usergroupsid, customerContract, expectedcompletedondatetime.
      //
      // For service jobs (isservicejob=true) the servicereminderinstances
      // field is mandatory. Values must be an array of NEGATIVE string IDs
      // referencing the propertyservicereminders instance table. A positive
      // value references the settings_servicereminders type table instead.

      // The property/workaddress is the URL path, not a body field.
      const propertyId = selectedProperty.id || accountNumber;

      // Fetch contactid from the customer record at booking time — the
      // user object doesn't store it.
      let contactId = "";
      try {
        const custResp = await fetch(
          new URL(`/api/commusoft/customer/${propertyId}`, getApiUrl()).toString()
        );
        if (custResp.ok) {
          const custData = await custResp.json();
          const cust = custData.Customer || custData;
          contactId = String(cust.contactid || "");
        }
      } catch {}

      const isServiceJob = !!serviceReminderId;
      const jobBody: Record<string, any> = {
        uuid: crypto.randomUUID(),
        description: selectedJob.description,
        contactid: contactId,
        isservicejob: isServiceJob,
        priority: "Medium_Importance",
        startdatetime: startDateTime,
        enddatetime: endDateTime,
        engineernotes: notes.trim() || undefined,
      };

      if (isServiceJob && serviceReminderId) {
        // Negative = instance ID from propertyservicereminders table
        jobBody.servicereminderinstances = [String(-serviceReminderId)];
      }

      const response = await fetch(
        new URL(`/api/commusoft/customer/${propertyId}/jobs`, getApiUrl()).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job: jobBody }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Booking failed (${response.status})`);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSubmitting(false);
      setBookingSuccess(true);
    } catch (error: any) {
      console.error("Failed to book service:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsSubmitting(false);
      setBookingError(error.message || "Booking failed. Please try again or call us on 01925 234450.");
    }
  };

  const formatPrice = (price: number) => price > 0 ? `£${price.toFixed(2)}` : "Free quote";

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
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
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

  if (isLoading && step === "select") {
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
        <ThemedText type="h3" style={{ marginTop: Spacing.xl, textAlign: "center" }}>
          Booking Confirmed
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
          Your {selectedJob?.description} has been scheduled for{" "}
          {selectedAppointment ? formatAppointmentDate(selectedAppointment.date) : ""}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.lg, textAlign: "center" }}>
          We'll send you a confirmation shortly
        </ThemedText>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.doneButton, { backgroundColor: theme.primary }]}
        >
          <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>Done</ThemedText>
        </Pressable>
      </View>
    );
  }

  // Step 1: Service picker
  if (step === "select") {
    return (
      <KeyboardAwareScrollViewCompat
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
      >
        {selectedProperty ? (
          <View style={[styles.propertyBanner, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="map-pin" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, flex: 1 }}>
              {selectedProperty.addressLine1}, {selectedProperty.postcode}
            </ThemedText>
          </View>
        ) : null}

        {showUnverifiedTypeWarning ? (
          <View
            style={{
              backgroundColor: "#FEF3C7",
              borderColor: "#FCD34D",
              borderWidth: 1,
              borderRadius: BorderRadius.md,
              padding: Spacing.md,
              marginBottom: Spacing.lg,
              flexDirection: "row",
              alignItems: "flex-start",
            }}
          >
            <Feather name="alert-triangle" size={18} color="#92400E" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText type="small" style={{ fontWeight: "700", color: "#92400E" }}>
                Please confirm the service type
              </ThemedText>
              <ThemedText type="small" style={{ color: "#78350F", marginTop: 2, fontSize: 12 }}>
                {serviceName
                  ? `This reminder is for “${serviceName}” — tap to confirm, or choose a different service below.`
                  : "Tap the correct service below to continue."}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <ThemedText type="h3" style={{ marginBottom: Spacing.lg }}>
          What do you need?
        </ThemedText>

        {categories.map((cat) => (
          <View key={cat.name} style={{ marginBottom: Spacing.lg }}>
            <View style={styles.categoryHeader}>
              <Feather name={cat.icon} size={18} color={theme.primary} />
              <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>
                {cat.name}
              </ThemedText>
            </View>
            {cat.services.map((service) => (
              <Pressable
                key={service.id}
                style={[styles.serviceRow, { backgroundColor: theme.backgroundDefault }, Shadows.small]}
                onPress={() => selectService(service)}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "500" }}>
                    {service.description.replace("Domestic - ", "").replace("Domestic  -  ", "").replace("Commercial - ", "")}
                  </ThemedText>
                  <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs }}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {formatDuration(service.timetocomplete)}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                      {formatPrice(service.price)}
                    </ThemedText>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            ))}
          </View>
        ))}
      </KeyboardAwareScrollViewCompat>
    );
  }

  // Step 2: Appointment selection
  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {/* Always allow changing the service when the entry was a guess, or
          when there was no preselection at all. Only hide the back link for
          exact-match reminders where we're certain the type is right. */}
      {!preselectedId || !autoAdvanceToAppointments ? (
        <Pressable onPress={() => { setStep("select"); setSelectedJob(null); }} style={styles.backLink}>
          <Feather name="arrow-left" size={16} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
            Change service
          </ThemedText>
        </Pressable>
      ) : null}

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
                {selectedJob.description}
              </ThemedText>
              <View style={styles.serviceMeta}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {formatDuration(selectedJob.timetocomplete)}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                  {formatPrice(selectedJob.price)}
                </ThemedText>
              </View>
            </View>
          </View>

          {isLoading ? (
            <View style={{ padding: Spacing.xl, alignItems: "center" }}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
                Finding available appointments...
              </ThemedText>
            </View>
          ) : appointmentApiError ? (
            <View style={[styles.errorCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={[styles.errorIconContainer, { backgroundColor: theme.error + "20" }]}>
                <Feather name="alert-circle" size={32} color={theme.error} />
              </View>
              <ThemedText type="body" style={{ textAlign: "center", marginTop: Spacing.md, fontWeight: "600" }}>
                No availability online
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
                No appointments available in the next 4 weeks for this service. Please call us and we'll arrange a time that works for you.
              </ThemedText>
              <Pressable
                style={[styles.callButton, { backgroundColor: theme.success }]}
                onPress={handleCallSupport}
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
                        isSelected && { borderColor: theme.primary, borderWidth: 2 },
                        Shadows.small,
                      ]}
                      onPress={() => {
                        setSelectedAppointment(apt);
                        Haptics.selectionAsync();
                      }}
                    >
                      <ThemedText type="body" style={[styles.appointmentDate, isSelected && { color: theme.primary }]}>
                        {formatAppointmentDate(apt.date)}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {apt.availableTime || formatAppointmentTime(apt.starttime, apt.endtime)}
                      </ThemedText>
                      {apt.serviceWindowName ? (
                        <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}>
                          {apt.serviceWindowName}
                        </ThemedText>
                      ) : null}
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
              />

              {selectedAppointment ? (
                <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Booking Summary
                  </ThemedText>
                  <View style={styles.summaryRow}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Service:</ThemedText>
                    <ThemedText type="small" numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>
                      {selectedJob.description}
                    </ThemedText>
                  </View>
                  <View style={styles.summaryRow}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Appointment:</ThemedText>
                    <ThemedText type="small">
                      {formatAppointmentDate(selectedAppointment.date)} {selectedAppointment.availableTime}
                    </ThemedText>
                  </View>
                  <View style={styles.summaryRow}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Price:</ThemedText>
                    <ThemedText type="body" style={{ color: theme.primary, fontWeight: "600" }}>
                      {formatPrice(selectedJob.price)}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {bookingError ? (
                <View style={{ backgroundColor: "#FEE2E2", padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md }}>
                  <ThemedText type="small" style={{ color: "#DC2626" }}>{bookingError}</ThemedText>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={!selectedAppointment || !selectedProperty || isSubmitting}
                style={[
                  styles.submitButton,
                  { backgroundColor: selectedAppointment && selectedProperty && !isSubmitting ? theme.primary : theme.backgroundSecondary },
                ]}
              >
                <ThemedText type="body" style={{ color: selectedAppointment && selectedProperty ? "#FFFFFF" : theme.textSecondary, fontWeight: "600" }}>
                  {isSubmitting ? "Booking..." : "Confirm Booking"}
                </ThemedText>
              </Pressable>
            </>
          )}
        </>
      ) : null}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  successContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing.xl },
  successIcon: { width: 120, height: 120, borderRadius: 60, justifyContent: "center", alignItems: "center" },
  doneButton: { marginTop: Spacing.xl, paddingHorizontal: Spacing["2xl"], paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  propertyBanner: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  categoryHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  serviceRow: { flexDirection: "row", alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  backLink: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  serviceCard: { flexDirection: "row", alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  serviceIconContainer: { width: 56, height: 56, borderRadius: BorderRadius.md, justifyContent: "center", alignItems: "center", marginRight: Spacing.md },
  serviceInfo: { flex: 1 },
  serviceMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.xs },
  appointmentsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  appointmentCard: { padding: Spacing.md, borderRadius: BorderRadius.md, minWidth: 140, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  appointmentDate: { fontWeight: "600", marginBottom: Spacing.xs },
  label: { fontWeight: "600", marginBottom: Spacing.md, marginTop: Spacing.lg },
  textArea: { height: 80, textAlignVertical: "top", paddingTop: Spacing.md },
  summaryCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, marginTop: Spacing.lg, gap: Spacing.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  submitButton: { marginTop: Spacing.xl, paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, alignItems: "center" },
  errorCard: { padding: Spacing.xl, borderRadius: BorderRadius.md, alignItems: "center", marginTop: Spacing.lg },
  errorIconContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  callButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
});

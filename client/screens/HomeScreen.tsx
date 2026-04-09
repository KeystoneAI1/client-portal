import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { PropertySelector } from "@/components/PropertySelector";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useProperty } from "@/lib/propertyContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { storage, ServicePlan, Job, Invoice } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

interface ServiceReminder {
  id: number;
  name: string;
  settingsjobdescriptionid: number;
  serviceperiod: number;
  // "exact" = reminder has a back-linked job with known jobdescriptionid,
  // so we're confident the label is correct and can auto-book.
  // "frequency-history" = we inferred the type from the customer's history;
  // safe enough to display, but booking must require confirmation.
  // "unknown" = no label available, show generic and force manual pick.
  typeSource: "exact" | "frequency-history" | "paired-history" | "unknown";
}

interface ServiceStatus {
  reminder: ServiceReminder;
  isDue: boolean;
  nextDueDate: Date | null;
  lastServiceDate: Date | null;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const openLink = (url: string) => {
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  } else {
    Linking.openURL(url);
  }
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { selectedProperty, refreshProperties } = useProperty();
  const navigation = useNavigation<NavigationProp>();

  const [refreshing, setRefreshing] = useState(false);
  const [activePlan, setActivePlan] = useState<ServicePlan | null>(null);
  const [upcomingJob, setUpcomingJob] = useState<Job | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const loadServiceReminders = useCallback(async () => {
    // Query against the SELECTED property — Commusoft treats workaddresses
    // as queryable customers, so each property has its own reminder feed.
    const propertyId = selectedProperty?.id || user?.accountNumber || user?.id;
    if (!propertyId) return;

    try {
      const propertyRemindersResponse = await fetch(
        new URL(`/api/commusoft/customer/${propertyId}/propertyservicereminders`, getApiUrl()).toString()
      );

      const now = new Date();
      const statuses: ServiceStatus[] = [];

      if (propertyRemindersResponse.ok) {
        const propData = await propertyRemindersResponse.json();
        const propReminders = propData.servicereminder || [];

        for (const pr of propReminders) {
          const dueDate = pr.duedate ? new Date(pr.duedate) : null;
          const reminderDate = pr.reminderdate ? new Date(pr.reminderdate) : null;
          const isOverdue = dueDate ? dueDate.getTime() < now.getTime() : false;

          // Server has already enriched with serviceTypeName / settingsjobdescriptionid
          // by joining against the customer's job history. If the join didn't find
          // a match, we leave the label generic instead of inventing one.
          const serviceName: string =
            pr.serviceTypeName ||
            pr.contractName ||
            "Service Reminder";
          const jobDescId: number = Number(pr.settingsjobdescriptionid) || 0;
          const typeSource: "exact" | "frequency-history" | "paired-history" | "unknown" =
            pr.serviceTypeSource === "exact" ||
            pr.serviceTypeSource === "frequency-history" ||
            pr.serviceTypeSource === "paired-history"
              ? pr.serviceTypeSource
              : "unknown";

          statuses.push({
            reminder: {
              id: pr.id,
              name: serviceName,
              settingsjobdescriptionid: jobDescId,
              serviceperiod: 12,
              typeSource,
            },
            isDue: isOverdue,
            nextDueDate: dueDate,
            lastServiceDate: reminderDate,
          });
        }
      }

      statuses.sort((a, b) => {
        if (a.isDue && !b.isDue) return -1;
        if (!a.isDue && b.isDue) return 1;
        const dateA = a.nextDueDate?.getTime() || 0;
        const dateB = b.nextDueDate?.getTime() || 0;
        return dateA - dateB;
      });

      setServiceStatuses(statuses);
    } catch (error) {
      console.error("Failed to load service reminders:", error);
    }
  }, [user, selectedProperty]);

  const loadData = useCallback(async () => {
    // Query the SELECTED property as a customer ID — workaddresses are
    // queryable like customers in Commusoft, so this returns only the
    // selected property's jobs and service plans.
    const propertyId = selectedProperty?.id || user?.accountNumber || user?.id;
    if (!propertyId) return;

    try {
      const jobsResponse = await fetch(
        new URL(`/api/commusoft/customer/${propertyId}/jobs`, getApiUrl()).toString()
      );
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        const jobs = jobsData.Jobs || jobsData.jobs || [];
        const ongoingJobs = jobs.filter((j: any) => {
          const status = (j.status || "").toLowerCase();
          return status === "ongoing" && !j.isJobDeleted;
        });

        if (ongoingJobs.length > 0) {
          const nextJob = ongoingJobs[0];
          let scheduledDate: string | null = null;
          try {
            const apptResponse = await fetch(
              new URL(`/api/commusoft/jobs/${nextJob.id}/appointments`, getApiUrl()).toString()
            );
            if (apptResponse.ok) {
              const apptData = await apptResponse.json();
              const appointments = apptData.appointments || apptData.diaryevents || apptData || [];
              if (Array.isArray(appointments) && appointments.length > 0) {
                scheduledDate = appointments[0].start || appointments[0].startdate || appointments[0].date || null;
              }
            }
          } catch {}

          setUpcomingJob({
            id: nextJob.id,
            description: nextJob.description || "Scheduled Service",
            scheduledDate,
            status: "in_progress",
            engineerName: nextJob.engineername || "",
            property: "",
          });
        } else {
          setUpcomingJob(null);
        }
      }
    } catch {
      setUpcomingJob(null);
    }

    try {
      const customerResponse = await fetch(
        new URL(`/api/commusoft/customer/${propertyId}`, getApiUrl()).toString()
      );
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        const servicePlans = customerData.Customer?.servicePlans || [];
        if (servicePlans.length > 0) {
          const now = new Date();
          const activePlanData = servicePlans.find((p: any) => {
            const expireDate = p.expiredate ? new Date(p.expiredate) : null;
            const disabled = p.isServicePlanDisable === true;
            return !disabled && (!expireDate || expireDate > now);
          }) || servicePlans[0];
          setActivePlan({
            id: activePlanData.id || "plan-1",
            name: activePlanData.description || activePlanData.name || "Service Plan",
            status: activePlanData.isServicePlanDisable ? "expired" : "active",
            startDate: new Date().toISOString(),
            endDate: activePlanData.expiredate || new Date().toISOString(),
            coverage: [],
            price: 0,
          });
        } else {
          setActivePlan(null);
        }
      }
    } catch {
      setActivePlan(null);
    }

    const invoices = await storage.getInvoices();
    setPendingInvoices(invoices.filter((i) => i.status === "pending" || i.status === "overdue"));
  }, [user, selectedProperty]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const response = await fetch(new URL("/api/announcements", getApiUrl()).toString());
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.announcements || []);
      }
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadServiceReminders();
      loadAnnouncements();
    }, [loadData, loadServiceReminders, loadAnnouncements]),
  );

  React.useEffect(() => {
    if (selectedProperty) {
      loadData();
      loadServiceReminders();
    }
  }, [selectedProperty?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadServiceReminders(), loadAnnouncements(), refreshProperties()]);
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  // Filter announcements: show only top priority offer/warning, not all 7
  const topAnnouncement = announcements.find((a) => a.type === "warning") || announcements.find((a) => a.type === "offer");

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.fixedHeader, {
        paddingTop: insets.top + Spacing.md,
        backgroundColor: theme.backgroundRoot,
        borderBottomColor: theme.border,
      }]}>
        <Image
          source={require("../assets/images/aquila-full-logo.png")}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <ThemedText type="h3" style={styles.headerTitle}>Client Portal</ThemedText>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Greeting */}
        <ThemedText type="h2">
          {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
        </ThemedText>

        <View style={styles.propertySelector}>
          <PropertySelector />
        </View>

        {/* Top Priority Banner — only the most urgent announcement */}
        {topAnnouncement ? (
          <Pressable
            onPress={() => topAnnouncement.link && openLink(topAnnouncement.link)}
            style={[
              styles.topBanner,
              {
                backgroundColor: topAnnouncement.type === "warning" ? "#FEF3C7" : "#D1FAE5",
                borderColor: topAnnouncement.type === "warning" ? "#FCD34D" : "#6EE7B7",
              },
            ]}
          >
            <View style={styles.topBannerContent}>
              <Feather
                name={topAnnouncement.type === "warning" ? "alert-circle" : "tag"}
                size={20}
                color={topAnnouncement.type === "warning" ? "#92400E" : "#047857"}
              />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <ThemedText type="small" style={{ fontWeight: "700", color: topAnnouncement.type === "warning" ? "#92400E" : "#047857" }}>
                  {topAnnouncement.title}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2, fontSize: 12 }}>
                  {topAnnouncement.message}
                </ThemedText>
              </View>
              {topAnnouncement.link ? (
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              ) : null}
            </View>
          </Pressable>
        ) : null}

        {/* YOUR SERVICES — primary content */}
        <ThemedText type="h3" style={styles.sectionHeading}>Your Services</ThemedText>

        {serviceStatuses.length > 0 ? (
          serviceStatuses.map((status) => {
            const isOverdue = status.isDue;
            return (
              <Pressable
                key={status.reminder.id}
                style={[
                  styles.serviceCard,
                  { backgroundColor: theme.backgroundDefault },
                  isOverdue && styles.serviceCardOverdue,
                  Shadows.small,
                ]}
                onPress={() =>
                  navigation.navigate("BookService", {
                    preselectedJobDescriptionId: status.reminder.settingsjobdescriptionid || undefined,
                    serviceName: status.reminder.name,
                    serviceReminderId: status.reminder.id,
                    serviceTypeSource: status.reminder.typeSource,
                  })
                }
              >
                <View style={[styles.serviceIconBox, { backgroundColor: isOverdue ? "#FEE2E2" : theme.primary + "15" }]}>
                  <Feather
                    name={isOverdue ? "alert-triangle" : "calendar"}
                    size={22}
                    color={isOverdue ? "#DC2626" : theme.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={styles.serviceCardTitle}>
                    {status.reminder.name}
                  </ThemedText>
                  {isOverdue ? (
                    <>
                      <ThemedText type="small" style={styles.overdueLabel}>
                        OVERDUE — WARRANTY AT RISK
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                        Was due {status.nextDueDate ? formatDate(status.nextDueDate) : "—"}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Due {status.nextDueDate ? formatDate(status.nextDueDate) : "soon"}
                    </ThemedText>
                  )}
                </View>
                <Feather name="chevron-right" size={20} color={isOverdue ? "#DC2626" : theme.textSecondary} />
              </Pressable>
            );
          })
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundDefault }, Shadows.small]}>
            <Feather name="check-circle" size={28} color="#10B981" />
            <ThemedText type="body" style={{ fontWeight: "600", marginTop: Spacing.sm }}>
              All Up To Date
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
              No services due right now
            </ThemedText>
          </View>
        )}

        {/* BOOK A SERVICE — general entry point to full service list */}
        <Pressable
          style={[styles.serviceCard, { backgroundColor: theme.primary }, Shadows.small]}
          onPress={() => navigation.navigate("BookService")}
        >
          <View style={[styles.serviceIconBox, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Feather name="plus-circle" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="body" style={[styles.serviceCardTitle, { color: "#FFFFFF" }]}>
              Book a Service
            </ThemedText>
            <ThemedText type="small" style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
              View all available services and appointment times
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
        </Pressable>

        {/* UPCOMING JOB */}
        {upcomingJob ? (
          <>
            <ThemedText type="h3" style={styles.sectionHeading}>Upcoming Appointment</ThemedText>
            <Pressable
              style={[styles.serviceCard, { backgroundColor: theme.backgroundDefault }, Shadows.small]}
              onPress={() => navigation.navigate("JobDetail", { jobId: upcomingJob.id })}
            >
              <View style={[styles.serviceIconBox, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="tool" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={styles.serviceCardTitle}>
                  {upcomingJob.description}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {upcomingJob.scheduledDate ? `Scheduled ${formatDate(new Date(upcomingJob.scheduledDate))}` : "Date to be confirmed"}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          </>
        ) : null}

        {/* ACTIVE PLAN */}
        {activePlan ? (
          <>
            <ThemedText type="h3" style={styles.sectionHeading}>Service Plan</ThemedText>
            <Pressable
              style={[styles.serviceCard, { backgroundColor: theme.backgroundDefault }, Shadows.small]}
              onPress={() =>
                navigation.navigate("ServicePlanDetail", {
                  planId: activePlan.id,
                  planName: activePlan.name,
                  planStatus: activePlan.status,
                  planStartDate: activePlan.startDate,
                  planEndDate: activePlan.endDate,
                })
              }
            >
              <View style={[styles.serviceIconBox, { backgroundColor: "#DCFCE7" }]}>
                <Feather name="shield" size={22} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={styles.serviceCardTitle}>
                  {activePlan.name}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Active until {formatDate(new Date(activePlan.endDate))}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          </>
        ) : null}

        {/* EXPLORE — combined section, only at the bottom */}
        <ThemedText type="h3" style={styles.sectionHeading}>Get a Free Quote</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          Book a free, no-obligation video survey
        </ThemedText>

        {[
          {
            icon: "sun" as const,
            title: "Solar + Battery",
            subtitle: "Cut energy bills by up to 70%",
            color: "#F59E0B",
            bgColor: "#FEF3C7",
            link: "https://cal.keystoneai.tech/lee/solar-video-survey",
          },
          {
            icon: "battery-charging" as const,
            title: "EV Charger",
            subtitle: "OZEV approved — £350 grant",
            color: "#10B981",
            bgColor: "#D1FAE5",
            link: "https://cal.keystoneai.tech/lee/ev-charger-video-call",
          },
          {
            icon: "thermometer" as const,
            title: "Heat Pump",
            subtitle: "MCS certified — £7,500 BUS grant",
            color: "#3B82F6",
            bgColor: "#DBEAFE",
            link: "https://cal.keystoneai.tech/phil/ashp-video-survey",
          },
          {
            icon: "droplet" as const,
            title: "New Boiler",
            subtitle: "Free home survey, finance available",
            color: "#EF4444",
            bgColor: "#FEE2E2",
            link: "https://cal.keystoneai.tech/phil/boiler-home-survey",
          },
        ].map((item) => (
          <Pressable
            key={item.title}
            style={[styles.quoteCard, { backgroundColor: theme.backgroundDefault }, Shadows.small]}
            onPress={() => openLink(item.link)}
          >
            <View style={[styles.serviceIconBox, { backgroundColor: item.bgColor }]}>
              <Feather name={item.icon} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={styles.serviceCardTitle}>{item.title}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                {item.subtitle}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        ))}

        {/* REFER A FRIEND */}
        <Pressable style={[styles.referralBanner, { backgroundColor: theme.primary }]}>
          <Feather name="gift" size={28} color="#FFFFFF" />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText type="body" style={{ fontWeight: "700", color: "#FFFFFF" }}>
              Refer a Friend
            </ThemedText>
            <ThemedText type="small" style={{ color: "#FFFFFF", opacity: 0.9, fontSize: 12, marginTop: 2 }}>
              You both get £100 off your next service
            </ThemedText>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerLogo: {
    width: 120,
    height: 42,
  },
  headerTitle: {
    fontWeight: "600",
  },
  scrollContent: {
    flex: 1,
  },
  propertySelector: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  topBanner: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  topBannerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeading: {
    fontWeight: "700",
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  serviceCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
  },
  serviceCardTitle: {
    fontWeight: "600",
  },
  serviceIconBox: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  overdueLabel: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  quoteCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  referralBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
});

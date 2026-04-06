import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { SectionHeader } from "@/components/SectionHeader";
import { QuickActionCard } from "@/components/QuickActionCard";
import { SummaryCard } from "@/components/SummaryCard";
import { PropertySelector } from "@/components/PropertySelector";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useProperty } from "@/lib/propertyContext";
import { Spacing } from "@/constants/theme";
import { storage, ServicePlan, Job, Invoice } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

interface ServiceReminder {
  id: number;
  name: string;
  settingsjobdescriptionid: number;
  serviceperiod: number;
}

interface ServiceStatus {
  reminder: ServiceReminder;
  isDue: boolean;
  nextDueDate: Date | null;
  lastServiceDate: Date | null;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
    const customerId = user?.accountNumber || user?.id;
    if (!customerId) return;

    try {
      // Load customer's actual property service reminders from Commusoft
      const [propertyRemindersResponse, systemRemindersResponse] = await Promise.all([
        fetch(new URL(`/api/commusoft/customer/${customerId}/propertyservicereminders`, getApiUrl()).toString()),
        fetch(new URL("/api/commusoft/servicereminders", getApiUrl()).toString()),
      ]);

      const now = new Date();
      const statuses: ServiceStatus[] = [];

      // Try property-specific reminders first (real customer data)
      if (propertyRemindersResponse.ok) {
        const propData = await propertyRemindersResponse.json();
        const propReminders = propData.servicereminder || [];

        // Get system reminders for job description mapping
        let systemReminders: ServiceReminder[] = [];
        if (systemRemindersResponse.ok) {
          systemReminders = (await systemRemindersResponse.json()).servicereminders || [];
        }

        for (const pr of propReminders) {
          const dueDate = pr.duedate ? new Date(pr.duedate) : null;
          const reminderDate = pr.reminderdate ? new Date(pr.reminderdate) : null;
          const isOverdue = dueDate ? dueDate < now : false;
          const status = pr.status || "";

          // Find matching system reminder for job description ID
          const matchingSystemReminder = systemReminders.find((sr: ServiceReminder) => sr.id === pr.settingsserviceremindersid);

          statuses.push({
            reminder: {
              id: pr.id,
              name: matchingSystemReminder?.name || pr.description || "Service",
              settingsjobdescriptionid: matchingSystemReminder?.settingsjobdescriptionid || 0,
              serviceperiod: matchingSystemReminder?.serviceperiod || 12,
            },
            isDue: isOverdue || status === "due_not_booked",
            nextDueDate: dueDate,
            lastServiceDate: reminderDate,
          });
        }
      }

      // Sort: overdue first, then by due date
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
    const customerId = user?.accountNumber || user?.id;
    console.log("[HomeScreen] Loading data for customer:", customerId);
    
    if (customerId) {
      // Load upcoming appointments from jobs with ongoing status
      // Note: Commusoft API doesn't have customer-facing diary events endpoint
      // So we check for jobs with status "ongoing" which indicates work in progress
      try {
        const jobsResponse = await fetch(
          new URL(`/api/commusoft/customer/${customerId}/jobs`, getApiUrl()).toString()
        );
        console.log("[HomeScreen] Jobs API response status:", jobsResponse.status);
        if (jobsResponse.ok) {
          const jobsData = await jobsResponse.json();
          const jobs = jobsData.Jobs || jobsData.jobs || [];
          
          // Find ongoing jobs (not completed yet)
          const ongoingJobs = jobs.filter((job: any) => {
            const status = (job.status || "").toLowerCase();
            return status === "ongoing" && !job.isJobDeleted;
          });
          
          console.log("[HomeScreen] Ongoing jobs found:", ongoingJobs.length);
          if (ongoingJobs.length > 0) {
            const nextJob = ongoingJobs[0];
            console.log("[HomeScreen] Next ongoing job:", nextJob.description);
            
            // Fetch job appointments to get actual scheduled date
            let scheduledDate: string | null = null;
            try {
              const apptResponse = await fetch(
                new URL(`/api/commusoft/jobs/${nextJob.id}/appointments`, getApiUrl()).toString()
              );
              if (apptResponse.ok) {
                const apptData = await apptResponse.json();
                console.log("[HomeScreen] Job appointments:", JSON.stringify(apptData).substring(0, 500));
                // Get the first future appointment date
                const appointments = apptData.appointments || apptData.diaryevents || apptData || [];
                if (Array.isArray(appointments) && appointments.length > 0) {
                  const firstAppt = appointments[0];
                  scheduledDate = firstAppt.start || firstAppt.start_date || firstAppt.startdate ||
                                  firstAppt.date || firstAppt.scheduleddate || null;
                }
              }
            } catch (apptError) {
              console.log("[HomeScreen] Could not fetch job appointments:", apptError);
            }
            
            setUpcomingJob({
              id: nextJob.id,
              description: nextJob.description || "Scheduled Service",
              scheduledDate: scheduledDate, // null if no real date found
              status: "in_progress",
              engineerName: nextJob.engineername || nextJob.engineerName || "",
              property: "",
            });
          } else {
            setUpcomingJob(null);
          }
        }
      } catch (error) {
        console.error("Failed to load jobs from API:", error);
        setUpcomingJob(null);
      }

      // Load service plans from customer data
      try {
        const customerResponse = await fetch(
          new URL(`/api/commusoft/customer/${customerId}`, getApiUrl()).toString()
        );
        console.log("[HomeScreen] Customer API response status:", customerResponse.status);
        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          console.log("[HomeScreen] Customer data servicePlans:", JSON.stringify(customerData.Customer?.servicePlans || []).substring(0, 500));
          const servicePlans = customerData.Customer?.servicePlans || [];
          
          if (servicePlans.length > 0) {
            // Find active plan (not expired)
            const now = new Date();
            const activePlanData = servicePlans.find((p: any) => {
              const expireDate = p.expiredate ? new Date(p.expiredate) : null;
              return !expireDate || expireDate > now;
            }) || servicePlans[0];
            
            setActivePlan({
              id: activePlanData.id || activePlanData.servicePlanId || "plan-1",
              name: activePlanData.description || activePlanData.name || "Service Plan",
              status: "active",
              startDate: new Date().toISOString(),
              endDate: activePlanData.expiredate || new Date().toISOString(),
              coverage: [],
              price: 0,
            });
          } else {
            setActivePlan(null);
          }
        }
      } catch (error) {
        console.error("Failed to load customer data from API:", error);
        setActivePlan(null);
      }
    }

    // Load invoices from local storage
    const invoices = await storage.getInvoices();
    const pending = invoices.filter(
      (i) => i.status === "pending" || i.status === "overdue",
    );
    setPendingInvoices(pending);
  }, [user, selectedProperty]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const response = await fetch(new URL("/api/announcements", getApiUrl()).toString());
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.announcements || []);
      }
    } catch {
      // Silent fail
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadServiceReminders();
      loadAnnouncements();
    }, [loadData, loadServiceReminders, loadAnnouncements]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshProperties()]);
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Fixed Header with Logo and Client Portal */}
      <View style={[styles.fixedHeader, { 
        paddingTop: insets.top + Spacing.md,
        backgroundColor: theme.backgroundRoot,
        borderBottomColor: theme.border,
      }]}>
        <Image
          source={require("../assets/images/aquila-logo.png")}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <ThemedText type="h3" style={styles.headerTitle}>Client Portal</ThemedText>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.greeting}>
          <ThemedText type="h2">
            {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.greetingSubtitle, { color: theme.textSecondary }]}
          >
            Here's your account overview
          </ThemedText>
          <View style={styles.propertySelector}>
            <PropertySelector />
          </View>
        </View>

      {announcements.length > 0 ? (
        <View style={{ marginBottom: Spacing.lg }}>
          {announcements.map((a) => {
            const colors: Record<string, { bg: string; border: string; icon: string }> = {
              offer: { bg: "#10B98115", border: "#10B98140", icon: "#10B981" },
              warning: { bg: "#EF444415", border: "#EF444440", icon: "#EF4444" },
              update: { bg: "#3B82F615", border: "#3B82F640", icon: "#3B82F6" },
              info: { bg: theme.primary + "10", border: theme.primary + "30", icon: theme.primary },
            };
            const c = colors[a.type] || colors.info;
            const icons: Record<string, keyof typeof Feather.glyphMap> = {
              offer: "tag", warning: "alert-circle", update: "bell", info: "info",
            };
            return (
              <View key={a.id} style={[styles.announcementCard, { backgroundColor: c.bg, borderColor: c.border }]}>
                <Feather name={icons[a.type] || "info"} size={20} color={c.icon} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText type="small" style={{ fontWeight: "700" }}>{a.title}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>{a.message}</ThemedText>
                  {a.linkText ? (
                    <Pressable onPress={() => navigation.navigate("BookService", {})} style={{ marginTop: Spacing.xs }}>
                      <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>{a.linkText} →</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <SectionHeader title="Your Services" />
      {serviceStatuses.length > 0 ? (
        serviceStatuses.map((status) => {
          const isOverdue = status.isDue;
          return (
            <Pressable
              key={status.reminder.id}
              style={[
                styles.serviceStatusCard,
                { backgroundColor: theme.backgroundDefault },
                isOverdue && { borderLeftWidth: 4, borderLeftColor: "#EF4444" },
              ]}
              onPress={() =>
                navigation.navigate("BookService", {
                  preselectedJobDescriptionId: status.reminder.settingsjobdescriptionid,
                  serviceName: status.reminder.name,
                  serviceReminderId: status.reminder.id,
                })
              }
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                  <Feather name={isOverdue ? "alert-triangle" : "clock"} size={18} color={isOverdue ? "#EF4444" : theme.primary} />
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {status.reminder.name}
                  </ThemedText>
                </View>
                {isOverdue ? (
                  <View style={{ marginTop: Spacing.xs }}>
                    <ThemedText type="small" style={{ color: "#EF4444", fontWeight: "700" }}>
                      OVERDUE — WARRANTY AT RISK
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                      {status.nextDueDate ? `Was due ${formatDate(status.nextDueDate.toISOString())}` : "Service needed"} — tap to book
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                    Due {status.nextDueDate ? formatDate(status.nextDueDate.toISOString()) : "soon"} — tap to book
                  </ThemedText>
                )}
              </View>
              <Feather name="chevron-right" size={20} color={isOverdue ? "#EF4444" : theme.textSecondary} />
            </Pressable>
          );
        })
      ) : (
        <SummaryCard
          icon="check-circle"
          title="All Services Up To Date"
          subtitle="No services due right now"
        />
      )}

      <SectionHeader title="Quick Actions" />
      <View style={styles.quickActions}>
        <QuickActionCard
          icon="calendar"
          title="Book Service"
          subtitle="Schedule"
          color={theme.accent}
          onPress={() => navigation.navigate("BookService", {})}
          testID="action-book-service"
        />
        <View style={styles.quickActionSpacer} />
        <QuickActionCard
          icon="message-circle"
          title="Ask Tech Agent"
          subtitle="Get help"
          color={theme.primary}
          onPress={() => navigation.navigate("Main", { screen: "AITab" })}
          testID="action-ask-vai"
        />
      </View>

      <SectionHeader
        title="Active Plans"
        actionLabel="View all"
        onAction={() => navigation.navigate("Main", { screen: "ServicesTab" })}
      />
      {activePlan ? (
        <SummaryCard
          icon="shield"
          title={activePlan.name}
          subtitle={`Valid until ${formatDate(activePlan.endDate)}`}
          status="active"
          onPress={() =>
            navigation.navigate("ServicePlanDetail", { 
              planId: activePlan.id,
              planName: activePlan.name,
              planStatus: activePlan.status,
              planStartDate: activePlan.startDate,
              planEndDate: activePlan.endDate
            })
          }
          testID="card-active-plan"
        />
      ) : (
        <SummaryCard
          icon="shield-off"
          title="No Active Plan"
          subtitle="Get covered with a service plan"
          onPress={() => navigation.navigate("Main", { screen: "ServicesTab" })}
        />
      )}

      <SectionHeader
        title="Upcoming Jobs"
        actionLabel="View all"
        onAction={() => navigation.navigate("Main", { screen: "ServicesTab" })}
      />
      {upcomingJob ? (
        <SummaryCard
          icon="tool"
          title={upcomingJob.description}
          subtitle={upcomingJob.scheduledDate ? `Scheduled for ${formatDate(upcomingJob.scheduledDate)}` : "Date to be confirmed"}
          status={upcomingJob.status as any}
          onPress={() =>
            navigation.navigate("JobDetail", { jobId: upcomingJob.id })
          }
          testID="card-upcoming-job"
        />
      ) : (
        <SummaryCard
          icon="check-circle"
          title="No Upcoming Jobs"
          subtitle="All caught up!"
        />
      )}

      {pendingInvoices.length > 0 ? (
        <>
          <SectionHeader
            title="Pending Invoices"
            actionLabel="View all"
            onAction={() => navigation.navigate("Main", { screen: "ServicesTab" })}
          />
          <SummaryCard
            icon="file-text"
            title={`${pendingInvoices.length} invoice${pendingInvoices.length > 1 ? "s" : ""} pending`}
            subtitle={`Total: £${pendingInvoices.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}`}
            status="pending"
            onPress={() => navigation.navigate("Main", { screen: "ServicesTab" })}
            testID="card-pending-invoices"
          />
        </>
      ) : null}

      <SectionHeader title="Explore Our Services" />
      <View style={styles.promoGrid}>
        {[
          { icon: "sun" as const, title: "Solar PV", subtitle: "Cut your energy bills by up to 70%", color: "#F59E0B" },
          { icon: "battery-charging" as const, title: "EV Chargers", subtitle: "OZEV approved installation", color: "#10B981" },
          { icon: "thermometer" as const, title: "Heat Pumps", subtitle: "MCS certified, grant eligible", color: "#3B82F6" },
          { icon: "battery" as const, title: "Battery Storage", subtitle: "Store solar energy for later", color: "#8B5CF6" },
        ].map((promo) => (
          <Pressable
            key={promo.title}
            style={[styles.promoCard, { backgroundColor: theme.backgroundDefault }]}
            onPress={() => navigation.navigate("BookService", {})}
          >
            <View style={[styles.promoIcon, { backgroundColor: promo.color + "20" }]}>
              <Feather name={promo.icon} size={22} color={promo.color} />
            </View>
            <ThemedText type="small" style={{ fontWeight: "600", marginTop: Spacing.sm }}>
              {promo.title}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>
              {promo.subtitle}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={[styles.referralBanner, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
        <Feather name="gift" size={24} color={theme.primary} />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <ThemedText type="body" style={{ fontWeight: "600" }}>Refer a Friend</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Recommend us and you both get £100 off your next service
          </ThemedText>
        </View>
      </View>
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
    width: 100,
    height: 50,
  },
  headerTitle: {
    fontWeight: "600",
  },
  scrollContent: {
    flex: 1,
  },
  greeting: {
    marginBottom: Spacing.md,
  },
  greetingSubtitle: {
    marginTop: Spacing.xs,
  },
  propertySelector: {
    marginTop: Spacing.md,
  },
  announcementCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  serviceStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.sm,
  },
  quickActions: {
    flexDirection: "row",
  },
  quickActionSpacer: {
    width: Spacing.md,
  },
  promoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  promoCard: {
    width: "48%" as any,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: "center",
  },
  promoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  referralBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
});

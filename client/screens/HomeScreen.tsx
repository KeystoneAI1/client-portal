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

  const loadServiceReminders = useCallback(async () => {
    try {
      const response = await fetch(
        new URL("/api/commusoft/servicereminders", getApiUrl()).toString()
      );
      if (response.ok) {
        const data = await response.json();
        const reminders: ServiceReminder[] = data.servicereminders || [];
        
        const now = new Date();
        const statuses: ServiceStatus[] = [];
        
        // Process all service reminders from Commusoft
        for (const reminder of reminders) {
          // Calculate service due dates based on service period (in months)
          const intervalMonths = reminder.serviceperiod || 12;
          
          // Calculate next due date based on the service period
          // Since we don't have last service date from API, estimate it
          const nextDue = new Date(now);
          nextDue.setMonth(nextDue.getMonth() + 2); // Next due in ~2 months
          
          const lastService = new Date(now);
          lastService.setMonth(lastService.getMonth() - (intervalMonths - 2));
          
          // Service is due if next due date is within 60 days
          const daysUntilDue = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isDue = daysUntilDue <= 60;
          
          statuses.push({
            reminder,
            isDue,
            nextDueDate: nextDue,
            lastServiceDate: lastService,
          });
        }
        
        // Sort by service name for consistent display
        statuses.sort((a, b) => a.reminder.name.localeCompare(b.reminder.name));
        
        setServiceStatuses(statuses);
      }
    } catch (error) {
      console.error("Failed to load service reminders:", error);
    }
  }, []);

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
            console.log("[HomeScreen] Full job data:", JSON.stringify(nextJob).substring(0, 1000));
            setUpcomingJob({
              id: nextJob.id,
              description: nextJob.description || "Scheduled Service",
              scheduledDate: new Date().toISOString(), // Ongoing jobs don't have scheduled date
              status: "in_progress",
              engineerName: nextJob.engineername || "",
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
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadServiceReminders();
    }, [loadData, loadServiceReminders]),
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

      <SectionHeader title="Your Services" />
      {serviceStatuses.length > 0 ? (
        serviceStatuses.map((status) => (
          <SummaryCard
            key={status.reminder.id}
            icon={status.isDue ? "bell" : "clock"}
            title={status.reminder.name}
            subtitle={
              status.isDue
                ? `Due ${status.nextDueDate ? formatDate(status.nextDueDate.toISOString()) : "now"} - tap to book`
                : `Next due: ${status.nextDueDate ? formatDate(status.nextDueDate.toISOString()) : "Not scheduled"}`
            }
            status={status.isDue ? "pending" : "active"}
            onPress={
              status.isDue
                ? () =>
                    navigation.navigate("BookService", {
                      preselectedJobDescriptionId: status.reminder.settingsjobdescriptionid,
                      serviceName: status.reminder.name,
                      serviceReminderId: status.reminder.id,
                    })
                : undefined
            }
            testID={status.isDue ? "card-service-due" : "card-service-upcoming"}
          />
        ))
      ) : (
        <SummaryCard
          icon="check-circle"
          title="No Services Scheduled"
          subtitle="Your services are up to date"
        />
      )}

      <SectionHeader title="Quick Actions" />
      <View style={styles.quickActions}>
        <QuickActionCard
          icon="calendar"
          title="Book Service"
          subtitle={serviceStatuses.some((s) => s.isDue) ? "Schedule" : "No services due"}
          color={theme.accent}
          onPress={() => navigation.navigate("BookService", {})}
          testID="action-book-service"
          disabled={!serviceStatuses.some((s) => s.isDue)}
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
          subtitle={`Scheduled for ${formatDate(upcomingJob.scheduledDate)}`}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    alignItems: "center",
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerLogo: {
    width: 125,
    height: 125,
  },
  headerTitle: {
    marginTop: Spacing.xs,
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
  quickActions: {
    flexDirection: "row",
  },
  quickActionSpacer: {
    width: Spacing.md,
  },
});

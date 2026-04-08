import React, { useCallback, useState } from "react";
import { View, StyleSheet, SectionList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ListItem } from "@/components/ListItem";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useProperty } from "@/lib/propertyContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  storage,
  ServicePlan,
  Job,
  Invoice,
  Certificate,
} from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SectionData {
  title: string;
  data: any[];
  type: "plans" | "jobs" | "invoices" | "certificates";
}

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { selectedProperty } = useProperty();
  const navigation = useNavigation<NavigationProp>();

  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState<SectionData[]>([]);

  const loadData = useCallback(async () => {
    // Query the SELECTED property as a customer ID. Workaddresses are
    // queryable like customers in Commusoft, so this scopes job history,
    // plans, invoices and certificates to whichever property the user picks.
    const customerId = selectedProperty?.id || user?.accountNumber || user?.id;
    let jobs: Job[] = [];
    let plans: ServicePlan[] = [];
    let invoices: Invoice[] = [];
    let certificates: Certificate[] = [];

    if (customerId) {
      try {
        const jobsResponse = await fetch(
          new URL(`/api/commusoft/customer/${customerId}/jobs`, getApiUrl()).toString()
        );
        
        if (jobsResponse.ok) {
          const jobsData = await jobsResponse.json();
          const apiJobs = jobsData.Jobs || jobsData.jobs || [];
          console.log("[HistoryScreen] Jobs from API:", apiJobs.length);
          
          jobs = apiJobs.map((j: any) => ({
            id: String(j.id || j.jobid),
            description: j.description || j.jobdescription || "Service",
            scheduledDate: j.completedon || j.startdatetime || j.createddate || "",
            completedDate: j.completedon || "",
            status: (j.status || "completed").toLowerCase() as Job["status"],
            engineerName: j.engineername || "",
            invoiceId: j.invoiceid ? String(j.invoiceid) : undefined,
            certificateId: j.certificateid ? String(j.certificateid) : undefined,
          }));
          await storage.setJobs(jobs);
        }
        
        const customerResponse = await fetch(
          new URL(`/api/commusoft/customer/${customerId}`, getApiUrl()).toString()
        );

        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          const customer = customerData.Customer || customerData.customer || customerData;
          const apiPlans = customer.servicePlans || customer.serviceplans || [];

          plans = apiPlans.map((p: any) => ({
            id: String(p.id || p.servicePlanId),
            name: p.description || p.name || "Service Plan",
            description: p.description || "",
            startDate: p.startdate || "",
            endDate: p.expiredate || p.enddate || "",
            status: p.isServicePlanDisable ? "expired" : "active",
            coverage: [],
            applianceIds: [],
          }));
          await storage.setServicePlans(plans);
        }

        // Load invoices from API
        try {
          const invoicesResponse = await fetch(
            new URL(`/api/commusoft/customer/${customerId}/invoices`, getApiUrl()).toString()
          );
          if (invoicesResponse.ok) {
            const invoicesData = await invoicesResponse.json();
            const apiInvoices = invoicesData.invoices || [];
            invoices = apiInvoices.map((inv: any) => ({
              id: String(inv.id),
              invoiceNumber: inv.invoicenumber || inv.id?.toString() || "",
              amount: parseFloat(inv.total || inv.amount || "0"),
              status: (inv.status || "pending").toLowerCase() as Invoice["status"],
              issueDate: inv.createdondatetime || inv.issuedate || "",
              dueDate: inv.duedate || "",
              description: inv.description || inv.jobDescription || "Invoice",
              jobId: inv.jobId ? String(inv.jobId) : undefined,
            }));
            await storage.setInvoices(invoices);
          }
        } catch { /* use storage fallback */ }

        // Load certificates from API
        try {
          const certsResponse = await fetch(
            new URL(`/api/commusoft/customer/${customerId}/certificates`, getApiUrl()).toString()
          );
          if (certsResponse.ok) {
            const certsData = await certsResponse.json();
            const apiCerts = certsData.certificates || [];
            certificates = apiCerts.map((cert: any) => ({
              id: String(cert.id || cert.tablepkid),
              type: cert.Name || cert.type || "Certificate",
              issueDate: cert.createdondatetime || "",
              expiryDate: "",
              documentUrl: cert.documentUrl || undefined,
            }));
            await storage.setCertificates(certificates);
          }
        } catch { /* use storage fallback */ }
      } catch (error) {
        console.error("Failed to load data from API:", error);
        [plans, jobs, invoices, certificates] = await Promise.all([
          storage.getServicePlans(),
          storage.getJobs(),
          storage.getInvoices(),
          storage.getCertificates(),
        ]);
      }
    } else {
      [plans, jobs, invoices, certificates] = await Promise.all([
        storage.getServicePlans(),
        storage.getJobs(),
        storage.getInvoices(),
        storage.getCertificates(),
      ]);
    }

    const newSections: SectionData[] = [
      { title: "Service Plans", data: plans, type: "plans" },
      { title: "Job History", data: jobs, type: "jobs" },
      { title: "Invoices", data: invoices, type: "invoices" },
      { title: "Certificates", data: certificates, type: "certificates" },
    ];

    setSections(newSections);
  }, [user, selectedProperty]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // Reload when property changes
  React.useEffect(() => {
    if (selectedProperty) loadData();
  }, [selectedProperty?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `£${amount.toFixed(2)}`;
  };

  const renderItem = ({ item, section }: { item: any; section: SectionData }) => {
    switch (section.type) {
      case "plans":
        const plan = item as ServicePlan;
        return (
          <ListItem
            title={plan.name}
            subtitle={`Valid until ${formatDate(plan.endDate)}`}
            leftIcon="shield"
            badge={plan.status === "active" ? "Active" : undefined}
            badgeColor={theme.success}
            onPress={() =>
              navigation.navigate("ServicePlanDetail", { 
                planId: plan.id,
                planName: plan.name,
                planStatus: plan.status,
                planStartDate: plan.startDate,
                planEndDate: plan.endDate
              })
            }
            testID={`plan-${plan.id}`}
          />
        );
      case "jobs":
        const job = item as Job;
        return (
          <ListItem
            title={job.description}
            subtitle={formatDate(job.scheduledDate)}
            leftIcon="tool"
            badge={
              job.status === "scheduled"
                ? "Scheduled"
                : job.status === "completed"
                  ? "Done"
                  : undefined
            }
            badgeColor={job.status === "completed" ? theme.success : theme.primary}
            onPress={() => navigation.navigate("JobDetail", { jobId: job.id })}
            testID={`job-${job.id}`}
          />
        );
      case "invoices":
        const invoice = item as Invoice;
        return (
          <ListItem
            title={invoice.invoiceNumber}
            subtitle={`${formatCurrency(invoice.amount)} - Due ${formatDate(invoice.dueDate)}`}
            leftIcon="file-text"
            badge={
              invoice.status === "paid"
                ? "Paid"
                : invoice.status === "overdue"
                  ? "Overdue"
                  : "Pending"
            }
            badgeColor={
              invoice.status === "paid"
                ? theme.success
                : invoice.status === "overdue"
                  ? theme.error
                  : theme.warning
            }
            onPress={() =>
              navigation.navigate("InvoiceDetail", { invoiceId: invoice.id })
            }
            testID={`invoice-${invoice.id}`}
          />
        );
      case "certificates":
        const cert = item as Certificate;
        return (
          <ListItem
            title={cert.type}
            subtitle={`Expires ${formatDate(cert.expiryDate)}`}
            leftIcon="award"
            onPress={() =>
              navigation.navigate("CertificateDetail", { certificateId: cert.id })
            }
            testID={`certificate-${cert.id}`}
          />
        );
      default:
        return null;
    }
  };

  const renderSectionHeader = ({
    section,
  }: {
    section: SectionData;
  }) => (
    <View
      style={[styles.sectionHeader, { backgroundColor: theme.backgroundRoot }]}
    >
      <ThemedText type="h4">{section.title}</ThemedText>
    </View>
  );

  const renderSectionFooter = ({
    section,
  }: {
    section: SectionData;
  }) => {
    if (section.data.length > 0) return null;

    let image;
    let message = "";

    switch (section.type) {
      case "plans":
        image = require("../../assets/images/empty-services.png");
        message = "No service plans yet";
        break;
      case "jobs":
        image = require("../../assets/images/empty-jobs.png");
        message = "No job history yet";
        break;
      case "invoices":
        image = require("../../assets/images/empty-invoices.png");
        message = "No invoices yet";
        break;
      case "certificates":
        image = require("../../assets/images/empty-invoices.png");
        message = "No certificates yet";
        break;
    }

    return (
      <View style={styles.emptySection}>
        <ThemedText
          type="small"
          style={[styles.emptySectionText, { color: theme.textSecondary }]}
        >
          {message}
        </ThemedText>
      </View>
    );
  };

  const allEmpty = sections.every((s) => s.data.length === 0);

  if (allEmpty && sections.length > 0) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <EmptyState
          image={require("../../assets/images/empty-services.png")}
          title="No Services Yet"
          description="Your service plans, jobs, invoices, and certificates will appear here"
          actionLabel="Book a Service"
          onAction={() => navigation.navigate("BookService")}
        />
      </View>
    );
  }

  return (
    <SectionList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      sections={sections}
      keyExtractor={(item, index) => item.id || index.toString()}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      renderSectionFooter={renderSectionFooter}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  emptySection: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  emptySectionText: {
    fontStyle: "italic",
  },
});

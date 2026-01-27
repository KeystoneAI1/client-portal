import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { storage, Job, Appliance } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteProps = RouteProp<RootStackParamList, "JobDetail">;

export default function JobDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { jobId } = route.params;

  const [job, setJob] = useState<(Job & { invoiceId?: string; certificateId?: string }) | null>(null);
  const [appliance, setAppliance] = useState<Appliance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    const [jobs, appliances] = await Promise.all([
      storage.getJobs(),
      storage.getAppliances(),
    ]);

    const foundJob = jobs.find((j) => j.id === jobId);
    setJob(foundJob || null);

    if (foundJob?.applianceId) {
      const foundAppliance = appliances.find(
        (a) => a.id === foundJob.applianceId,
      );
      setAppliance(foundAppliance || null);
    }

    setIsLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getJobTypeLabel = (type: Job["type"]) => {
    switch (type) {
      case "repair":
        return "Repair";
      case "service":
        return "Service";
      case "installation":
        return "Installation";
      case "inspection":
        return "Inspection";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <LoadingSpinner />
      </View>
    );
  }

  if (!job) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Job not found
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: theme.backgroundDefault },
          Shadows.small,
        ]}
      >
        <View style={styles.headerTop}>
          <View
            style={[styles.iconContainer, { backgroundColor: theme.accent + "15" }]}
          >
            <Feather name="tool" size={24} color={theme.accent} />
          </View>
          <StatusBadge status={job.status} size="medium" />
        </View>
        <ThemedText type="h2" style={styles.jobDescription}>
          {job.description}
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.jobType, { color: theme.textSecondary }]}
        >
          {getJobTypeLabel(job.type)}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Details
        </ThemedText>

        <View
          style={[styles.detailCard, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={styles.detailRow}>
            <Feather name="calendar" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Scheduled Date
              </ThemedText>
              <ThemedText type="body">{formatDate(job.scheduledDate)}</ThemedText>
            </View>
          </View>

          {job.completedDate ? (
            <View style={styles.detailRow}>
              <Feather name="check-circle" size={18} color={theme.success} />
              <View style={styles.detailContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Completed Date
                </ThemedText>
                <ThemedText type="body">{formatDate(job.completedDate)}</ThemedText>
              </View>
            </View>
          ) : null}

          {job.technicianName ? (
            <View style={styles.detailRow}>
              <Feather name="user" size={18} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Technician
                </ThemedText>
                <ThemedText type="body">{job.technicianName}</ThemedText>
              </View>
            </View>
          ) : null}

          {appliance ? (
            <View style={styles.detailRow}>
              <Feather name="box" size={18} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Appliance
                </ThemedText>
                <ThemedText type="body">{appliance.name}</ThemedText>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {job.notes ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Notes
          </ThemedText>
          <View
            style={[
              styles.notesCard,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ThemedText type="body">{job.notes}</ThemedText>
          </View>
        </View>
      ) : null}

      {(job.invoiceId || job.certificateId) ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Documents
          </ThemedText>
          
          {job.invoiceId ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("InvoiceDetail", { invoiceId: job.invoiceId! });
              }}
              style={[
                styles.documentButton,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <View style={styles.documentButtonContent}>
                <View
                  style={[
                    styles.documentIcon,
                    { backgroundColor: theme.success + "15" },
                  ]}
                >
                  <Feather name="file-text" size={20} color={theme.success} />
                </View>
                <View style={styles.documentTextContainer}>
                  <ThemedText type="body" style={styles.documentTitle}>
                    View Invoice
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Invoice #{job.invoiceId}
                  </ThemedText>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
          
          {job.certificateId ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("CertificateDetail", { certificateId: job.certificateId! });
              }}
              style={[
                styles.documentButton,
                { backgroundColor: theme.backgroundDefault },
                job.invoiceId ? { marginTop: Spacing.sm } : undefined,
              ]}
            >
              <View style={styles.documentButtonContent}>
                <View
                  style={[
                    styles.documentIcon,
                    { backgroundColor: theme.primary + "15" },
                  ]}
                >
                  <Feather name="award" size={20} color={theme.primary} />
                </View>
                <View style={styles.documentTextContainer}>
                  <ThemedText type="body" style={styles.documentTitle}>
                    View Certificate
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Certificate #{job.certificateId}
                  </ThemedText>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing["2xl"],
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  jobDescription: {
    marginBottom: Spacing.xs,
  },
  jobType: {},
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  detailCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  detailContent: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  notesCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  documentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  documentButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  documentTextContainer: {
    flex: 1,
  },
  documentTitle: {
    fontWeight: "500",
  },
});

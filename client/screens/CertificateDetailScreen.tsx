import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { storage, Certificate, Appliance } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "CertificateDetail">;

export default function CertificateDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const { certificateId } = route.params;

  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [appliance, setAppliance] = useState<Appliance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [certificateId]);

  const loadData = async () => {
    const [certificates, appliances] = await Promise.all([
      storage.getCertificates(),
      storage.getAppliances(),
    ]);

    const foundCertificate = certificates.find((c) => c.id === certificateId);
    setCertificate(foundCertificate || null);

    if (foundCertificate?.applianceId) {
      const foundAppliance = appliances.find(
        (a) => a.id === foundCertificate.applianceId,
      );
      setAppliance(foundAppliance || null);
    }

    setIsLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
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

  if (!certificate) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Certificate not found
        </ThemedText>
      </View>
    );
  }

  const expired = isExpired(certificate.expiryDate);
  const expiringSoon = isExpiringSoon(certificate.expiryDate);

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
            style={[
              styles.iconContainer,
              {
                backgroundColor: expired
                  ? theme.error + "15"
                  : expiringSoon
                    ? theme.warning + "15"
                    : theme.success + "15",
              },
            ]}
          >
            <Feather
              name="award"
              size={24}
              color={
                expired
                  ? theme.error
                  : expiringSoon
                    ? theme.warning
                    : theme.success
              }
            />
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: expired
                  ? theme.error + "20"
                  : expiringSoon
                    ? theme.warning + "20"
                    : theme.success + "20",
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: expired
                  ? theme.error
                  : expiringSoon
                    ? theme.warning
                    : theme.success,
                fontWeight: "600",
              }}
            >
              {expired ? "Expired" : expiringSoon ? "Expiring Soon" : "Valid"}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="h2" style={styles.certType}>
          {certificate.type}
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
                Issue Date
              </ThemedText>
              <ThemedText type="body">
                {formatDate(certificate.issueDate)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Feather
              name="clock"
              size={18}
              color={expired ? theme.error : theme.textSecondary}
            />
            <View style={styles.detailContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Expiry Date
              </ThemedText>
              <ThemedText
                type="body"
                style={expired ? { color: theme.error } : undefined}
              >
                {formatDate(certificate.expiryDate)}
              </ThemedText>
            </View>
          </View>

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

      <Button style={styles.downloadButton}>Download PDF</Button>
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
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  certType: {},
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
  downloadButton: {
    marginTop: Spacing.lg,
  },
});

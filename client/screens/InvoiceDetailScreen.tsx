import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { storage, Invoice } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "InvoiceDetail">;

export default function InvoiceDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const { invoiceId } = route.params;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [invoiceId]);

  const loadData = async () => {
    const invoices = await storage.getInvoices();
    const foundInvoice = invoices.find((i) => i.id === invoiceId);
    setInvoice(foundInvoice || null);
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

  const formatCurrency = (amount: number) => {
    return `£${amount.toFixed(2)}`;
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

  if (!invoice) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Invoice not found
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
            style={[styles.iconContainer, { backgroundColor: theme.primary + "15" }]}
          >
            <Feather name="file-text" size={24} color={theme.primary} />
          </View>
          <StatusBadge status={invoice.status} size="medium" />
        </View>
        <ThemedText type="h2" style={styles.invoiceNumber}>
          {invoice.invoiceNumber}
        </ThemedText>
        <ThemedText type="h1" style={[styles.amount, { color: theme.primary }]}>
          {formatCurrency(invoice.amount)}
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
            <Feather name="file" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Description
              </ThemedText>
              <ThemedText type="body">{invoice.description}</ThemedText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Feather name="calendar" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Issue Date
              </ThemedText>
              <ThemedText type="body">{formatDate(invoice.issueDate)}</ThemedText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Feather name="clock" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Due Date
              </ThemedText>
              <ThemedText type="body">{formatDate(invoice.dueDate)}</ThemedText>
            </View>
          </View>
        </View>
      </View>

      {invoice.status !== "paid" ? (
        <Button style={styles.payButton}>Pay Now</Button>
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
    alignItems: "center",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceNumber: {
    marginBottom: Spacing.sm,
  },
  amount: {
    fontSize: 36,
  },
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
  payButton: {
    marginTop: Spacing.lg,
  },
});

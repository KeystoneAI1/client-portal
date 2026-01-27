import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import WebView from "react-native-webview";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const CARE_PLAN_PDF_URL = "https://www.aquila-plumbing.com/wp-content/uploads/2026/01/Aquila_Care-_Plan_T_and_C.pdf";

type RouteProps = RouteProp<RootStackParamList, "ServicePlanDetail">;

export default function ServicePlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const { planName, planStatus, planStartDate, planEndDate } = route.params;
  const [isLoading, setIsLoading] = useState(true);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const openInBrowser = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await WebBrowser.openBrowserAsync(CARE_PLAN_PDF_URL);
  };

  const mapStatus = (status: string | undefined): "active" | "expired" | "pending" => {
    if (!status) return "active";
    if (status === "active" || status === "expired" || status === "pending") {
      return status;
    }
    return "active";
  };

  const pdfViewerUrl = Platform.OS === "web" 
    ? CARE_PLAN_PDF_URL 
    : `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(CARE_PLAN_PDF_URL)}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md, backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.headerContent}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="shield" size={24} color={theme.primary} />
          </View>
          <View style={styles.headerText}>
            <ThemedText type="body" style={styles.planName} numberOfLines={2}>
              {planName || "Care Plan"}
            </ThemedText>
            {planStartDate && planEndDate ? (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {formatDate(planStartDate)} - {formatDate(planEndDate)}
              </ThemedText>
            ) : null}
          </View>
          {planStatus ? (
            <StatusBadge status={mapStatus(planStatus)} size="small" />
          ) : null}
        </View>
      </View>

      <View style={styles.pdfContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading Terms & Conditions...
            </ThemedText>
          </View>
        ) : null}
        <WebView
          source={{ uri: pdfViewerUrl }}
          style={[styles.webview, isLoading ? styles.hidden : null]}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          startInLoadingState={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundDefault }]}>
        <Pressable
          onPress={openInBrowser}
          style={[styles.openButton, { backgroundColor: theme.primary }]}
        >
          <Feather name="external-link" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.openButtonText}>
            Open in Browser
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    ...Shadows.small,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  planName: {
    fontWeight: "600",
    marginBottom: 2,
  },
  pdfContainer: {
    flex: 1,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  webview: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    ...Shadows.small,
  },
  openButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  openButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
});

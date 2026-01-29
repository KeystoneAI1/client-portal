import React from "react";
import { View, StyleSheet, ScrollView, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ListItem } from "@/components/ListItem";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { logout } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
  };

  const openLink = (url: string) => {
    if (Platform.OS !== "web") {
      Linking.openURL(url);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.section}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          SUPPORT
        </ThemedText>
        <ListItem
          title="Contact Support"
          leftIcon="headphones"
          onPress={() => openLink("mailto:support@example.com")}
        />
        <ListItem
          title="Help Center"
          leftIcon="help-circle"
          onPress={() => openLink("https://example.com/help")}
        />
      </View>

      <View style={styles.section}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          LEGAL
        </ThemedText>
        <ListItem
          title="Privacy Policy"
          leftIcon="shield"
          onPress={() => navigation.navigate("PrivacyPolicy")}
        />
        <ListItem
          title="Terms of Service"
          leftIcon="file-text"
          onPress={() => navigation.navigate("TermsOfService")}
        />
      </View>

      <View style={styles.section}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          ACCOUNT
        </ThemedText>
        <ListItem
          title="Notification Preferences"
          leftIcon="bell"
          onPress={() => {}}
        />
        <ListItem
          title="Log Out"
          leftIcon="log-out"
          showChevron={false}
          onPress={handleLogout}
        />
      </View>

      <View style={styles.section}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          DANGER ZONE
        </ThemedText>
        <View
          style={[
            styles.dangerCard,
            { backgroundColor: theme.error + "10", borderColor: theme.error + "30" },
          ]}
        >
          <ListItem
            title="Delete Account"
            subtitle="This action cannot be undone"
            leftIcon="trash-2"
            showChevron={false}
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText
          type="small"
          style={[styles.version, { color: theme.textSecondary }]}
        >
          Client Portal v1.0.0
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  dangerCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing["2xl"],
  },
  version: {},
});

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["2xl"],
        },
      ]}
    >
      <ThemedText type="h2" style={styles.title}>
        Privacy Policy
      </ThemedText>
      <ThemedText type="small" style={[styles.lastUpdated, { color: theme.textSecondary }]}>
        Last updated: January 2026
      </ThemedText>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          1. Introduction
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          Aquila Heating & Plumbing Ltd is registered in England & Wales No 08160905. We are committed to protecting the privacy and security of your personal information. This privacy policy explains how we collect, use, and protect your data when you use the Aquila Client Portal mobile application.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          2. Information We Collect
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          We collect and process the following information in accordance with the General Data Protection Regulation (GDPR) and Data Protection Act 2018:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Your full name and contact details
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Your property address(es)
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Email address and telephone number
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Service history and job records
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Appliance and equipment details
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Payment and invoice information
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Device information (device type, operating system)
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • App usage data and preferences
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          3. How We Use Your Information
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          We use your information to:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Provide access to your account and service history
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Process and manage service bookings
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Send appointment reminders and service notifications
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Generate and share invoices and certificates
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Provide customer support through our AI assistant
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Improve our services and app experience
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Send marketing communications (with your consent)
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          4. Data Sharing
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          We may share your data with:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Our service management platform (Commusoft) for job scheduling
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Payment processors for invoice payments
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • SMS providers for verification codes and notifications
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • AI service providers for our virtual assistant feature
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          We will never sell your personal information to third parties.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          5. Your Rights
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          Under GDPR, you have the right to:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Access your personal data
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Correct inaccurate data
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Request deletion of your data
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Object to processing of your data
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Request data portability
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          To exercise any of these rights, please contact us using the details below.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          6. Data Security
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          We implement appropriate technical and organisational measures to protect your data, including:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Secure HTTPS encryption for all data transmission
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • SMS verification for account access
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Secure cloud infrastructure
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Access controls and authentication
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          7. Data Retention
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Service records and certificates are retained for a minimum of 6 years in accordance with industry requirements.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          8. Contact Us
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          If you have any questions about this privacy policy or wish to exercise your rights, please contact us:
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          Aquila Heating & Plumbing Ltd{"\n"}
          Email: info@aquila-plumbing.com{"\n"}
          Website: www.aquila-plumbing.com
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          You can also contact the Information Commissioner's Office (ICO) if you have concerns about how we handle your data: ico.org.uk
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  lastUpdated: {
    marginBottom: Spacing["2xl"],
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  paragraph: {
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  bulletPoint: {
    marginBottom: Spacing.xs,
    marginLeft: Spacing.md,
    lineHeight: 22,
  },
});

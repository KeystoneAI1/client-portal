import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export default function TermsOfServiceScreen() {
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
        Terms of Service
      </ThemedText>
      <ThemedText type="small" style={[styles.lastUpdated, { color: theme.textSecondary }]}>
        Last updated: January 2026
      </ThemedText>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          1. Introduction
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          Welcome to the Aquila Heating & Plumbing Client Portal mobile application ("the App"). By downloading, installing, or using this App, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          Aquila Heating & Plumbing Ltd ("we", "us", "our") is registered in England & Wales, Company No 08160905.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          2. Eligibility
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          The App is intended for use by existing customers of Aquila Heating & Plumbing Ltd. To access the App, you must:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Be an existing customer with a valid account
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Have access to the email address and mobile phone registered with your account
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Be at least 18 years of age or have parental consent
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          3. Account Access
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          Access to the App requires verification via SMS code sent to your registered mobile number. You are responsible for:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Maintaining the confidentiality of your verification codes
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Keeping your contact information up to date
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • All activities that occur under your account
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          If you believe your account has been compromised, please contact us immediately.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          4. App Features
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          The App provides access to:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Your service history and job records
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Appliance and equipment information
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Care plan details and terms
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Invoices and payment history
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Gas Safety and other certificates
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Service booking functionality
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • AI-powered technical assistance
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          5. AI Assistant
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          Our App includes an AI-powered virtual assistant to help answer questions. Please note:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • The AI provides general guidance only, not professional advice
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • For gas-related issues, always contact a Gas Safe registered engineer
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • If you smell gas, leave the property immediately and call the National Gas Emergency Line: 0800 111 999
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • The AI may not always provide accurate information
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          6. Service Bookings
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          When booking services through the App:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Appointment slots are subject to availability
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • We will confirm appointments via SMS or email
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Standard terms and pricing apply as per your care plan or quoted rates
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Cancellation with less than 24 hours notice may incur charges
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          7. Acceptable Use
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          You agree not to:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Use the App for any unlawful purpose
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Attempt to gain unauthorised access to our systems
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Share your account access with others
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Upload harmful content or malware
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Interfere with the App's operation
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          8. Intellectual Property
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          All content, trademarks, and intellectual property in the App belong to Aquila Heating & Plumbing Ltd or our licensors. You may not copy, modify, distribute, or reverse engineer any part of the App without our written permission.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          9. Limitation of Liability
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          To the maximum extent permitted by law:
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • The App is provided "as is" without warranties of any kind
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • We are not liable for any indirect or consequential losses
        </ThemedText>
        <ThemedText type="body" style={styles.bulletPoint}>
          • Our total liability is limited to the amount paid for services
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          Nothing in these terms excludes our liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          10. Changes to Terms
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          We may update these Terms of Service from time to time. We will notify you of significant changes through the App or via email. Continued use of the App after changes constitutes acceptance of the new terms.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          11. Governing Law
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          These terms are governed by English law. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          12. Contact Us
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          If you have any questions about these Terms of Service, please contact us:
        </ThemedText>
        <ThemedText type="body" style={styles.paragraph}>
          Aquila Heating & Plumbing Ltd{"\n"}
          Email: info@aquila-plumbing.com{"\n"}
          Website: www.aquila-plumbing.com
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

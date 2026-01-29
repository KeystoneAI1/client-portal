import React, { useState, useRef } from "react";
import { View, StyleSheet, Image, Pressable, TextInput as RNTextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { InputField } from "@/components/InputField";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type LoginStep = "email" | "code";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { requestCode, verifyCode } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const codeInputRef = useRef<RNTextInput>(null);

  const handleRequestCode = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      const response = await requestCode(email.trim());
      // Update step FIRST before any other state changes to prevent race condition
      setStep("code");
      setMaskedPhone(response.maskedPhone);
      setIsLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => codeInputRef.current?.focus(), 300);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Failed to send verification code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError("Please enter the verification code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (code.trim().length !== 6) {
      setError("Please enter the 6-digit code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      await verifyCode(email.trim(), code.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Invalid verification code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleResendCode = async () => {
    setCode("");
    setError("");
    setIsLoading(true);
    try {
      const response = await requestCode(email.trim());
      setMaskedPhone(response.maskedPhone);
      setIsLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Failed to resend code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleBack = () => {
    setStep("email");
    setCode("");
    setError("");
  };

  const openPrivacyPolicy = () => {
    navigation.navigate("PrivacyPolicy");
  };

  const openTerms = () => {
    navigation.navigate("TermsOfService");
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <LoadingSpinner message={step === "email" ? "Looking up your account...\nThis may take up to 30 seconds" : "Verifying..."} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing["4xl"],
          paddingBottom: insets.bottom + Spacing["2xl"],
        },
      ]}
    >
      <View style={styles.logoContainer}>
        <Image
          source={require("../assets/images/aquila-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText type="h2" style={styles.title}>
          Client Portal
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.subtitle, { color: theme.textSecondary }]}
        >
          {step === "email"
            ? "Enter your email to sign in"
            : "Enter the code sent to your phone"}
        </ThemedText>
      </View>

      <View style={styles.form}>
        {step === "email" ? (
          <>
            <InputField
              label="Email Address"
              placeholder="Enter your email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail"
              testID="input-email"
            />

            {error ? (
              <ThemedText
                type="small"
                style={[styles.error, { color: theme.error }]}
              >
                {error}
              </ThemedText>
            ) : null}

            <Button onPress={handleRequestCode} style={styles.loginButton} testID="button-send-code">
              Send Verification Code
            </Button>
          </>
        ) : (
          <>
            <View style={[styles.phoneInfo, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
                We sent a 6-digit code to
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600", textAlign: "center", marginTop: Spacing.xs }}>
                {maskedPhone}
              </ThemedText>
            </View>

            <InputField
              ref={codeInputRef}
              label="Verification Code"
              placeholder="Enter 6-digit code"
              value={code}
              onChangeText={(text) => setCode(text.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              leftIcon="key"
              testID="input-code"
            />

            {error ? (
              <ThemedText
                type="small"
                style={[styles.error, { color: theme.error }]}
              >
                {error}
              </ThemedText>
            ) : null}

            <Button onPress={handleVerifyCode} style={styles.loginButton} testID="button-verify">
              Verify Code
            </Button>

            <View style={styles.codeActions}>
              <Pressable onPress={handleResendCode} style={styles.resendButton}>
                <ThemedText type="body" style={{ color: theme.primary }}>
                  Resend Code
                </ThemedText>
              </Pressable>

              <Pressable onPress={handleBack} style={styles.backButton}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Use Different Email
                </ThemedText>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <ThemedText
          type="small"
          style={[styles.footerText, { color: theme.textSecondary }]}
        >
          By signing in, you agree to our
        </ThemedText>
        <View style={styles.links}>
          <Pressable onPress={openTerms}>
            <ThemedText type="small" style={{ color: theme.primary }}>
              Terms of Service
            </ThemedText>
          </Pressable>
          <ThemedText
            type="small"
            style={[styles.linkSeparator, { color: theme.textSecondary }]}
          >
            {" and "}
          </ThemedText>
          <Pressable onPress={openPrivacyPolicy}>
            <ThemedText type="small" style={{ color: theme.primary }}>
              Privacy Policy
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "space-between",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 300,
    height: 300,
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
  },
  form: {
    flex: 1,
    justifyContent: "center",
  },
  phoneInfo: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  error: {
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  codeActions: {
    alignItems: "center",
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  resendButton: {
    padding: Spacing.sm,
  },
  backButton: {
    padding: Spacing.sm,
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing["2xl"],
  },
  footerText: {
    textAlign: "center",
  },
  links: {
    flexDirection: "row",
    marginTop: Spacing.xs,
  },
  linkSeparator: {},
});

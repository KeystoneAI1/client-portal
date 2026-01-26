import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { InputField } from "@/components/InputField";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, Contact } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "EditContact">;

export default function EditContactScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const contactId = route.params?.contactId;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditing = !!contactId;

  useEffect(() => {
    if (contactId) {
      loadContact();
    }
  }, [contactId]);

  const loadContact = async () => {
    const contacts = await storage.getContacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      setName(contact.name);
      setEmail(contact.email);
      setPhone(contact.phone);
      setRole(contact.role);
      setIsPrimary(contact.isPrimary);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const contacts = await storage.getContacts();

      if (isEditing) {
        const updatedContacts = contacts.map((c) =>
          c.id === contactId
            ? {
                ...c,
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                role: role.trim() || "Contact",
                isPrimary,
              }
            : isPrimary
              ? { ...c, isPrimary: false }
              : c,
        );
        await storage.setContacts(updatedContacts);
      } else {
        const newContact: Contact = {
          id: Date.now().toString(),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: role.trim() || "Contact",
          isPrimary,
        };

        const updatedContacts = isPrimary
          ? contacts.map((c) => ({ ...c, isPrimary: false }))
          : contacts;

        await storage.setContacts([...updatedContacts, newContact]);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to save contact:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!contactId) return;

    setIsDeleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const contacts = await storage.getContacts();
      const updatedContacts = contacts.filter((c) => c.id !== contactId);
      await storage.setContacts(updatedContacts);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to delete contact:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <InputField
        label="Name"
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        leftIcon="user"
        testID="input-name"
      />

      <InputField
        label="Email"
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        leftIcon="mail"
        testID="input-email"
      />

      <InputField
        label="Phone"
        placeholder="Phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        leftIcon="phone"
        testID="input-phone"
      />

      <InputField
        label="Role"
        placeholder="e.g., Account Holder, Tenant"
        value={role}
        onChangeText={setRole}
        autoCapitalize="words"
        leftIcon="briefcase"
        testID="input-role"
      />

      <Pressable
        style={[
          styles.toggleRow,
          { backgroundColor: theme.backgroundDefault },
        ]}
        onPress={() => {
          setIsPrimary(!isPrimary);
          Haptics.selectionAsync();
        }}
      >
        <View style={styles.toggleContent}>
          <Feather name="star" size={20} color={theme.primary} />
          <View style={styles.toggleText}>
            <ThemedText type="body" style={styles.toggleTitle}>
              Primary Contact
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary }}
            >
              Receives important notifications
            </ThemedText>
          </View>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: isPrimary
                ? theme.primary
                : theme.backgroundSecondary,
              borderColor: isPrimary ? theme.primary : theme.border,
            },
          ]}
        >
          {isPrimary ? (
            <Feather name="check" size={16} color="#FFFFFF" />
          ) : null}
        </View>
      </Pressable>

      <Button
        onPress={handleSubmit}
        disabled={!name.trim() || !email.trim() || !phone.trim() || isSubmitting}
        style={styles.submitButton}
        testID="button-save"
      >
        {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Add Contact"}
      </Button>

      {isEditing ? (
        <Pressable
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          <ThemedText type="body" style={{ color: theme.error }}>
            {isDeleting ? "Deleting..." : "Delete Contact"}
          </ThemedText>
        </Pressable>
      ) : null}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toggleText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  toggleTitle: {
    fontWeight: "500",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
  deleteButton: {
    alignItems: "center",
    marginTop: Spacing.lg,
    padding: Spacing.md,
  },
});

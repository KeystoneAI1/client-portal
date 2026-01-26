import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { SectionHeader } from "@/components/SectionHeader";
import { ListItem } from "@/components/ListItem";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { storage, Contact, Appliance } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [appliances, setAppliances] = useState<Appliance[]>([]);

  const loadData = useCallback(async () => {
    const [contactsData, appliancesData] = await Promise.all([
      storage.getContacts(),
      storage.getAppliances(),
    ]);
    setContacts(contactsData);
    setAppliances(appliancesData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const getApplianceIcon = (type: Appliance["type"]): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "boiler":
        return "thermometer";
      case "heating":
        return "sun";
      case "electrical":
        return "zap";
      case "plumbing":
        return "droplet";
      default:
        return "box";
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Pressable
        style={[
          styles.profileCard,
          { backgroundColor: theme.backgroundDefault },
          Shadows.small,
        ]}
        onPress={() => navigation.navigate("Settings")}
      >
        <Image
          source={require("../../assets/images/default-avatar.png")}
          style={styles.avatar}
          resizeMode="cover"
        />
        <View style={styles.profileInfo}>
          <ThemedText type="h3">{user?.name || "Account Holder"}</ThemedText>
          <ThemedText
            type="body"
            style={[styles.profileEmail, { color: theme.textSecondary }]}
          >
            {user?.email || "email@example.com"}
          </ThemedText>
          {user?.phone ? (
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary }}
            >
              {user.phone}
            </ThemedText>
          ) : null}
        </View>
        <Feather name="settings" size={20} color={theme.textSecondary} />
      </Pressable>

      <SectionHeader
        title="Contacts"
        actionLabel="Add"
        onAction={() => navigation.navigate("EditContact", {})}
      />
      {contacts.length > 0 ? (
        contacts.map((contact) => (
          <ListItem
            key={contact.id}
            title={contact.name}
            subtitle={`${contact.role} • ${contact.phone}`}
            leftIcon="user"
            badge={contact.isPrimary ? "Primary" : undefined}
            badgeColor={theme.primary}
            onPress={() =>
              navigation.navigate("EditContact", { contactId: contact.id })
            }
            testID={`contact-${contact.id}`}
          />
        ))
      ) : (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            No contacts added yet
          </ThemedText>
        </View>
      )}

      <SectionHeader
        title="Appliances & Assets"
        actionLabel="Add"
        onAction={() => navigation.navigate("EditAppliance", {})}
      />
      {appliances.length > 0 ? (
        appliances.map((appliance) => (
          <ListItem
            key={appliance.id}
            title={appliance.name}
            subtitle={`${appliance.model || appliance.type} • ${appliance.location || "Unknown location"}`}
            leftIcon={getApplianceIcon(appliance.type)}
            onPress={() =>
              navigation.navigate("EditAppliance", { applianceId: appliance.id })
            }
            testID={`appliance-${appliance.id}`}
          />
        ))
      ) : (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            No appliances registered yet
          </ThemedText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: Spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  profileEmail: {
    marginTop: 2,
  },
  emptyCard: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});

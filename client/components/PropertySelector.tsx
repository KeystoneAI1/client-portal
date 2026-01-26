import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useProperty, Property } from "@/lib/propertyContext";
import { Spacing, BorderRadius } from "@/constants/theme";

export function PropertySelector() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { properties, selectedProperty, selectProperty, isLoading } = useProperty();
  const [modalVisible, setModalVisible] = useState(false);

  if (properties.length <= 1) {
    return selectedProperty ? (
      <View style={styles.singleProperty}>
        <Feather name="home" size={16} color={theme.textSecondary} />
        <ThemedText type="small" style={[styles.addressText, { color: theme.textSecondary }]} numberOfLines={1}>
          {formatAddress(selectedProperty)}
        </ThemedText>
      </View>
    ) : null;
  }

  const handleSelect = (property: Property) => {
    selectProperty(property);
    setModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderProperty = ({ item }: { item: Property }) => {
    const isSelected = item.id === selectedProperty?.id;
    return (
      <Pressable
        style={[
          styles.propertyItem,
          {
            backgroundColor: isSelected ? theme.primaryLight : theme.backgroundDefault,
            borderColor: isSelected ? theme.primary : theme.border,
          },
        ]}
        onPress={() => handleSelect(item)}
      >
        <View style={styles.propertyInfo}>
          <View style={styles.propertyHeader}>
            <Feather
              name={item.isPrimaryAddress ? "home" : "map-pin"}
              size={18}
              color={isSelected ? theme.primary : theme.text}
            />
            <ThemedText
              type="body"
              style={[
                styles.propertyName,
                { color: isSelected ? theme.primary : theme.text },
              ]}
            >
              {item.isPrimaryAddress ? "Primary Address" : `${item.name} ${item.surname || ""}`.trim()}
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary }}
            numberOfLines={2}
          >
            {formatFullAddress(item)}
          </ThemedText>
          {item.servicePlans && item.servicePlans.length > 0 ? (
            <View style={[styles.planBadge, { backgroundColor: theme.successLight }]}>
              <ThemedText type="small" style={{ color: theme.success }}>
                {item.servicePlans[0].description}
              </ThemedText>
            </View>
          ) : null}
        </View>
        {isSelected ? (
          <Feather name="check-circle" size={20} color={theme.primary} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <>
      <Pressable
        style={[styles.selector, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => {
          setModalVisible(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        testID="button-property-selector"
      >
        <Feather name="home" size={16} color={theme.primary} />
        <ThemedText type="small" style={[styles.addressText, { color: theme.text }]} numberOfLines={1}>
          {selectedProperty ? formatAddress(selectedProperty) : "Select Property"}
        </ThemedText>
        <Feather name="chevron-down" size={16} color={theme.textSecondary} />
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.backgroundRoot,
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Select Property</ThemedText>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={12}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <FlatList
              data={properties}
              keyExtractor={(item) => item.id}
              renderItem={renderProperty}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function formatAddress(property: Property): string {
  if (property.isPrimaryAddress) {
    return `${property.addressLine1}, ${property.postcode}`;
  }
  return `${property.addressLine1}, ${property.postcode}`;
}

function formatFullAddress(property: Property): string {
  const parts = [
    property.addressLine1,
    property.addressLine2,
    property.town,
    property.county,
    property.postcode,
  ].filter(Boolean);
  return parts.join(", ");
}

const styles = StyleSheet.create({
  singleProperty: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  addressText: {
    flex: 1,
    maxWidth: 200,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  listContent: {
    padding: Spacing.lg,
  },
  propertyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  propertyInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  propertyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  propertyName: {
    fontWeight: "600",
  },
  planBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
});

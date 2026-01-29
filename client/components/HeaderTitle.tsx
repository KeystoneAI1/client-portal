import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

interface HeaderTitleProps {
  title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/aquila-logo.png")}
        style={styles.icon}
        resizeMode="contain"
      />
      <ThemedText style={styles.title}>{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 126,
    height: 126,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: Spacing.xs,
    textAlign: "center",
  },
});

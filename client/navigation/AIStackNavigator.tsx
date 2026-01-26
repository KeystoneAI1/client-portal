import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AIChatScreen from "@/screens/AIChatScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type AIStackParamList = {
  AIChat: undefined;
};

const Stack = createNativeStackNavigator<AIStackParamList>();

export default function AIStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{
          headerTitle: "Tech Agent",
        }}
      />
    </Stack.Navigator>
  );
}

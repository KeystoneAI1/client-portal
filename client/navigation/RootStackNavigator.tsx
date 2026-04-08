import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigatorScreenParams } from "@react-navigation/native";

import MainTabNavigator, { MainTabParamList } from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import BookServiceScreen from "@/screens/BookServiceScreen";
import EditContactScreen from "@/screens/EditContactScreen";
import EditApplianceScreen from "@/screens/EditApplianceScreen";
import ServicePlanDetailScreen from "@/screens/ServicePlanDetailScreen";
import JobDetailScreen from "@/screens/JobDetailScreen";
import InvoiceDetailScreen from "@/screens/InvoiceDetailScreen";
import CertificateDetailScreen from "@/screens/CertificateDetailScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ThemedView } from "@/components/ThemedView";

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  Settings: undefined;
  BookService:
    | {
        preselectedJobDescriptionId?: number;
        serviceName?: string;
        serviceReminderId?: number;
        // "exact" means we're sure this is the right service type and can
        // skip straight to appointment selection. Anything else (guess) lands
        // the user on the service picker with a visible confirmation banner.
        serviceTypeSource?: "exact" | "frequency-history" | "unknown";
      }
    | undefined;
  EditContact: { contactId?: string };
  EditAppliance: { applianceId?: string };
  ServicePlanDetail: { planId: string; planName?: string; planStatus?: string; planStartDate?: string; planEndDate?: string };
  JobDetail: { jobId: string };
  InvoiceDetail: { invoiceId: string };
  CertificateDetail: { certificateId: string };
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const opaqueScreenOptions = useScreenOptions({ transparent: false });
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <LoadingSpinner message="Loading..." />
      </ThemedView>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              ...opaqueScreenOptions,
              presentation: "modal",
              headerTitle: "Settings",
            }}
          />
          <Stack.Screen
            name="BookService"
            component={BookServiceScreen}
            options={{
              ...opaqueScreenOptions,
              presentation: "modal",
              headerTitle: "Book Service",
            }}
          />
          <Stack.Screen
            name="EditContact"
            component={EditContactScreen}
            options={({ route }) => ({
              ...opaqueScreenOptions,
              presentation: "modal",
              headerTitle: route.params?.contactId ? "Edit Contact" : "Add Contact",
            })}
          />
          <Stack.Screen
            name="EditAppliance"
            component={EditApplianceScreen}
            options={({ route }) => ({
              ...opaqueScreenOptions,
              presentation: "modal",
              headerTitle: route.params?.applianceId ? "Edit Appliance" : "Add Appliance",
            })}
          />
          <Stack.Screen
            name="ServicePlanDetail"
            component={ServicePlanDetailScreen}
            options={{
              ...opaqueScreenOptions,
              headerTitle: "Service Plan",
            }}
          />
          <Stack.Screen
            name="JobDetail"
            component={JobDetailScreen}
            options={{
              ...opaqueScreenOptions,
              headerTitle: "Job Details",
            }}
          />
          <Stack.Screen
            name="InvoiceDetail"
            component={InvoiceDetailScreen}
            options={{
              ...opaqueScreenOptions,
              headerTitle: "Invoice",
            }}
          />
          <Stack.Screen
            name="CertificateDetail"
            component={CertificateDetailScreen}
            options={{
              ...opaqueScreenOptions,
              headerTitle: "Certificate",
            }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{
              ...opaqueScreenOptions,
              headerTitle: "Privacy Policy",
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{
              ...opaqueScreenOptions,
              headerTitle: "Terms of Service",
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{
              ...opaqueScreenOptions,
              headerTitle: "Privacy Policy",
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{
              ...opaqueScreenOptions,
              headerTitle: "Terms of Service",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

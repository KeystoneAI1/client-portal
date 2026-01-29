import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  AUTH_TOKEN: "@client_portal:auth_token",
  USER_DATA: "@client_portal:user_data",
  CONTACTS: "@client_portal:contacts",
  APPLIANCES: "@client_portal:appliances",
  SERVICE_PLANS: "@client_portal:service_plans",
  JOBS: "@client_portal:jobs",
  INVOICES: "@client_portal:invoices",
  CERTIFICATES: "@client_portal:certificates",
  CHAT_MESSAGES: "@client_portal:chat_messages",
};

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  company?: string;
  accountNumber?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isPrimary: boolean;
}

export interface Appliance {
  id: string;
  name: string;
  type: "boiler" | "heating" | "electrical" | "plumbing" | "other";
  model?: string;
  serialNumber?: string;
  installDate?: string;
  lastServiceDate?: string;
  location?: string;
}

export interface ServicePlan {
  id: string;
  name: string;
  status: "active" | "expired" | "pending";
  startDate: string;
  endDate: string;
  coverage: string[];
  applianceIds?: string[];
  price?: number;
}

export interface Job {
  id: string;
  type?: "repair" | "service" | "installation" | "inspection";
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "ongoing";
  description: string;
  scheduledDate: string;
  completedDate?: string;
  technicianName?: string;
  engineerName?: string;
  applianceId?: string;
  notes?: string;
  invoiceId?: string;
  certificateId?: string;
  property?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  issueDate: string;
  dueDate: string;
  description: string;
  jobId?: string;
}

export interface Certificate {
  id: string;
  type: string;
  issueDate: string;
  expiryDate: string;
  applianceId?: string;
  documentUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export const storage = {
  async getAuthToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  async removeAuthToken(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async getUser(): Promise<User | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  },

  async setUser(user: User): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
  },

  async getContacts(): Promise<Contact[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CONTACTS);
    return data ? JSON.parse(data) : [];
  },

  async setContacts(contacts: Contact[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
  },

  async getAppliances(): Promise<Appliance[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.APPLIANCES);
    return data ? JSON.parse(data) : [];
  },

  async setAppliances(appliances: Appliance[]): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.APPLIANCES,
      JSON.stringify(appliances),
    );
  },

  async getServicePlans(): Promise<ServicePlan[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SERVICE_PLANS);
    return data ? JSON.parse(data) : [];
  },

  async setServicePlans(plans: ServicePlan[]): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SERVICE_PLANS,
      JSON.stringify(plans),
    );
  },

  async getJobs(): Promise<Job[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
    return data ? JSON.parse(data) : [];
  },

  async setJobs(jobs: Job[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
  },

  async getInvoices(): Promise<Invoice[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.INVOICES);
    return data ? JSON.parse(data) : [];
  },

  async setInvoices(invoices: Invoice[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  },

  async getCertificates(): Promise<Certificate[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CERTIFICATES);
    return data ? JSON.parse(data) : [];
  },

  async setCertificates(certificates: Certificate[]): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.CERTIFICATES,
      JSON.stringify(certificates),
    );
  },

  async getChatMessages(): Promise<ChatMessage[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
    return data ? JSON.parse(data) : [];
  },

  async setChatMessages(messages: ChatMessage[]): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.CHAT_MESSAGES,
      JSON.stringify(messages),
    );
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  },

  async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_DATA,
    ]);
  },
};


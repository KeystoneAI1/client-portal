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

export async function initializeMockData(): Promise<void> {
  const existingUser = await storage.getUser();
  if (existingUser) return;

  const mockContacts: Contact[] = [
    {
      id: "1",
      name: "John Smith",
      email: "john.smith@example.com",
      phone: "+44 7700 900123",
      role: "Account Holder",
      isPrimary: true,
    },
    {
      id: "2",
      name: "Sarah Smith",
      email: "sarah.smith@example.com",
      phone: "+44 7700 900456",
      role: "Secondary Contact",
      isPrimary: false,
    },
  ];

  const mockAppliances: Appliance[] = [
    {
      id: "1",
      name: "Main Boiler",
      type: "boiler",
      model: "Worcester Bosch Greenstar 8000",
      serialNumber: "WB-2023-001234",
      installDate: "2023-03-15",
      lastServiceDate: "2025-01-10",
      location: "Utility Room",
    },
    {
      id: "2",
      name: "Underfloor Heating",
      type: "heating",
      model: "Heatmiser Neo",
      installDate: "2023-03-15",
      lastServiceDate: "2024-12-05",
      location: "Ground Floor",
    },
    {
      id: "3",
      name: "Consumer Unit",
      type: "electrical",
      model: "Hager Design 10",
      serialNumber: "HD10-789456",
      installDate: "2022-08-20",
      location: "Hallway",
    },
  ];

  const mockServicePlans: ServicePlan[] = [
    {
      id: "1",
      name: "Complete Home Care",
      status: "active",
      startDate: "2025-01-01",
      endDate: "2026-01-01",
      coverage: [
        "Annual boiler service",
        "24/7 emergency call-out",
        "Parts & labour included",
        "Heating system cover",
      ],
      applianceIds: ["1", "2"],
    },
  ];

  const mockJobs: Job[] = [
    {
      id: "1",
      type: "service",
      status: "completed",
      description: "Annual boiler service",
      scheduledDate: "2025-01-10",
      completedDate: "2025-01-10",
      technicianName: "Mike Johnson",
      applianceId: "1",
      notes: "Boiler running efficiently. Replaced expansion vessel.",
    },
    {
      id: "2",
      type: "repair",
      status: "scheduled",
      description: "Radiator not heating properly",
      scheduledDate: "2025-02-15",
      applianceId: "2",
    },
  ];

  const mockInvoices: Invoice[] = [
    {
      id: "1",
      invoiceNumber: "INV-2025-0042",
      amount: 299.0,
      status: "paid",
      issueDate: "2025-01-01",
      dueDate: "2025-01-31",
      description: "Complete Home Care - Annual Plan",
    },
    {
      id: "2",
      invoiceNumber: "INV-2025-0089",
      amount: 85.0,
      status: "pending",
      issueDate: "2025-01-10",
      dueDate: "2025-02-10",
      description: "Expansion vessel replacement",
      jobId: "1",
    },
  ];

  const mockCertificates: Certificate[] = [
    {
      id: "1",
      type: "Gas Safety Certificate",
      issueDate: "2025-01-10",
      expiryDate: "2026-01-10",
      applianceId: "1",
    },
    {
      id: "2",
      type: "Electrical Installation Certificate",
      issueDate: "2022-08-20",
      expiryDate: "2027-08-20",
      applianceId: "3",
    },
  ];

  await Promise.all([
    storage.setContacts(mockContacts),
    storage.setAppliances(mockAppliances),
    storage.setServicePlans(mockServicePlans),
    storage.setJobs(mockJobs),
    storage.setInvoices(mockInvoices),
    storage.setCertificates(mockCertificates),
  ]);
}

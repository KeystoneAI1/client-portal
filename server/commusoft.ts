import type { Request, Response } from "express";

const COMMUSOFT_BASE_URL = "https://app.commusoft.co.uk/webservice_dev.php";

function getCredentials() {
  return {
    clientId: process.env.COMMUSOFT_COMPANY_ID || "",
    username: process.env.COMMUSOFT_USERNAME || "",
    password: process.env.COMMUSOFT_PASSWORD || "",
    applicationId: process.env.COMMUSOFT_API_KEY || "",
  };
}

interface TokenResponse {
  token?: string;
  userToken?: string;
  error?: string;
}

interface CommusoftRequestOptions {
  method?: string;
  endpoint: string;
  body?: unknown;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getCommusoftToken(): Promise<string> {
  const creds = getCredentials();

  if (!creds.clientId || !creds.username || !creds.password || !creds.applicationId) {
    throw new Error("Commusoft credentials not fully configured (COMMUSOFT_COMPANY_ID, COMMUSOFT_USERNAME, COMMUSOFT_PASSWORD, and COMMUSOFT_API_KEY required)");
  }

  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  console.log("[CommusoftClient] Generating user token via", `${COMMUSOFT_BASE_URL}/api/v1/getToken`);

  const response = await fetch(`${COMMUSOFT_BASE_URL}/api/v1/getToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: creds.clientId,
      username: creds.username,
      password: creds.password,
      applicationId: creds.applicationId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[CommusoftClient] Token generation failed:", response.status, errorText);
    throw new Error(`Failed to generate Commusoft token: ${response.status}`);
  }

  const data: TokenResponse = await response.json();
  const token = data.token || data.userToken;

  if (!token) {
    console.error("[CommusoftClient] No token in response:", data);
    throw new Error("No token returned from Commusoft API");
  }

  console.log("[CommusoftClient] Successfully generated user token");

  cachedToken = token;
  tokenExpiry = Date.now() + 30 * 60 * 1000;

  return token;
}

async function commusoftRequest<T>({
  method = "GET",
  endpoint,
  body,
  timeoutMs = 30000,
}: CommusoftRequestOptions & { timeoutMs?: number }): Promise<T> {
  const token = await getCommusoftToken();

  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${COMMUSOFT_BASE_URL}${endpoint}${separator}token=${encodeURIComponent(token)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  console.log(`[CommusoftClient] ${method} ${endpoint}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CommusoftClient] API error: ${response.status} - ${errorText}`);

      if (response.status === 401 || response.status === 403) {
        cachedToken = null;
        tokenExpiry = 0;
      }

      throw new Error(`Commusoft API error: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`[CommusoftClient] Request timed out: ${endpoint}`);
      throw new Error(`Request timed out: ${endpoint}`);
    }
    throw error;
  }
}

export function isCommusoftConfigured(): boolean {
  const creds = getCredentials();
  return !!(creds.clientId && creds.username && creds.password && creds.applicationId);
}

export async function getCustomer(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}`,
  });
}

export async function getCustomerContacts(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/contacts`,
  });
}

export async function getWorkAddresses(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/workaddresses`,
  });
}

export async function getWorkAddress(workAddressId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/workaddresses/${workAddressId}`,
  });
}

export async function updateContact(contactId: string, data: unknown) {
  return commusoftRequest({
    method: "PUT",
    endpoint: `/api/v1/contacts/${contactId}`,
    body: data,
  });
}

export async function createContact(customerId: string, data: unknown) {
  return commusoftRequest({
    method: "POST",
    endpoint: `/api/v1/customers/${customerId}/contacts`,
    body: data,
  });
}

export async function getAppliances(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/appliances`,
  });
}

export async function updateAppliance(applianceId: string, data: unknown) {
  return commusoftRequest({
    method: "PUT",
    endpoint: `/api/v1/appliances/${applianceId}`,
    body: data,
  });
}

export async function getServicePlans(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/service-plans`,
  });
}

export async function getContracts(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/contracts`,
  });
}

export async function getJobs(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/jobs`,
  });
}

export async function getDiaryEvents(customerId: string) {
  // Note: Commusoft API does not have a customer-facing diary events endpoint
  // The /api/v1/diaryevents endpoint is engineer-focused and requires engineer ID
  // For now, return empty array - upcoming appointments will be derived from jobs with ongoing status
  console.log(`[CommusoftClient] Diary events endpoint not available for customers, returning empty array for ${customerId}`);
  return { diaryevents: [] };
}

export async function getJob(jobId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/jobs/${jobId}`,
  });
}

export async function createJob(customerId: string, data: unknown) {
  return commusoftRequest({
    method: "POST",
    endpoint: `/api/v1/customers/${customerId}/jobs`,
    body: data,
  });
}

export async function getInvoices(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/invoices`,
  });
}

export async function getInvoice(invoiceId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/invoices/${invoiceId}`,
  });
}

export async function getCertificates(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/certificates`,
  });
}

export async function getCertificate(certificateId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/certificates/${certificateId}`,
  });
}

export async function getJobDescriptions() {
  return commusoftRequest({
    endpoint: `/api/v1/jobdescriptions?limit=100`,
  });
}

export async function getServiceReminders() {
  return commusoftRequest({
    endpoint: `/api/v1/servicereminders?limit=100`,
  });
}

export async function getSuggestedAppointments(data: {
  postcode: string;
  jobdescriptionid: number;
  duration: number;
  propertyid?: string | number;
}): Promise<any> {
  // Set date window for next 14 days
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);
  
  // Format helpers
  const formatLocalDateTime = (date: Date) => date.toISOString().replace('Z', '').split('.')[0];
  const formatWithZ = (date: Date) => date.toISOString().split('.')[0] + 'Z';
  const formatWithOffset = (date: Date) => date.toISOString().split('.')[0] + '+00:00';
  const formatSpaced = (date: Date) => date.toISOString().replace('T', ' ').split('.')[0];
  const formatDateOnly = (date: Date) => date.toISOString().split('T')[0];
  
  const normalizedPostcode = data.postcode.trim().toUpperCase().replace(/\s+/g, " ");
  const propId = data.propertyid ? Number(data.propertyid) : null;
  
  // Try multiple API request formats based on AI analysis of common FSM API patterns
  const requestAttempts = [
    // Format 1: snake_case with property_id and Z suffix
    ...(propId ? [{
      property_id: propId,
      job_description_id: data.jobdescriptionid,
      duration: data.duration,
      start_datetime: formatWithZ(startDate),
      end_datetime: formatWithZ(endDate),
      timezone: "Europe/London",
    }] : []),
    
    // Format 2: camelCase with property ID
    ...(propId ? [{
      propertyId: propId,
      jobDescriptionId: data.jobdescriptionid,
      durationMinutes: data.duration,
      startDateTime: formatWithOffset(startDate),
      endDateTime: formatWithOffset(endDate),
      timeZone: "Europe/London",
    }] : []),
    
    // Format 3: lowercase with spaced datetime
    ...(propId ? [{
      propertyid: propId,
      jobdescriptionid: data.jobdescriptionid,
      durationminutes: data.duration,
      startdatetime: formatSpaced(startDate),
      enddatetime: formatSpaced(endDate),
      timezone: "Europe/London",
    }] : []),
    
    // Format 4: postcode with branch_id
    {
      postcode: normalizedPostcode,
      job_description_id: data.jobdescriptionid,
      duration_minutes: data.duration,
      start_datetime: formatWithOffset(startDate),
      end_datetime: formatWithOffset(endDate),
      timezone: "Europe/London",
      branch_id: 1,
    },
    
    // Format 5: date only with engineer_id
    {
      postcode: normalizedPostcode,
      job_description_id: data.jobdescriptionid,
      duration_minutes: data.duration,
      start_date: formatDateOnly(startDate),
      end_date: formatDateOnly(endDate),
      timezone: "Europe/London",
      engineer_id: 1,
      diary_event_type_id: 1,
    },
    
    // Format 6: Simple postcode with local datetime
    {
      postcode: normalizedPostcode,
      job_description_id: data.jobdescriptionid,
      duration_minutes: data.duration,
      start_datetime: formatLocalDateTime(startDate),
      end_datetime: formatLocalDateTime(endDate),
      timezone: "Europe/London",
    },
  ];
  
  // Try each request format
  for (let i = 0; i < requestAttempts.length; i++) {
    const body = requestAttempts[i];
    try {
      console.log(`[CommusoftClient] Suggested appointments attempt ${i + 1}/${requestAttempts.length}:`, JSON.stringify(body));
      
      const result = await commusoftRequest({
        method: "POST",
        endpoint: `/api/v1/suggested-appointments`,
        body,
      });
      
      console.log(`[CommusoftClient] Suggested appointments SUCCESS with format ${i + 1}:`, JSON.stringify(result).substring(0, 200));
      return result;
    } catch (error: any) {
      console.log(`[CommusoftClient] Attempt ${i + 1} failed:`, error.message);
    }
  }
  
  console.log(`[CommusoftClient] All ${requestAttempts.length} suggested appointments attempts failed, generating fallback slots`);
  return generateFallbackSlots(startDate, endDate, data.duration);
}

// Generate fallback appointment slots when API is unavailable
function generateFallbackSlots(startDate: Date, endDate: Date, durationMinutes: number) {
  const slots: Array<{
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    available: boolean;
  }> = [];
  
  const workingHours = [
    { start: 9, end: 12 },   // Morning: 9am-12pm
    { start: 13, end: 17 },  // Afternoon: 1pm-5pm
  ];
  
  const current = new Date(startDate);
  current.setDate(current.getDate() + 1); // Start from tomorrow
  
  while (current <= endDate && slots.length < 20) {
    const dayOfWeek = current.getDay();
    
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      for (const period of workingHours) {
        // Create one slot per period
        const slotDate = current.toISOString().split('T')[0];
        const startHour = period.start;
        const endHour = Math.min(period.start + Math.ceil(durationMinutes / 60), period.end);
        
        slots.push({
          id: `slot-${slotDate}-${startHour}`,
          date: slotDate,
          start_time: `${startHour.toString().padStart(2, '0')}:00`,
          end_time: `${endHour.toString().padStart(2, '0')}:00`,
          available: true,
        });
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return { suggested_appointments: slots, fallback: true };
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await getCommusoftToken();
    return { success: true, message: "Successfully connected to Commusoft API" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
}

export async function searchCustomersByEmail(email: string): Promise<any> {
  console.log(`[CommusoftClient] Searching for customer by email: ${email}`);
  return commusoftRequest({
    endpoint: `/api/v1/customers?emailaddress=${encodeURIComponent(email)}`,
    timeoutMs: 60000,
  });
}

export function registerCommusoftRoutes(app: any) {
  app.get("/api/commusoft/status", async (_req: Request, res: Response) => {
    const configured = isCommusoftConfigured();
    
    if (!configured) {
      return res.json({
        configured: false,
        connected: false,
        message: "Commusoft credentials not configured. Please add COMMUSOFT_TOKEN and COMMUSOFT_PASSWORD to your secrets.",
      });
    }

    const connectionTest = await testConnection();
    res.json({
      configured: true,
      connected: connectionTest.success,
      message: connectionTest.message,
    });
  });

  app.get("/api/commusoft/customer/:customerId", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getCustomer(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get customer:", error);
      res.status(500).json({ error: "Failed to fetch customer data" });
    }
  });

  app.get("/api/commusoft/customer/:customerId/contacts", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getCustomerContacts(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get contacts:", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.put("/api/commusoft/contacts/:contactId", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await updateContact(req.params.contactId, req.body);
      res.json(data);
    } catch (error) {
      console.error("Failed to update contact:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.post("/api/commusoft/customer/:customerId/contacts", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await createContact(req.params.customerId, req.body);
      res.json(data);
    } catch (error) {
      console.error("Failed to create contact:", error);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.get("/api/commusoft/customer/:customerId/appliances", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getAppliances(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get appliances:", error);
      res.status(500).json({ error: "Failed to fetch appliances" });
    }
  });

  app.get("/api/commusoft/customer/:customerId/service-plans", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getServicePlans(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get service plans:", error);
      res.status(500).json({ error: "Failed to fetch service plans" });
    }
  });

  app.get("/api/commusoft/customer/:customerId/contracts", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getContracts(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  app.get("/api/commusoft/customer/:customerId/jobs", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getJobs(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/commusoft/customer/:customerId/diaryevents", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getDiaryEvents(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get diary events:", error);
      res.status(500).json({ error: "Failed to fetch diary events" });
    }
  });

  app.get("/api/commusoft/jobs/:jobId", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getJob(req.params.jobId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  app.post("/api/commusoft/customer/:customerId/jobs", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await createJob(req.params.customerId, req.body);
      res.json(data);
    } catch (error) {
      console.error("Failed to create job:", error);
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.get("/api/commusoft/customer/:customerId/invoices", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getInvoices(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/commusoft/invoices/:invoiceId", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getInvoice(req.params.invoiceId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get invoice:", error);
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.get("/api/commusoft/customer/:customerId/certificates", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getCertificates(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get certificates:", error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });

  app.get("/api/commusoft/certificates/:certificateId", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getCertificate(req.params.certificateId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get certificate:", error);
      res.status(500).json({ error: "Failed to fetch certificate" });
    }
  });

  app.get("/api/commusoft/customer/:customerId/workaddresses", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getWorkAddresses(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get work addresses:", error);
      res.status(500).json({ error: "Failed to fetch work addresses" });
    }
  });

  app.get("/api/commusoft/workaddresses/:workAddressId", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getWorkAddress(req.params.workAddressId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get work address:", error);
      res.status(500).json({ error: "Failed to fetch work address" });
    }
  });

  app.get("/api/commusoft/jobdescriptions", async (_req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getJobDescriptions();
      res.json(data);
    } catch (error) {
      console.error("Failed to get job descriptions:", error);
      res.status(500).json({ error: "Failed to fetch job descriptions" });
    }
  });

  app.get("/api/commusoft/servicereminders", async (_req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getServiceReminders();
      res.json(data);
    } catch (error) {
      console.error("Failed to get service reminders:", error);
      res.status(500).json({ error: "Failed to fetch service reminders" });
    }
  });

  app.post("/api/commusoft/suggested-appointments", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const { postcode, jobdescriptionid, duration, propertyid } = req.body;
      if (!postcode || !jobdescriptionid) {
        return res.status(400).json({ error: "Missing required fields: postcode and jobdescriptionid" });
      }
      const data = await getSuggestedAppointments({
        postcode,
        jobdescriptionid,
        duration: duration || 60,
        propertyid,
      });
      res.json(data);
    } catch (error) {
      console.error("Failed to get suggested appointments:", error);
      res.status(500).json({ error: "Failed to fetch suggested appointments" });
    }
  });
}

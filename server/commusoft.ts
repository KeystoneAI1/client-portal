import type { Request, Response } from "express";

// Commusoft has both dev and prod endpoints - we'll try both if one fails
const COMMUSOFT_DEV_URL = "https://app.commusoft.co.uk/webservice_dev.php";
const COMMUSOFT_PROD_URL = "https://app.commusoft.co.uk/webservice_prod_uk.php";
const COMMUSOFT_BASE_URL = COMMUSOFT_DEV_URL;

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
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
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

export async function getJobInvoices(customerId: string, jobId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/jobs/${jobId}/invoices`,
  });
}

export async function getInvoices(customerId: string) {
  // Invoices are per-job in Commusoft, so we need to get all jobs first then fetch invoices
  try {
    const jobsResult: any = await getJobs(customerId);
    const jobs = jobsResult?.Jobs || [];
    const allInvoices: any[] = [];

    for (const job of jobs) {
      try {
        const invoicesResult: any = await getJobInvoices(customerId, job.id);
        const invoices = invoicesResult?.invoices || invoicesResult?.Invoices || [];
        for (const inv of (Array.isArray(invoices) ? invoices : [invoices])) {
          if (inv && inv.id) {
            allInvoices.push({ ...inv, jobId: job.id, jobDescription: job.description });
          }
        }
      } catch {
        // Some jobs may not have invoices
      }
    }

    return { invoices: allInvoices };
  } catch (error) {
    console.error("[CommusoftClient] Failed to aggregate invoices:", error);
    return { invoices: [] };
  }
}

export async function getPropertyServiceReminders(customerId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/propertyservicereminders`,
  });
}

export async function getInvoice(customerId: string, jobId: string, invoiceId: string) {
  return commusoftRequest({
    endpoint: `/api/v1/customers/${customerId}/jobs/${jobId}/invoices/${invoiceId}`,
  });
}

export async function getCertificates(customerId: string) {
  // Certificates are accessed via property (invoiceAddressId), not customer ID
  // First get the customer to find their invoiceAddressId
  try {
    const customerData: any = await getCustomer(customerId);
    const customer = customerData?.Customer || customerData;
    const propertyId = customer?.invoiceAddressId || customer?.id;

    if (!propertyId) {
      console.log("[CommusoftClient] No property ID found for customer", customerId);
      return { certificates: [] };
    }

    console.log(`[CommusoftClient] Fetching certificates for property ${propertyId}`);
    const result: any = await commusoftRequest({
      endpoint: `/api/v1/integration/portal/properties/${propertyId}/certificate/list`,
    });

    // Normalize response: { count, data } -> { certificates }
    const certs = result?.data || [];
    return { certificates: certs, count: result?.count || certs.length };
  } catch (error) {
    console.error("[CommusoftClient] Certificate list failed:", error);
    return { certificates: [] };
  }
}

export async function getCertificate(jobId: string) {
  try {
    return await commusoftRequest({
      endpoint: `/api/v1/integration/portal/jobs/${jobId}/certificate/pdf`,
    });
  } catch {
    return { error: "Certificate not found" };
  }
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

// Get appointments for a specific job (to find scheduled date/time)
export async function getJobAppointments(jobId: string | number) {
  try {
    // Try /jobs/{id}/appointments first
    const result = await commusoftRequest({
      endpoint: `/api/v1/jobs/${jobId}/appointments`,
    });
    return result;
  } catch (error) {
    // If that fails, try /appointments?job_id=
    try {
      const result = await commusoftRequest({
        endpoint: `/api/v1/appointments?job_id=${jobId}`,
      });
      return result;
    } catch (e) {
      // Try diary events as last resort
      try {
        const result = await commusoftRequest({
          endpoint: `/api/v1/diaryevents?job_id=${jobId}`,
        });
        return result;
      } catch (err) {
        console.log(`[CommusoftClient] Could not find appointments for job ${jobId}`);
        return { appointments: [] };
      }
    }
  }
}

// Cached engineer IDs (users who appear on diary)
let cachedEngineerIds: string | null = null;
let engineerCacheExpiry: number = 0;

export async function getUsers(): Promise<any> {
  return commusoftRequest({
    endpoint: `/api/v1/users`,
  });
}

export async function getEngineerIds(): Promise<string> {
  if (cachedEngineerIds && Date.now() < engineerCacheExpiry) {
    return cachedEngineerIds;
  }

  const result: any = await getUsers();
  const users = result?.users || [];
  const engineers = users
    .filter((u: any) => u.appearondiary === true)
    .map((u: any) => u.id);

  if (engineers.length === 0) {
    throw new Error("No engineers found on diary");
  }

  cachedEngineerIds = engineers.join(",");
  engineerCacheExpiry = Date.now() + 60 * 60 * 1000; // 1 hour cache
  console.log(`[CommusoftClient] Cached ${engineers.length} engineer IDs: ${cachedEngineerIds}`);
  return cachedEngineerIds;
}

export async function getSuggestedAppointments(data: {
  propertyid?: string | number;
  customerid?: string | number;
  jobdescriptionid: number;
  duration: number;
  dateRange?: number;
}): Promise<any> {
  const engineerIds = await getEngineerIds();

  // Property is required by the Commusoft API - look it up if not provided
  let propertyId = data.propertyid ? Number(data.propertyid) : null;

  if (!propertyId && data.customerid) {
    try {
      const customerData: any = await getCustomer(String(data.customerid));
      const customer = customerData?.Customer || customerData;
      propertyId = customer?.invoiceAddressId || customer?.id || null;
      if (propertyId) {
        console.log(`[CommusoftClient] Resolved property ID ${propertyId} from customer ${data.customerid}`);
      }
    } catch {
      console.log(`[CommusoftClient] Could not resolve property ID for customer ${data.customerid}`);
    }
  }

  if (!propertyId) {
    console.log(`[CommusoftClient] No property ID available — suggested appointments requires property`);
    return { status: 200, appointments: [], api_unavailable: false, no_property: true };
  }

  const body: Record<string, any> = {
    engineers: engineerIds,
    job_description: data.jobdescriptionid,
    length_of_event: data.duration,
    date_range: data.dateRange || 28,
    property: propertyId,
  };

  console.log(`[CommusoftClient] Suggested appointments request:`, JSON.stringify(body));

  const result = await commusoftRequest<any>({
    method: "POST",
    endpoint: `/api/v1/suggested-appointments`,
    body,
  });

  console.log(`[CommusoftClient] Suggested appointments response status: ${result?.status}, dates: ${Object.keys(result?.appointments || {}).length}`);
  return result;
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
        message: "Commusoft credentials not configured. Set COMMUSOFT_COMPANY_ID, COMMUSOFT_USERNAME, COMMUSOFT_PASSWORD, and COMMUSOFT_API_KEY environment variables.",
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

  app.get("/api/commusoft/jobs/:jobId/appointments", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getJobAppointments(req.params.jobId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get job appointments:", error);
      res.status(500).json({ error: "Failed to fetch job appointments" });
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

  app.get("/api/commusoft/customer/:customerId/propertyservicereminders", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const data = await getPropertyServiceReminders(req.params.customerId);
      res.json(data);
    } catch (error) {
      console.error("Failed to get property service reminders:", error);
      res.status(500).json({ error: "Failed to fetch property service reminders" });
    }
  });

  app.get("/api/commusoft/engineers", async (_req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const result: any = await getUsers();
      const users = result?.users || [];
      const engineers = users
        .filter((u: any) => u.appearondiary === true)
        .map((u: any) => ({ id: u.id, name: u.name, surname: u.surname }));
      res.json({ engineers });
    } catch (error) {
      console.error("Failed to get engineers:", error);
      res.status(500).json({ error: "Failed to fetch engineers" });
    }
  });

  app.post("/api/commusoft/suggested-appointments", async (req: Request, res: Response) => {
    try {
      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Commusoft API not configured" });
      }
      const { jobdescriptionid, duration, propertyid, customerid, dateRange } = req.body;
      if (!jobdescriptionid) {
        return res.status(400).json({ error: "Missing required field: jobdescriptionid" });
      }
      const data = await getSuggestedAppointments({
        jobdescriptionid,
        duration: duration || 60,
        propertyid,
        customerid,
        dateRange: dateRange || 28,
      });
      res.json(data);
    } catch (error) {
      console.error("Failed to get suggested appointments:", error);
      res.status(500).json({ error: "Failed to fetch suggested appointments" });
    }
  });
}

import type { Request, Response } from "express";

const COMMUSOFT_BASE_URL = "https://app.commusoft.co.uk/webservice_dev.php";
const CLIENT_ID = "14377";
const USERNAME = "Matthews";

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
  const applicationId = process.env.COMMUSOFT_TOKEN;
  const password = process.env.COMMUSOFT_PASSWORD;

  if (!applicationId || !password) {
    throw new Error("Commusoft credentials not configured (COMMUSOFT_TOKEN and COMMUSOFT_PASSWORD required)");
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
      clientId: CLIENT_ID,
      username: USERNAME,
      password: password,
      applicationId: applicationId,
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
}: CommusoftRequestOptions): Promise<T> {
  const token = await getCommusoftToken();

  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${COMMUSOFT_BASE_URL}${endpoint}${separator}token=${encodeURIComponent(token)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  console.log(`[CommusoftClient] ${method} ${endpoint}`);

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

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
}

export function isCommusoftConfigured(): boolean {
  return !!(process.env.COMMUSOFT_TOKEN && process.env.COMMUSOFT_PASSWORD);
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

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await getCommusoftToken();
    return { success: true, message: "Successfully connected to Commusoft API" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
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
}

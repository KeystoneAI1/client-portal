import type { Request, Response } from "express";

const COMMUSOFT_API_BASE = process.env.COMMUSOFT_API_URL || "https://api.commusoft.co.uk";
const COMMUSOFT_API_KEY = process.env.COMMUSOFT_API_KEY;

interface CommusoftRequestOptions {
  method?: string;
  endpoint: string;
  body?: unknown;
}

async function commusoftRequest<T>({
  method = "GET",
  endpoint,
  body,
}: CommusoftRequestOptions): Promise<T> {
  if (!COMMUSOFT_API_KEY) {
    throw new Error("Commusoft API key not configured");
  }

  const url = `${COMMUSOFT_API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${COMMUSOFT_API_KEY}`,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Commusoft API error: ${response.status} - ${errorText}`);
    throw new Error(`Commusoft API error: ${response.status}`);
  }

  return response.json();
}

export function isCommusoftConfigured(): boolean {
  return !!COMMUSOFT_API_KEY;
}

export async function getCustomer(customerId: string) {
  return commusoftRequest({
    endpoint: `/customers/${customerId}`,
  });
}

export async function getCustomerContacts(customerId: string) {
  return commusoftRequest({
    endpoint: `/customers/${customerId}/contacts`,
  });
}

export async function updateContact(contactId: string, data: unknown) {
  return commusoftRequest({
    method: "PUT",
    endpoint: `/contacts/${contactId}`,
    body: data,
  });
}

export async function createContact(customerId: string, data: unknown) {
  return commusoftRequest({
    method: "POST",
    endpoint: `/customers/${customerId}/contacts`,
    body: data,
  });
}

export async function getAppliances(customerId: string) {
  return commusoftRequest({
    endpoint: `/customers/${customerId}/appliances`,
  });
}

export async function updateAppliance(applianceId: string, data: unknown) {
  return commusoftRequest({
    method: "PUT",
    endpoint: `/appliances/${applianceId}`,
    body: data,
  });
}

export async function getServicePlans(customerId: string) {
  return commusoftRequest({
    endpoint: `/customers/${customerId}/service-plans`,
  });
}

export async function getContracts(customerId: string) {
  return commusoftRequest({
    endpoint: `/customers/${customerId}/contracts`,
  });
}

export async function getJobs(customerId: string) {
  return commusoftRequest({
    endpoint: `/customers/${customerId}/jobs`,
  });
}

export async function getJob(jobId: string) {
  return commusoftRequest({
    endpoint: `/jobs/${jobId}`,
  });
}

export async function createJob(customerId: string, data: unknown) {
  return commusoftRequest({
    method: "POST",
    endpoint: `/customers/${customerId}/jobs`,
    body: data,
  });
}

export async function getInvoices(customerId: string) {
  return commusoftRequest({
    endpoint: `/customers/${customerId}/invoices`,
  });
}

export async function getInvoice(invoiceId: string) {
  return commusoftRequest({
    endpoint: `/invoices/${invoiceId}`,
  });
}

export async function getCertificates(customerId: string) {
  return commusoftRequest({
    endpoint: `/customers/${customerId}/certificates`,
  });
}

export async function getCertificate(certificateId: string) {
  return commusoftRequest({
    endpoint: `/certificates/${certificateId}`,
  });
}

export function registerCommusoftRoutes(app: any) {
  app.get("/api/commusoft/status", (_req: Request, res: Response) => {
    res.json({
      configured: isCommusoftConfigured(),
      message: isCommusoftConfigured()
        ? "Commusoft API is configured"
        : "Commusoft API key not configured. Please add COMMUSOFT_API_KEY to your secrets.",
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

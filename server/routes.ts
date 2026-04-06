import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import { registerCommusoftRoutes, isCommusoftConfigured, getCustomer, getCustomerContacts, searchCustomersByEmail, getUsers, getEngineerIds, getSuggestedAppointments } from "./commusoft";
import { sendVerificationCode, isTwilioConfigured } from "./sms";

import Anthropic from "@anthropic-ai/sdk";

const customerPasswords: Map<string, string> = new Map();

// Track which customers have installed/used the app
const appUsers: Map<string, { customerId: string; name: string; email: string; lastLogin: string }> = new Map();

// Announcements system — editable via API, shown to all customers
interface Announcement {
  id: string;
  type: "info" | "offer" | "warning" | "update";
  title: string;
  message: string;
  link?: string;
  linkText?: string;
  expiresAt?: string;
  createdAt: string;
  active: boolean;
}

const announcements: Announcement[] = [
  {
    id: "welcome-2026",
    type: "info",
    title: "Welcome to the Aquila Client Portal",
    message: "Manage your services, book appointments, and chat with our Tech Agent — all in one place.",
    createdAt: new Date().toISOString(),
    active: true,
  },
  {
    id: "summer-ac-2026",
    type: "offer",
    title: "Summer AC Offer — 10% Off Installation",
    message: "Beat the heat this summer. Get 10% off air conditioning installation when you book before June 30th.",
    linkText: "Book Now",
    createdAt: new Date().toISOString(),
    active: true,
  },
  {
    id: "ev-grant-2026",
    type: "update",
    title: "EV Charger Grants Available",
    message: "The OZEV grant covers up to £350 towards a home EV charger installation. We're approved installers — ask us about eligibility.",
    createdAt: new Date().toISOString(),
    active: true,
  },
  {
    id: "price-update-2026",
    type: "warning",
    title: "Service Price Update — April 2026",
    message: "Please note our service prices have been updated from 1st April 2026. Check your next booking for the latest pricing.",
    createdAt: new Date().toISOString(),
    active: true,
  },
];

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

interface PendingVerification {
  customerId: string;
  customerName: string;
  email: string;
  phone: string;
  code: string;
  expires: number;
}

const pendingVerifications: Map<string, PendingVerification> = new Map();

const validTokens: Map<string, { accountNumber: string; customerId: string; expires: number }> = new Map();

export async function registerRoutes(app: Express): Promise<Server> {
  registerCommusoftRoutes(app);

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { accountNumber, password } = req.body;

      if (!accountNumber || !password) {
        return res.status(400).json({ error: "Account number and password are required" });
      }

      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Service temporarily unavailable" });
      }

      try {
        const customerData: any = await getCustomer(accountNumber);

        if (!customerData) {
          return res.status(401).json({ error: "Invalid account number or password" });
        }

        const storedPassword = customerPasswords.get(accountNumber);
        if (storedPassword && storedPassword !== password) {
          return res.status(401).json({ error: "Invalid account number or password" });
        }

        if (!storedPassword) {
          customerPasswords.set(accountNumber, password);
        }

        const token = generateToken();
        validTokens.set(token, {
          accountNumber,
          customerId: customerData.id || accountNumber,
          expires: Date.now() + 24 * 60 * 60 * 1000,
        });

        const customer = customerData.Customer || customerData;
        
        let name = "";
        if (customer.name && customer.surname) {
          name = `${customer.name} ${customer.surname}`;
        } else if (customer.name) {
          name = customer.name;
        } else if (customer.companyname) {
          name = customer.companyname;
        } else {
          name = `Customer ${accountNumber}`;
        }

        const email = customer.emailaddress || 
                      customer.email || 
                      "";

        let phone = "";
        if (customer.mobile) {
          phone = customer.countrycode ? `+${customer.countrycode} ${customer.mobile}` : customer.mobile;
        } else if (customer.telephonenumber) {
          phone = customer.countrycode ? `+${customer.countrycode} ${customer.telephonenumber}` : customer.telephonenumber;
        }

        return res.json({
          token,
          customerId: customer.id || accountNumber,
          name,
          email,
          phone,
          company: customer.companyname || "",
          address: {
            line1: customer.addressline1 || "",
            line2: customer.addressline2 || "",
            line3: customer.addressline3 || "",
            town: customer.town || "",
            county: customer.county || "",
            postcode: customer.postcode || "",
          },
        });
      } catch (commusoftError: any) {
        console.error("Commusoft lookup failed:", commusoftError);
        return res.status(401).json({ error: "Invalid account number or password" });
      }
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  app.post("/api/auth/request-code", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }

      if (!isCommusoftConfigured()) {
        return res.status(503).json({ error: "Service temporarily unavailable" });
      }

      if (!isTwilioConfigured()) {
        return res.status(503).json({ error: "SMS service not configured" });
      }

      try {
        console.log("[Auth] Looking up customer by email:", email);
        const searchResult: any = await searchCustomersByEmail(email);
        console.log("[Auth] Search result:", JSON.stringify(searchResult).substring(0, 500));
        
        let customer: any = null;
        const customers = searchResult?.Customers || searchResult?.customers || [];
        
        if (customers.length > 0) {
          console.log("[Auth] Customers found:", customers.length, "emails:", customers.map((c: any) => c.emailaddress).join(", "));
          // Find exact email match (case-insensitive)
          customer = customers.find((c: any) => 
            c.emailaddress?.toLowerCase() === email.toLowerCase()
          );
          console.log("[Auth] Exact match found:", !!customer, customer?.id, customer?.emailaddress);
          // Fallback to first result if no exact match
          if (!customer) {
            console.log("[Auth] No exact match, using first customer");
            customer = customers[0];
          }
        } else if (searchResult?.Customer) {
          customer = searchResult.Customer;
        } else if (searchResult?.id) {
          customer = searchResult;
        }

        if (!customer) {
          console.log("[Auth] No customer found in search result");
          return res.status(404).json({ error: "No account found with this email address" });
        }
        console.log("[Auth] Found customer:", customer.id || customer.customerid);

        const customerId = customer.id || customer.customerid;
        
        // Try to get phone from customer data first (faster - no extra API call)
        let phone = "";
        if (customer.mobile) {
          phone = customer.countrycode ? `+${customer.countrycode}${customer.mobile}` : customer.mobile;
        } else if (customer.telephonenumber) {
          phone = customer.countrycode ? `+${customer.countrycode}${customer.telephonenumber}` : customer.telephonenumber;
        }
        
        // Only fetch contacts if we don't have a phone number yet
        if (!phone) {
          console.log("[Auth] No phone on customer, fetching contacts...");
          let contactsResult: any;
          try {
            contactsResult = await getCustomerContacts(customerId);
          } catch (e) {
            console.log("Failed to get contacts");
          }

          const contacts = contactsResult?.contact || contactsResult?.contacts || [];
          
          if (contacts.length > 0) {
            const primaryContact = contacts.find((c: any) => c.isprimary === "1" || c.isprimary === 1) || contacts[0];
            if (primaryContact.mobile) {
              phone = primaryContact.countrycode ? `+${primaryContact.countrycode}${primaryContact.mobile}` : primaryContact.mobile;
            } else if (primaryContact.telephonenumber) {
              phone = primaryContact.countrycode ? `+${primaryContact.countrycode}${primaryContact.telephonenumber}` : primaryContact.telephonenumber;
            }
          }
        }

        if (!phone) {
          return res.status(400).json({ error: "No mobile phone number on file for this account" });
        }

        let customerName = "";
        if (customer.name && customer.surname) {
          customerName = `${customer.name} ${customer.surname}`;
        } else if (customer.name) {
          customerName = customer.name;
        } else if (customer.companyname) {
          customerName = customer.companyname;
        }

        const code = generateVerificationCode();
        const maskedPhone = phone.slice(0, -4).replace(/\d/g, "*") + phone.slice(-4);

        pendingVerifications.set(email.toLowerCase(), {
          customerId,
          customerName,
          email: email.toLowerCase(),
          phone,
          code,
          expires: Date.now() + 10 * 60 * 1000,
        });

        const smsSent = await sendVerificationCode(phone, code);
        
        if (!smsSent) {
          pendingVerifications.delete(email.toLowerCase());
          return res.status(500).json({ error: "Failed to send verification code" });
        }

        return res.json({
          success: true,
          maskedPhone,
          message: `Verification code sent to ${maskedPhone}`,
        });
      } catch (commusoftError: any) {
        console.error("Customer lookup failed:", commusoftError);
        return res.status(404).json({ error: "No account found with this email address" });
      }
    } catch (error) {
      console.error("Request code error:", error);
      return res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify-code", async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required" });
      }

      const pending = pendingVerifications.get(email.toLowerCase());

      if (!pending) {
        return res.status(400).json({ error: "No pending verification found. Please request a new code." });
      }

      if (Date.now() > pending.expires) {
        pendingVerifications.delete(email.toLowerCase());
        return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
      }

      if (pending.code !== code) {
        return res.status(401).json({ error: "Invalid verification code" });
      }

      pendingVerifications.delete(email.toLowerCase());

      // Track app user
      appUsers.set(pending.customerId, {
        customerId: pending.customerId,
        name: pending.customerName,
        email: pending.email,
        lastLogin: new Date().toISOString(),
      });
      console.log(`[AppUsers] Customer ${pending.customerId} (${pending.customerName}) logged into app. Total app users: ${appUsers.size}`);

      const token = generateToken();
      validTokens.set(token, {
        accountNumber: pending.customerId,
        customerId: pending.customerId,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      });

      try {
        const customerData: any = await getCustomer(pending.customerId);
        const customer = customerData?.Customer || customerData;

        return res.json({
          token,
          customerId: pending.customerId,
          name: pending.customerName,
          email: pending.email,
          phone: pending.phone,
          company: customer?.companyname || "",
          address: customer ? {
            line1: customer.addressline1 || "",
            line2: customer.addressline2 || "",
            line3: customer.addressline3 || "",
            town: customer.town || "",
            county: customer.county || "",
            postcode: customer.postcode || "",
          } : {},
        });
      } catch (e) {
        return res.json({
          token,
          customerId: pending.customerId,
          name: pending.customerName,
          email: pending.email,
          phone: pending.phone,
        });
      }
    } catch (error) {
      console.error("Verify code error:", error);
      return res.status(500).json({ error: "Verification failed. Please try again." });
    }
  });

  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { message, history } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      // Sales intelligence: log what services customers are asking about
      const serviceKeywords = ["boiler", "solar", "ev", "charger", "heat pump", "battery", "electrical", "plumbing", "radiator", "thermostat", "air conditioning", "underfloor"];
      const matchedServices = serviceKeywords.filter(kw => message.toLowerCase().includes(kw));
      if (matchedServices.length > 0) {
        console.log(`[SalesIntel] Customer query topics: ${matchedServices.join(", ")} | Message: "${message.substring(0, 100)}"`);
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error("ANTHROPIC_API_KEY not set");
        return res.json({ response: "I'm temporarily unavailable. Please try again later or call us on 01925 234450." });
      }

      const anthropic = new Anthropic({ apiKey });

      const systemPrompt = `You are Tech Agent, the virtual engineer for Aquila Energy Solutions (formerly Aquila Heating & Plumbing). You're an experienced engineer who diagnoses problems like a real tradesperson would — by asking the right questions first.

DIAGNOSTIC APPROACH:
- ALWAYS ask clarifying questions before diagnosing. A real engineer asks before answering.
- Ask about: make/model of appliance, when it started, weather conditions, any recent work done, error codes displayed
- For boiler faults: ask the make (Worcester, Vaillant, Baxi, Ideal, etc.) and the exact error code
- For heating issues: ask if it's hot water, central heating, or both affected

BRAND-SPECIFIC KNOWLEDGE:
Worcester Bosch:
- EA fault = ignition failure. In cold weather (below 0°C), most common cause is frozen condensate pipe. Ask about weather first.
- E9 = overheating/dry fire. Check pump and system pressure.
- A1 = no gas supply. Check gas meter and prepayment.
- D5 = sensor fault.

Vaillant:
- F75 = pressure sensor/pump fault. Try repressurising to 1.2 bar first.
- F28/F29 = ignition failure. Similar to Worcester EA — check condensate in winter.
- F22 = low water pressure.

Baxi:
- E133 = ignition lockout. Check gas supply and condensate.
- E119 = low water pressure.
- E168 = no signal from ignition lead.

Ideal:
- F1 = low water pressure.
- L2 = ignition failure.
- FD = fan fault.

FROZEN CONDENSATE (common winter issue):
If customer reports ignition fault (EA, F28, E133, L2) AND it's cold weather:
1. Ask "Is it cold outside — near or below freezing?"
2. If yes: "This is very likely a frozen condensate pipe. The white plastic pipe that goes from your boiler outside has frozen. You can try pouring warm (NOT boiling) water over the outside pipe to thaw it, then reset the boiler. If it keeps happening, we can insulate the pipe for you."

SAFETY — ALWAYS PRIORITISE:
- Gas smell → "Leave the property immediately, don't use switches or phones inside. Call the Gas Emergency line: 0800 111 999"
- Carbon monoxide symptoms → "Open windows, leave property, call 0800 111 999"
- Electrical sparking/burning smell → "Turn off the main breaker, don't touch anything. Call us on 01925 234450"
- Water flooding → "Turn off the stopcock immediately, then call us"

AQUILA'S FULL SERVICE RANGE (MCS, NICEIC, OZEV, F-Gas certified):
Servicing & Maintenance:
- Boiler servicing (gas NG/LPG, oil) | Gas Safety Certificates (CP12)
- Air conditioning servicing | Heat pump servicing (ASHP)
- EICR electrical reports | PAT testing
- Unvented cylinder servicing | Fire safety servicing
- Powerflush | MVHR servicing

Installations & Renewables:
- Solar PV panels (MCS certified) | Battery storage systems
- Air source heat pumps (MCS certified) | EV charger installation (OZEV approved)
- Air conditioning installation | Boiler replacements
- Full electrical rewiring | Smart heating controls

Commercial Services:
- Commercial boiler servicing | Large-scale solar PV
- Commercial AC installation | EPC upgrades for landlords

SALES AWARENESS:
- If a customer mentions energy bills, suggest solar PV + battery storage
- If they mention a new electric car, mention EV charger installation
- If they mention cold rooms or poor heating, suggest a powerflush or heating upgrade
- If they mention an old boiler (10+ years), suggest a replacement quote
- If they mention hot summers or working from home, suggest AC installation
- Always mention the referral programme: "Recommend us and you both get £100 off"

TONE:
- Talk like a friendly, knowledgeable engineer — not a robot
- Use plain English, avoid jargon unless explaining a technical term
- Be concise — short paragraphs, bullet points where helpful
- Ask ONE or TWO questions at a time, not a long list`;

      const claudeMessages = (history || []).slice(-8).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      claudeMessages.push({ role: "user" as const, content: message });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: systemPrompt,
        messages: claudeMessages,
      });

      const textContent = response.content.find((c: any) => c.type === "text");
      const responseText = textContent?.text || "I'm sorry, I couldn't process that. Please try again.";

      return res.json({ response: responseText });
    } catch (error) {
      console.error("Chat endpoint error:", error);
      return res.json({
        response: "I'm having trouble connecting right now. For urgent issues, please call us on 01925 234450.",
      });
    }
  });

  // Announcements — customer-facing feed
  app.get("/api/announcements", (_req: Request, res: Response) => {
    const now = new Date();
    const active = announcements.filter(a => {
      if (!a.active) return false;
      if (a.expiresAt && new Date(a.expiresAt) < now) return false;
      return true;
    });
    res.json({ announcements: active });
  });

  // Admin: create announcement
  app.post("/api/admin/announcements", (req: Request, res: Response) => {
    const { type, title, message, link, linkText, expiresAt } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "title and message are required" });
    }
    const announcement: Announcement = {
      id: crypto.randomBytes(8).toString("hex"),
      type: type || "info",
      title,
      message,
      link,
      linkText,
      expiresAt,
      createdAt: new Date().toISOString(),
      active: true,
    };
    announcements.unshift(announcement);
    res.json(announcement);
  });

  // Admin: update announcement
  app.put("/api/admin/announcements/:id", (req: Request, res: Response) => {
    const idx = announcements.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    Object.assign(announcements[idx], req.body);
    res.json(announcements[idx]);
  });

  // Admin: delete announcement
  app.delete("/api/admin/announcements/:id", (req: Request, res: Response) => {
    const idx = announcements.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    announcements[idx].active = false;
    res.json({ success: true });
  });

  // Admin: list app users (customers who have logged into the app)
  app.get("/api/admin/app-users", (_req: Request, res: Response) => {
    const users = Array.from(appUsers.values());
    res.json({ count: users.length, users });
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      commusoft: isCommusoftConfigured() ? "configured" : "not_configured",
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}

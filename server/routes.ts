import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import { registerCommusoftRoutes, isCommusoftConfigured, getCustomer, getCustomerContacts, searchCustomersByEmail, getUsers, getEngineerIds, getSuggestedAppointments } from "./commusoft";
import { sendVerificationCode, isTwilioConfigured } from "./sms";

import Anthropic from "@anthropic-ai/sdk";

const customerPasswords: Map<string, string> = new Map();

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

      const systemPrompt = `You are Tech Agent, the virtual engineer for Aquila Heating & Plumbing. You are an expert in plumbing, heating, gas, electrical, solar, EV chargers, heat pumps, air conditioning, and home energy systems.

Your role:
- Help customers diagnose and understand issues with their home systems
- Provide clear, practical troubleshooting advice
- Know when to recommend professional help vs DIY fixes
- For safety-critical issues (gas leaks, electrical hazards, carbon monoxide), ALWAYS tell them to call the gas emergency line (0800 111 999) or turn off the supply and call Aquila immediately on 01925 234450

Aquila's services include:
- Boiler servicing & repair (gas NG/LPG, oil)
- Gas Safety Certificates (CP12)
- EICR electrical reports
- Air conditioning servicing
- Heat pump servicing (ASHP)
- Fire safety servicing
- Unvented cylinder servicing
- PAT testing
- Powerflush
- Plumbing & electrical work
- Diagnostic call-outs

When a customer describes a problem that needs professional attention, suggest they book a service through the app. If they ask about services Aquila offers (like EV chargers, solar, battery storage), let them know what's available and encourage booking.

Keep responses concise, friendly, and practical. Use plain English, not jargon. You're talking to homeowners, not engineers.`;

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

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import { registerCommusoftRoutes, isCommusoftConfigured, getCustomer, getCustomerContacts, searchCustomersByEmail } from "./commusoft";
import { sendVerificationCode, isTwilioConfigured } from "./sms";

const VAI_API_URL = "https://vai.keystoneai.tech";

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
        
        let contactsResult: any;
        try {
          contactsResult = await getCustomerContacts(customerId);
        } catch (e) {
          console.log("Failed to get contacts, using customer data");
        }

        let phone = "";
        const contacts = contactsResult?.contact || contactsResult?.contacts || [];
        
        if (contacts.length > 0) {
          const primaryContact = contacts.find((c: any) => c.isprimary === "1" || c.isprimary === 1) || contacts[0];
          if (primaryContact.mobile) {
            phone = primaryContact.countrycode ? `+${primaryContact.countrycode}${primaryContact.mobile}` : primaryContact.mobile;
          } else if (primaryContact.telephonenumber) {
            phone = primaryContact.countrycode ? `+${primaryContact.countrycode}${primaryContact.telephonenumber}` : primaryContact.telephonenumber;
          }
        }
        
        if (!phone && customer.mobile) {
          phone = customer.countrycode ? `+${customer.countrycode}${customer.mobile}` : customer.mobile;
        } else if (!phone && customer.telephonenumber) {
          phone = customer.countrycode ? `+${customer.countrycode}${customer.telephonenumber}` : customer.telephonenumber;
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

      const systemPrompt = `You are VAI, a helpful virtual assistant specializing in plumbing, heating, and electrical questions. You help homeowners understand issues with their home systems and provide guidance on maintenance, troubleshooting, and when to call a professional.

Key guidelines:
- Be friendly, professional, and helpful
- Provide clear, easy-to-understand explanations
- For safety-critical issues (gas leaks, electrical hazards, water damage), always recommend calling a professional immediately
- When appropriate, suggest preventive maintenance tips
- If you don't know something, admit it and recommend consulting a qualified tradesperson
- Keep responses concise but informative`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...(history || []).slice(-8),
        { role: "user", content: message },
      ];

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const apiResponse = await fetch(`${VAI_API_URL}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (apiResponse.ok) {
          const data = await apiResponse.json();
          return res.json({
            response: data.response || data.message || data.content || "I received your message but couldn't generate a response.",
          });
        }

        console.error("VAI API error:", apiResponse.status, await apiResponse.text());
      } catch (apiError) {
        console.error("Failed to reach VAI API:", apiError);
      }

      const fallbackResponses: Record<string, string> = {
        boiler: "For boiler issues, first check if the pilot light is on and the thermostat is set correctly. If you smell gas, leave the property immediately and call the gas emergency line. For persistent issues like strange noises, leaks, or no hot water, I'd recommend booking a service with a Gas Safe registered engineer.",
        radiator: "To bleed a radiator: 1) Turn off your heating and let radiators cool. 2) Place a cloth under the bleed valve. 3) Use a radiator key to slowly open the valve. 4) Let air escape until water starts coming out. 5) Close the valve. This helps remove trapped air that prevents proper heating.",
        thermostat: "For optimal comfort and efficiency, set your thermostat to 18-21°C (64-70°F) during the day when home. Lower it by 2-3 degrees at night or when away. Programmable thermostats can automate this and save on energy bills.",
        leak: "For water leaks: 1) Turn off the water supply at the stopcock immediately. 2) Turn off the heating if it's a heating system leak. 3) Collect dripping water to prevent damage. 4) Call a plumber promptly. Don't ignore leaks as they can cause significant water damage.",
        electrical: "For electrical issues, safety is paramount. Never attempt repairs yourself unless you're qualified. If you experience frequent tripping, burning smells, sparking, or flickering lights, turn off the affected circuit and call a qualified electrician. These could indicate serious hazards.",
        default: "I'm here to help with your plumbing, heating, and electrical questions. Could you provide more details about the issue you're experiencing? For example:\n\n- What type of system or appliance is affected?\n- When did you first notice the problem?\n- Are there any specific symptoms like noises, leaks, or smells?\n\nThis will help me give you more targeted advice.",
      };

      const lowerMessage = message.toLowerCase();
      let response = fallbackResponses.default;

      if (lowerMessage.includes("boiler") || lowerMessage.includes("heating")) {
        response = fallbackResponses.boiler;
      } else if (lowerMessage.includes("radiator") || lowerMessage.includes("bleed")) {
        response = fallbackResponses.radiator;
      } else if (lowerMessage.includes("thermostat") || lowerMessage.includes("temperature")) {
        response = fallbackResponses.thermostat;
      } else if (lowerMessage.includes("leak") || lowerMessage.includes("water")) {
        response = fallbackResponses.leak;
      } else if (lowerMessage.includes("electric") || lowerMessage.includes("power") || lowerMessage.includes("socket")) {
        response = fallbackResponses.electrical;
      }

      return res.json({ response });
    } catch (error) {
      console.error("Chat endpoint error:", error);
      return res.status(500).json({
        error: "Failed to process message",
        response: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
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

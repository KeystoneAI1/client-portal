import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import { registerCommusoftRoutes, isCommusoftConfigured, getCustomer } from "./commusoft";

const VAI_API_URL = "https://vai.keystoneai.tech";

const customerPasswords: Map<string, string> = new Map();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

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

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import { registerCommusoftRoutes, isCommusoftConfigured, getCustomer, getCustomerContacts, searchCustomersByEmail, getUsers, getEngineerIds, getSuggestedAppointments } from "./commusoft";
import { sendVerificationCode, isTwilioConfigured } from "./sms";

import Anthropic from "@anthropic-ai/sdk";

// Inline single-page admin UI. Served at GET /admin. Auth is via the same
// X-Admin-Key header the JSON endpoints require — the page caches it in
// localStorage after the first successful request and offers a Sign out button.
const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aquila Client Portal — Admin</title>
<style>
  :root { --primary:#1E5A8E; --bg:#F8F9FA; --card:#fff; --border:#E5E7EB; --text:#111827; --muted:#6B7280; --warn:#FEF3C7; --warnBorder:#FCD34D; --warnText:#92400E; --offer:#D1FAE5; --offerBorder:#6EE7B7; --offerText:#047857; --info:#DBEAFE; --infoBorder:#93C5FD; --infoText:#1E40AF; --update:#E0E7FF; --updateBorder:#A5B4FC; --updateText:#3730A3; --danger:#DC2626; }
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;background:var(--bg);color:var(--text)}
  header{background:var(--primary);color:#fff;padding:18px 24px;display:flex;align-items:center;justify-content:space-between}
  header h1{margin:0;font-size:18px;font-weight:600}
  header .right{display:flex;gap:12px;align-items:center}
  header button{background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px}
  header button:hover{background:rgba(255,255,255,.25)}
  main{max-width:900px;margin:0 auto;padding:24px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:16px}
  .login{max-width:420px;margin:80px auto}
  .login h2{margin-top:0}
  label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--text)}
  input,textarea,select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit}
  input:focus,textarea:focus,select:focus{outline:none;border-color:var(--primary)}
  textarea{resize:vertical;min-height:80px}
  .row{display:flex;gap:12px;margin-bottom:14px}
  .row>div{flex:1}
  .btn{background:var(--primary);color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}
  .btn:hover{opacity:.9}
  .btn-secondary{background:#fff;color:var(--text);border:1px solid var(--border)}
  .btn-danger{background:var(--danger);color:#fff;border:none}
  .btn-sm{padding:6px 12px;font-size:13px}
  .err{color:var(--danger);font-size:13px;margin-top:8px}
  .ann{display:flex;align-items:flex-start;gap:14px;padding:14px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;background:#fff}
  .ann.inactive{opacity:.55}
  .badge{display:inline-block;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
  .badge.warning{background:var(--warn);color:var(--warnText)}
  .badge.offer{background:var(--offer);color:var(--offerText)}
  .badge.info{background:var(--info);color:var(--infoText)}
  .badge.update{background:var(--update);color:var(--updateText)}
  .ann-body{flex:1;min-width:0}
  .ann-title{font-weight:700;margin:6px 0 4px 0}
  .ann-msg{color:var(--muted);font-size:13px;line-height:1.5}
  .ann-meta{font-size:11px;color:var(--muted);margin-top:6px}
  .ann-actions{display:flex;flex-direction:column;gap:6px}
  h2{font-size:18px;margin:0 0 12px 0}
  h3{font-size:15px;margin:24px 0 10px 0;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  .empty{text-align:center;padding:30px;color:var(--muted);font-size:14px}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none}
  .toast.show{opacity:1}
</style>
</head>
<body>
<div id="root"></div>
<div id="toast" class="toast"></div>
<script>
const API = window.location.origin;
const KEY_STORAGE = "aquila_admin_key";
let adminKey = localStorage.getItem(KEY_STORAGE) || "";
let editingId = null;

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function api(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    localStorage.removeItem(KEY_STORAGE);
    adminKey = "";
    render();
    throw new Error("Invalid admin key");
  }
  if (!r.ok) throw new Error("Request failed: " + r.status);
  return r.json();
}

async function loadAnnouncements() {
  try {
    const d = await api("GET", "/api/admin/announcements");
    return d.announcements || [];
  } catch (e) { return []; }
}

function renderLogin(err) {
  document.getElementById("root").innerHTML = \`
    <main>
      <div class="card login">
        <h2>Admin Sign In</h2>
        <p style="color:var(--muted);font-size:13px;margin-top:0">Enter the admin key to manage announcements and offers.</p>
        <form id="loginForm">
          <label for="keyInput">Admin Key</label>
          <input id="keyInput" type="password" autocomplete="current-password" placeholder="••••••••" required>
          <div style="margin-top:14px;display:flex;justify-content:flex-end">
            <button class="btn" type="submit">Sign in</button>
          </div>
          \${err ? \`<div class="err">\${escapeHtml(err)}</div>\` : ""}
        </form>
      </div>
    </main>\`;
  document.getElementById("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const v = document.getElementById("keyInput").value.trim();
    if (!v) return;
    adminKey = v;
    try {
      await api("GET", "/api/admin/announcements");
      localStorage.setItem(KEY_STORAGE, v);
      render();
    } catch (err) {
      adminKey = "";
      renderLogin("Invalid admin key");
    }
  });
}

function announcementCard(a) {
  const expires = a.expiresAt ? new Date(a.expiresAt).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) : "no expiry";
  return \`
    <div class="ann \${a.active ? "" : "inactive"}">
      <div class="ann-body">
        <span class="badge \${escapeHtml(a.type || "info")}">\${escapeHtml(a.type || "info")}</span>
        <div class="ann-title">\${escapeHtml(a.title)}</div>
        <div class="ann-msg">\${escapeHtml(a.message)}</div>
        \${a.link ? \`<div class="ann-meta">↗ <a href="\${escapeHtml(a.link)}" target="_blank" rel="noopener">\${escapeHtml(a.linkText || a.link)}</a></div>\` : ""}
        <div class="ann-meta">\${a.active ? "Active" : "Hidden"} · expires \${expires} · id \${escapeHtml(a.id)}</div>
      </div>
      <div class="ann-actions">
        <button class="btn btn-secondary btn-sm" data-edit="\${escapeHtml(a.id)}">Edit</button>
        <button class="btn btn-danger btn-sm" data-delete="\${escapeHtml(a.id)}">\${a.active ? "Hide" : "Hidden"}</button>
      </div>
    </div>\`;
}

async function renderHome() {
  const list = await loadAnnouncements();
  const editing = editingId ? list.find(a => a.id === editingId) : null;

  document.getElementById("root").innerHTML = \`
    <header>
      <h1>Aquila Client Portal — Admin</h1>
      <div class="right">
        <button id="logout">Sign out</button>
      </div>
    </header>
    <main>
      <div class="card">
        <h2>\${editing ? "Edit announcement" : "New announcement"}</h2>
        <form id="annForm">
          <div class="row">
            <div>
              <label>Type</label>
              <select id="f_type">
                <option value="info">Info</option>
                <option value="offer">Offer</option>
                <option value="warning">Warning / Price update</option>
                <option value="update">Update</option>
              </select>
            </div>
            <div>
              <label>Expires (optional)</label>
              <input id="f_expires" type="date">
            </div>
          </div>
          <div style="margin-bottom:14px">
            <label>Title</label>
            <input id="f_title" required maxlength="100" placeholder="Service Price Update — April 2026">
          </div>
          <div style="margin-bottom:14px">
            <label>Message</label>
            <textarea id="f_message" required maxlength="500" placeholder="Please note our service prices have been updated…"></textarea>
          </div>
          <div class="row">
            <div>
              <label>Link URL (optional)</label>
              <input id="f_link" type="url" placeholder="https://cal.keystoneai.tech/...">
            </div>
            <div>
              <label>Link button text</label>
              <input id="f_linkText" maxlength="40" placeholder="Book Now">
            </div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            \${editing ? '<button type="button" id="cancelEdit" class="btn btn-secondary">Cancel</button>' : ""}
            <button type="submit" class="btn">\${editing ? "Save changes" : "Create announcement"}</button>
          </div>
        </form>
      </div>

      <h3>Active (\${list.filter(a => a.active).length})</h3>
      \${list.filter(a => a.active).map(announcementCard).join("") || '<div class="empty">No active announcements.</div>'}

      <h3>Hidden (\${list.filter(a => !a.active).length})</h3>
      \${list.filter(a => !a.active).map(announcementCard).join("") || '<div class="empty">No hidden announcements.</div>'}
    </main>\`;

  if (editing) {
    document.getElementById("f_type").value = editing.type || "info";
    document.getElementById("f_title").value = editing.title || "";
    document.getElementById("f_message").value = editing.message || "";
    document.getElementById("f_link").value = editing.link || "";
    document.getElementById("f_linkText").value = editing.linkText || "";
    if (editing.expiresAt) {
      document.getElementById("f_expires").value = editing.expiresAt.slice(0,10);
    }
  }

  document.getElementById("logout").addEventListener("click", () => {
    localStorage.removeItem(KEY_STORAGE);
    adminKey = "";
    editingId = null;
    render();
  });

  if (editing) {
    document.getElementById("cancelEdit").addEventListener("click", () => {
      editingId = null;
      render();
    });
  }

  document.getElementById("annForm").addEventListener("submit", async e => {
    e.preventDefault();
    const body = {
      type: document.getElementById("f_type").value,
      title: document.getElementById("f_title").value.trim(),
      message: document.getElementById("f_message").value.trim(),
      link: document.getElementById("f_link").value.trim() || undefined,
      linkText: document.getElementById("f_linkText").value.trim() || undefined,
      expiresAt: document.getElementById("f_expires").value
        ? new Date(document.getElementById("f_expires").value).toISOString()
        : undefined,
    };
    try {
      if (editing) {
        await api("PUT", "/api/admin/announcements/" + editing.id, body);
        toast("Updated");
      } else {
        await api("POST", "/api/admin/announcements", body);
        toast("Created");
      }
      editingId = null;
      render();
    } catch (err) {
      toast("Failed: " + err.message);
    }
  });

  document.querySelectorAll("[data-edit]").forEach(b => {
    b.addEventListener("click", () => {
      editingId = b.getAttribute("data-edit");
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-delete]").forEach(b => {
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-delete");
      const a = list.find(x => x.id === id);
      if (!a || !a.active) return;
      if (!confirm("Hide \\"" + a.title + "\\"? Customers will no longer see it.")) return;
      try {
        await api("DELETE", "/api/admin/announcements/" + id);
        toast("Hidden");
        render();
      } catch (err) {
        toast("Failed: " + err.message);
      }
    });
  });
}

function render() {
  if (!adminKey) renderLogin();
  else renderHome();
}
render();
</script>
</body>
</html>`;

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
    title: "EV Charger — Free Video Quote",
    message: "Get a free video quote for an EV charger installation. The OZEV grant covers up to £350 — we're approved installers.",
    link: "https://cal.keystoneai.tech/lee/ev-charger-video-call",
    linkText: "Book Video Quote",
    createdAt: new Date().toISOString(),
    active: true,
  },
  {
    id: "solar-survey-2026",
    type: "offer",
    title: "Solar + Battery — Free Video Survey",
    message: "Cut your energy bills by up to 70%. Book a free, no-obligation video survey with our MCS-certified team.",
    link: "https://cal.keystoneai.tech/lee/solar-video-survey",
    linkText: "Book Free Survey",
    createdAt: new Date().toISOString(),
    active: true,
  },
  {
    id: "ashp-survey-2026",
    type: "update",
    title: "Heat Pump — Free Video Survey",
    message: "Considering an air source heat pump? Get a free survey with Phil. BUS grant of £7,500 available.",
    link: "https://cal.keystoneai.tech/phil/ashp-video-survey",
    linkText: "Book Survey",
    createdAt: new Date().toISOString(),
    active: true,
  },
  {
    id: "boiler-quote-2026",
    type: "info",
    title: "New Boiler? Free Home Survey",
    message: "Get a free home survey for a new boiler installation. Gas Safe registered installers, finance available.",
    link: "https://cal.keystoneai.tech/phil/boiler-home-survey",
    linkText: "Book Home Survey",
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

      const claudeMessages = (history || []).slice(-10).map((m: any) => ({
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

  // Admin auth check. Accept either ADMIN_API_KEY or ADMIN_KEY env var so the
  // deploy command and the historical code variable both work.
  const requireAdmin = (req: Request, res: Response, next: Function) => {
    const adminKey = process.env.ADMIN_API_KEY || process.env.ADMIN_KEY || "aquila-admin-2026";
    const provided = req.header("X-Admin-Key") || req.query.admin_key;
    if (provided !== adminKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Admin: create announcement
  app.post("/api/admin/announcements", requireAdmin, (req: Request, res: Response) => {
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
  app.put("/api/admin/announcements/:id", requireAdmin, (req: Request, res: Response) => {
    const idx = announcements.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    Object.assign(announcements[idx], req.body);
    res.json(announcements[idx]);
  });

  // Admin: delete announcement
  app.delete("/api/admin/announcements/:id", requireAdmin, (req: Request, res: Response) => {
    const idx = announcements.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    announcements[idx].active = false;
    res.json({ success: true });
  });

  // Admin: list app users (customers who have logged into the app)
  app.get("/api/admin/app-users", requireAdmin, (_req: Request, res: Response) => {
    const users = Array.from(appUsers.values());
    res.json({ count: users.length, users });
  });

  // Admin: list ALL announcements (active + inactive) for management UI
  app.get("/api/admin/announcements", requireAdmin, (_req: Request, res: Response) => {
    res.json({ announcements });
  });

  // Admin web page — single-file HTML with login + announcement CRUD.
  // Registered before the SPA fallback so /admin doesn't fall through to the customer app.
  app.get("/admin", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(ADMIN_HTML);
  });
  app.get("/admin/", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(ADMIN_HTML);
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

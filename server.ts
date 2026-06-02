/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { 
  initializeDb, 
  getStaffList, 
  findStaffByUsername, 
  saveStaffList, 
  getAttendanceList, 
  saveAttendanceList, 
  hashPassword 
} from "./server/db";
import { Staff, AttendanceRecord, Session } from "./src/types";

// Setup server state
const PORT = 8000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express v4/v5 robust trust-proxy configuration
app.set("trust proxy", true);

// Dev & Demo Active Sessions
const sessions: Map<string, Session> = new Map();

// Generate unique session token
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// IP Resolver helper
function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ipList = typeof forwarded === "string" ? forwarded.split(",") : forwarded;
    if (Array.isArray(ipList) && ipList.length > 0) {
      return ipList[0].trim();
    }
  }
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

// Middleware: Require Auth
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized. Missing authentication token." });
    return;
  }

  const token = authHeader.substring(7);
  const session = sessions.get(token);

  if (!session) {
    res.status(401).json({ error: "Session expired or invalid. Please log in again." });
    return;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    res.status(401).json({ error: "Session expired. Please log in again." });
    return;
  }

  // Set user context
  (req as any).user = {
    username: session.username,
    fullName: session.fullName,
    discordId: session.discordId,
    isAdmin: session.isAdmin,
  };
  (req as any).token = token;

  next();
}

// Middleware: Require Admin
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  requireAuth(req, res, () => {
    if (!(req as any).user.isAdmin) {
      res.status(403).json({ error: "Access denied. Admin privileges required." });
      return;
    }
    next();
  });
}

// Initialize datastore
initializeDb().then(() => {
  console.log("HDX-STAFF database initialized successfully.");
});

// API Routes

// Helper to determine active cooldown state of a user
async function getUserCooldown(username: string) {
  const attendanceList = await getAttendanceList();
  const userRecords = attendanceList
    .filter((r) => r.username === username.toLowerCase())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const lastRecord = userRecords[0] || null;
  let cooldownActive = false;
  let nextAllowedTime: string | null = null;

  if (lastRecord) {
    const lastTimestamp = new Date(lastRecord.timestamp).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const expiryTime = lastTimestamp + twentyFourHours;
    const now = Date.now();

    if (now < expiryTime) {
      cooldownActive = true;
      nextAllowedTime = new Date(expiryTime).toISOString();
    }
  }

  return {
    lastRecord,
    cooldownActive,
    nextAllowedTime,
  };
}

// 1. Staff Registration
app.post("/api/auth/register", async (req, res) => {
  const { fullName, discordId, username, password } = req.body;

  if (!fullName || !discordId || !username || !password) {
    res.status(400).json({ error: "All fields are required." });
    return;
  }

  const cleanUsername = username.trim().toLowerCase();
  
  if (cleanUsername === "admin") {
    res.status(400).json({ error: "Username 'admin' is reserved." });
    return;
  }

  try {
    const existingStaff = await findStaffByUsername(cleanUsername);
    if (existingStaff) {
      res.status(400).json({ error: "Username is already registered." });
      return;
    }

    const staffList = await getStaffList();
    const newStaff: Staff = {
      fullName: fullName.trim(),
      discordId: discordId.trim(),
      username: cleanUsername,
      passwordHash: hashPassword(password),
      registeredAt: new Date().toISOString(),
    };

    staffList.push(newStaff);
    await saveStaffList(staffList);

    // Create session
    const token = generateToken();
    const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hour session
    const session: Session = {
      token,
      username: newStaff.username,
      fullName: newStaff.fullName,
      discordId: newStaff.discordId,
      isAdmin: false,
      expiresAt,
    };
    sessions.set(token, session);

    res.status(201).json({
      success: true,
      token,
      user: {
        username: newStaff.username,
        fullName: newStaff.fullName,
        discordId: newStaff.discordId,
        isAdmin: false,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to register staff. " + error.message });
  }
});

// 2. Staff Login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    const staff = await findStaffByUsername(cleanUsername);
    if (!staff) {
      res.status(400).json({ error: "Staff member not found with this username." });
      return;
    }

    const inputHash = hashPassword(password);
    if (staff.passwordHash !== inputHash) {
      res.status(400).json({ error: "Invalid password credentials." });
      return;
    }

    // Create session
    const token = generateToken();
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12 hour session
    const session: Session = {
      token,
      username: staff.username,
      fullName: staff.fullName,
      discordId: staff.discordId,
      isAdmin: false,
      expiresAt,
    };
    sessions.set(token, session);

    res.json({
      success: true,
      token,
      user: {
        username: staff.username,
        fullName: staff.fullName,
        discordId: staff.discordId,
        isAdmin: false,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Login failed on server. " + error.message });
  }
});

// 3. Admin Login
app.post("/api/auth/admin-login", async (req, res) => {
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: "Admin password is required." });
    return;
  }

  // Secure admin password: hdy1234
  if (password !== "hdy1234") {
    res.status(401).json({ error: "Invalid credentials. Incorrect admin password." });
    return;
  }

  // Create session
  const token = generateToken();
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12 hour session
  const session: Session = {
    token,
    username: "admin",
    fullName: "HDX AMAN", // Owner
    discordId: "hdx_aman",
    isAdmin: true,
    expiresAt,
  };
  sessions.set(token, session);

  res.json({
    success: true,
    token,
    user: {
      username: "admin",
      fullName: "HDX AMAN",
      discordId: "hdx_aman",
      isAdmin: true,
    },
  });
});

// 4. Validate Me / Cooldown Status
app.get("/api/staff/me", requireAuth, async (req, res) => {
  const user = (req as any).user;
  
  if (user.isAdmin) {
    res.json({
      user,
      lastAttendance: null,
      cooldownActive: false,
      nextAllowedTime: null,
      serverTime: new Date().toISOString(),
    });
    return;
  }

  try {
    const { lastRecord, cooldownActive, nextAllowedTime } = await getUserCooldown(user.username);
    res.json({
      user,
      lastAttendance: lastRecord,
      cooldownActive,
      nextAllowedTime,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Submit Attendance
app.post("/api/attendance/submit", requireAuth, async (req, res) => {
  const user = (req as any).user;

  if (user.isAdmin) {
    res.status(400).json({ error: "Admin members do not submit attendance." });
    return;
  }

  try {
    const { cooldownActive } = await getUserCooldown(user.username);

    if (cooldownActive) {
      res.status(400).json({ error: "You can submit attendance again after 24 hours." });
      return;
    }

    const clientIp = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "Unknown Browser / Device";

    const attendanceList = await getAttendanceList();
    const newRecord: AttendanceRecord = {
      id: "att_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      username: user.username,
      fullName: user.fullName,
      discordId: user.discordId,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split("T")[0],
      ip: clientIp,
      userAgent,
      status: "Present",
    };

    attendanceList.push(newRecord);
    await saveAttendanceList(attendanceList);

    res.json({
      success: true,
      record: newRecord,
      message: "Attendance submitted successfully!",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to submit attendance: " + error.message });
  }
});

// 6. Admin Panel Dashboard Data (includes attendance statistics, search, registers, logs)
app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    const staffList = await getStaffList();
    const attendanceList = await getAttendanceList();

    // Map each staff with their latest attendance record for easy UI displays
    const staffWithLastAttendance = await Promise.all(
      staffList.map(async (st) => {
        const { lastRecord, cooldownActive, nextAllowedTime } = await getUserCooldown(st.username);
        return {
          ...st,
          lastAttendanceTime: lastRecord ? lastRecord.timestamp : undefined,
          cooldownActive,
          nextAllowedTime,
        };
      })
    );

    // Compute today's date formatted as YYYY-MM-DD in UTC (aligned with database dates)
    const todayStr = new Date().toISOString().split("T")[0];

    // Identify who attended today
    const attendedTodayUsernames = new Set(
      attendanceList
        .filter((rec) => rec.date === todayStr)
        .map((rec) => rec.username)
    );

    const attendedToday = staffWithLastAttendance.filter((st) => 
      attendedTodayUsernames.has(st.username)
    );

    const notAttendedToday = staffWithLastAttendance.filter((st) => 
      !attendedTodayUsernames.has(st.username)
    );

    res.json({
      staff: staffWithLastAttendance,
      attendance: attendanceList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      attendedTodayCount: attendedToday.length,
      notAttendedTodayCount: notAttendedToday.length,
      attendedToday,
      notAttendedToday,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to compile admin stats: " + error.message });
  }
});

// 7. Logout Endpoint
app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = (req as any).token;
  sessions.delete(token);
  res.json({ success: true, message: "Logged out safely!" });
});

// 8. Delete Staff Member
app.delete("/api/admin/staff/:username", requireAdmin, async (req, res) => {
  const { username } = req.params;
  const cleanUsername = username.trim().toLowerCase();

  try {
    const staffList = await getStaffList();
    const exists = staffList.some((s) => s.username === cleanUsername);
    if (!exists) {
      res.status(404).json({ error: "Staff member not found." });
      return;
    }

    const updatedStaffList = staffList.filter((s) => s.username !== cleanUsername);
    await saveStaffList(updatedStaffList);

    // Also delete their attendance records to clean up
    const attendanceRecords = await getAttendanceList();
    const updatedAttendance = attendanceRecords.filter((r) => r.username !== cleanUsername);
    await saveAttendanceList(updatedAttendance);

    res.json({ 
      success: true, 
      message: `Staff member @${cleanUsername} and their attendance history have been successfully deleted.` 
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete staff member: " + error.message });
  }
});

// 9. Delete Attendance Record
app.delete("/api/admin/attendance/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const attendanceRecords = await getAttendanceList();
    const exists = attendanceRecords.some((r) => r.id === id);
    if (!exists) {
      res.status(404).json({ error: "Attendance record not found." });
      return;
    }

    const updatedAttendance = attendanceRecords.filter((r) => r.id !== id);
    await saveAttendanceList(updatedAttendance);

    res.json({ success: true, message: "Attendance record has been successfully deleted." });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete attendance record: " + error.message });
  }
});

// Boot dev VITE server or serve build folders in Production
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware connected.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`HDX-STAFF Full-Stack Server listening at http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Critical server configuration failure:", err);
});

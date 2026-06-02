/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Staff, AttendanceRecord } from "../src/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STAFF_FILE = path.join(DATA_DIR, "staff.json");
const ATTENDANCE_FILE = path.join(DATA_DIR, "attendance.json");

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Ensure the directory and data files exist
export async function initializeDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Already exists
  }

  // Handle Staff file initialization
  try {
    await fs.access(STAFF_FILE);
  } catch {
    // Seed default staff
    const defaultStaff: Staff[] = [
      {
        username: "johndoe",
        fullName: "John Doe",
        discordId: "johndoe#1234",
        registeredAt: "2026-06-01T09:00:00.000Z",
        passwordHash: hashPassword("password123"),
      },
      {
        username: "janesmith",
        fullName: "Jane Smith",
        discordId: "janesmith#5678",
        registeredAt: "2026-05-31T10:00:00.000Z",
        passwordHash: hashPassword("password123"),
      },
      {
        username: "alexmercer",
        fullName: "Alex Mercer",
        discordId: "alex#9999",
        registeredAt: "2026-06-02T08:00:00.000Z",
        passwordHash: hashPassword("password123"),
      }
    ];
    await fs.writeFile(STAFF_FILE, JSON.stringify(defaultStaff, null, 2));
  }

  // Handle Attendance file initialization
  try {
    await fs.access(ATTENDANCE_FILE);
  } catch {
    // Seed default records to make charts and tables look amazing
    const defaultAttendance: AttendanceRecord[] = [
      {
        id: "att_1",
        username: "johndoe",
        fullName: "John Doe",
        discordId: "johndoe#1234",
        timestamp: "2026-06-01T09:30:00.000Z",
        date: "2026-06-01",
        ip: "203.0.113.195",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        status: "Present",
      },
      {
        id: "att_2",
        username: "janesmith",
        fullName: "Jane Smith",
        discordId: "janesmith#5678",
        timestamp: "2026-06-01T10:15:00.000Z",
        date: "2026-06-01",
        ip: "198.51.100.41",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
        status: "Present",
      },
      {
        id: "att_3",
        username: "johndoe",
        fullName: "John Doe",
        discordId: "johndoe#1234",
        timestamp: "2026-06-02T09:12:00.000Z", // Attended today!
        date: "2026-06-02",
        ip: "203.0.113.195",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        status: "Present",
      }
    ];
    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify(defaultAttendance, null, 2));
  }
}

// Read All Staff
export async function getStaffList(): Promise<Staff[]> {
  await initializeDb();
  try {
    const data = await fs.readFile(STAFF_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Find Staff by Username
export async function findStaffByUsername(username: string): Promise<Staff | undefined> {
  const staff = await getStaffList();
  return staff.find((s) => s.username === username.toLowerCase());
}

// Save Staff List
export async function saveStaffList(staffList: Staff[]): Promise<void> {
  await initializeDb();
  await fs.writeFile(STAFF_FILE, JSON.stringify(staffList, null, 2));
}

// Read All Attendance
export async function getAttendanceList(): Promise<AttendanceRecord[]> {
  await initializeDb();
  try {
    const data = await fs.readFile(ATTENDANCE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save Attendance List
export async function saveAttendanceList(records: AttendanceRecord[]): Promise<void> {
  await initializeDb();
  await fs.writeFile(ATTENDANCE_FILE, JSON.stringify(records, null, 2));
}

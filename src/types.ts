/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Staff {
  username: string;
  fullName: string;
  discordId: string;
  registeredAt: string;
  passwordHash?: string; // Kept hidden on public client responses
  lastAttendanceTime?: string;
  cooldownActive?: boolean;
}

export interface AttendanceRecord {
  id: string;
  username: string;
  fullName: string;
  discordId: string;
  timestamp: string; // ISO String
  date: string; // YYYY-MM-DD
  ip: string;
  userAgent: string;
  status: "Present";
}

export interface Session {
  token: string;
  username: string;
  fullName: string;
  discordId: string;
  isAdmin: boolean;
  expiresAt: number;
}

export interface UserStatus {
  loggedIn: boolean;
  user: {
    username: string;
    fullName: string;
    discordId: string;
    isAdmin: boolean;
  } | null;
  lastAttendance: AttendanceRecord | null;
  cooldownActive: boolean;
  nextAllowedTime: string | null; // ISO string
  serverTime: string; // ISO string
}

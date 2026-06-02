/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Staff, AttendanceRecord, UserStatus } from "../types";

const TOKEN_KEY = "hdx_staff_session_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const authApi = {
  async register(params: Record<string, string>) {
    const res = await apiFetch<{ success: boolean; token: string; user: any }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(params),
    });
    setToken(res.token);
    return res;
  },

  async login(params: Record<string, string>) {
    const res = await apiFetch<{ success: boolean; token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(params),
    });
    setToken(res.token);
    return res;
  },

  async adminLogin(params: Record<string, string>) {
    const res = await apiFetch<{ success: boolean; token: string; user: any }>("/api/auth/admin-login", {
      method: "POST",
      body: JSON.stringify(params),
    });
    setToken(res.token);
    return res;
  },

  async getMe(): Promise<UserStatus> {
    return apiFetch<UserStatus>("/api/staff/me", {
      method: "GET",
    });
  },

  clearToken() {
    clearToken();
  },

  async logout(): Promise<void> {
    try {
      await apiFetch<any>("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      // Absorb failed request if session already dead on backend
    } finally {
      clearToken();
    }
  },
};

export const attendanceApi = {
  async submit() {
    return apiFetch<{ success: boolean; record: AttendanceRecord; message: string }>("/api/attendance/submit", {
      method: "POST",
    });
  },
};

export const adminApi = {
  async getDashboardData() {
    return apiFetch<{
      staff: (Staff & { cooldownActive: boolean; nextAllowedTime: string | null; lastAttendanceTime?: string })[];
      attendance: AttendanceRecord[];
      attendedTodayCount: number;
      notAttendedTodayCount: number;
      attendedToday: any[];
      notAttendedToday: any[];
      serverTime: string;
    }>("/api/admin/dashboard", {
      method: "GET",
    });
  },

  async deleteStaff(username: string) {
    return apiFetch<{ success: boolean; message: string }>(`/api/admin/staff/${username}`, {
      method: "DELETE",
    });
  },

  async deleteAttendance(id: string) {
    return apiFetch<{ success: boolean; message: string }>(`/api/admin/attendance/${id}`, {
      method: "DELETE",
    });
  },
};

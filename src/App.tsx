/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Clock as ClockIcon, 
  MapPin, 
  Calendar, 
  LogOut, 
  ShieldAlert, 
  Search, 
  CheckCircle2, 
  XCircle, 
  User, 
  FileText, 
  HelpCircle, 
  Sun, 
  Moon, 
  ArrowRight,
  Fingerprint,
  Cpu,
  RefreshCw,
  LayoutDashboard,
  ShieldAlert as ShieldIcon
} from "lucide-react";

import { Staff, AttendanceRecord, UserStatus } from "./types";
import { authApi, attendanceApi, adminApi, getToken } from "./lib/api";
import { Clock } from "./components/Clock";
import { Notification, ToastMessage } from "./components/Notification";

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("hdx_staff_theme") as "light" | "dark") || "dark";
  });

  // Routing State
  const [currentHash, setCurrentHash] = useState<string>(window.location.hash || "#");

  // Authentication & Status State
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingPresence, setSubmittingPresence] = useState<boolean>(false);

  // Notifications State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Form input States
  const [regForm, setRegForm] = useState({ fullName: "", username: "", discordId: "", password: "" });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [adminPass, setAdminPass] = useState("");

  // Cooldown Countdown State
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Admin Dashboard Data State
  const [adminData, setAdminData] = useState<{
    staff: (Staff & { cooldownActive: boolean; nextAllowedTime: string | null; lastAttendanceTime?: string })[];
    attendance: AttendanceRecord[];
    attendedTodayCount: number;
    notAttendedTodayCount: number;
    attendedToday: any[];
    notAttendedToday: any[];
    serverTime: string;
  } | null>(null);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>("");
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<"summary" | "roster" | "today" | "ledger">("summary");

  // Sync theme with document DOM
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("hdx_staff_theme", theme);
  }, [theme]);

  // Sync Hash Route changes
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || "#");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Set up Toast message trigger helper
  const triggerToast = (type: "success" | "error" | "info", text: string) => {
    setToast({
      id: Date.now().toString(),
      type,
      text,
    });
  };

  // Helper: Poll user profile state on navigation or login
  const refreshUserStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    const apiToken = getToken();
    if (!apiToken) {
      setUserStatus(null);
      setLoading(false);
      return;
    }

    try {
      const data = await authApi.getMe();
      setUserStatus(data);
    } catch (err: any) {
      // Clear token if invalid
      authApi.clearToken();
      setUserStatus(null);
      if (currentHash !== "#" && currentHash !== "#login" && currentHash !== "#register" && currentHash !== "#admin-login") {
        window.location.hash = "#login";
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Check login on mount
  useEffect(() => {
    refreshUserStatus();
  }, [currentHash]);

  // Prevent logged in users from seeing login/register forms, and redirect to dashboard/admin-panel
  useEffect(() => {
    if (userStatus?.loggedIn) {
      if (userStatus.user?.isAdmin) {
        if (currentHash === "#login" || currentHash === "#register" || currentHash === "#admin-login" || currentHash === "#" || currentHash === "#home") {
          window.location.hash = "#admin-panel";
        }
      } else {
        if (currentHash === "#login" || currentHash === "#register" || currentHash === "#admin-login") {
          window.location.hash = "#dashboard";
        }
      }
    }
  }, [userStatus, currentHash]);

  // Admin data polling
  const loadAdminData = async () => {
    setAdminLoading(true);
    try {
      const data = await adminApi.getDashboardData();
      setAdminData(data);
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to load admin stats.");
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (userStatus?.user?.isAdmin && currentHash === "#admin-panel") {
      loadAdminData();
    }
  }, [userStatus, currentHash]);

  // Countdown timer clock tick
  useEffect(() => {
    if (!userStatus?.nextAllowedTime || !userStatus?.cooldownActive) {
      setSecondsLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const nextTime = new Date(userStatus.nextAllowedTime!).getTime();
      const diff = Math.max(0, Math.floor((nextTime - Date.now()) / 1000));
      setSecondsLeft(diff);

      if (diff === 0) {
        // Cooldown finished, refresh status silently
        refreshUserStatus(true);
        clearInterval(interval);
      }
    }, 1000);

    // Initial run
    const nextTime = new Date(userStatus.nextAllowedTime!).getTime();
    setSecondsLeft(Math.max(0, Math.floor((nextTime - Date.now()) / 1000)));

    return () => clearInterval(interval);
  }, [userStatus]);

  // Register Handlers
  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!regForm.fullName || !regForm.username || !regForm.discordId || !regForm.password) {
      triggerToast("error", "Please fill in all registration fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(regForm);
      if (res.success) {
        triggerToast("success", `Welcome ${regForm.fullName}! Account created successfully.`);
        setRegForm({ fullName: "", username: "", discordId: "", password: "" });
        await refreshUserStatus();
        window.location.hash = "#dashboard";
      }
    } catch (err: any) {
      triggerToast("error", err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  // Login Handlers
  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      triggerToast("error", "Username and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(loginForm);
      if (res.success) {
        triggerToast("success", "Access granted! Welcome to HDX-STAFF dashboard.");
        setLoginForm({ username: "", password: "" });
        await refreshUserStatus();
        window.location.hash = "#dashboard";
      }
    } catch (err: any) {
      triggerToast("error", err.message || "Incorrect username or password.");
    } finally {
      setLoading(false);
    }
  };

  // Admin Portal Login Handlers
  const handleAdminLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminPass) {
      triggerToast("error", "Please enter the admin password.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.adminLogin({ password: adminPass });
      if (res.success) {
        triggerToast("success", "Admin authentication successful. Logging into Command Center.");
        setAdminPass("");
        await refreshUserStatus();
        window.location.hash = "#admin-panel";
      }
    } catch (err: any) {
      triggerToast("error", err.message || "Invalid Admin credentials.");
    } finally {
      setLoading(false);
    }
  };

  // Clock in Handlers
  const handleClockIn = async () => {
    setSubmittingPresence(true);
    try {
      const res = await attendanceApi.submit();
      if (res.success) {
        triggerToast("success", res.message || "Attendance clock-in submitted successfully!");
        await refreshUserStatus();
      }
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to submit attendance.");
    } finally {
      setSubmittingPresence(false);
    }
  };

  // Sign out handler
  const handleLogout = async () => {
    setLoading(true);
    try {
      await authApi.logout();
      setUserStatus(null);
      triggerToast("success", "Logged out safely. See you on your next shift!");
      window.location.hash = "#";
    } catch (err: any) {
      triggerToast("error", "Failed to terminate session safely.");
    } finally {
      setLoading(false);
    }
  };

  // Administrative Delete Staff handle
  const handleDeleteStaff = async (username: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete staff account @${username} and all of their attendance history? This action is IRREVERSIBLE.`)) {
      return;
    }
    setAdminLoading(true);
    try {
      const res = await adminApi.deleteStaff(username);
      if (res.success) {
        triggerToast("success", res.message || "Staff member deleted successfully.");
        await loadAdminData(); // reload telemetry from db
        if (selectedStaffDetail === username) {
          setSelectedStaffDetail(null);
        }
      }
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to remove staff member.");
    } finally {
      setAdminLoading(false);
    }
  };

  // Administrative Delete Attendance Log record
  const handleDeleteAttendance = async (id: string) => {
    if (!window.confirm("Are you absolutely sure you want to delete this specific attendance check-in log entry?")) {
      return;
    }
    setAdminLoading(true);
    try {
      const res = await adminApi.deleteAttendance(id);
      if (res.success) {
        triggerToast("success", res.message || "Attendance log deleted successfully.");
        await loadAdminData(); // reload telemetry from db
      }
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to delete attendance record.");
    } finally {
      setAdminLoading(false);
    }
  };

  // Render countdown format: HH : MM : SS
  const formatCountdown = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}h ${minutes
      .toString()
      .padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50 flex flex-col transition-colors duration-300">
      
      {/* Dynamic alerts/notifications */}
      <Notification toast={toast} onClear={() => setToast(null)} />

      {/* HEADER / NAVIGATION BAR */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/70 dark:bg-neutral-950/70 border-b border-neutral-200/50 dark:border-neutral-800/50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo Brand / Launcher */}
          <a href="#" className="flex items-center gap-3 group select-none">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center text-white font-display font-extrabold text-xl tracking-wider shadow-lg shadow-pink-500/20 group-hover:scale-105 transition-transform">
              H
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-xl tracking-wider bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
                HDX-STAFF
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 dark:text-neutral-500">
                Staff Ledger
              </span>
            </div>
          </a>

          {/* Nav menu links */}
          <nav className="hidden md:flex items-center gap-1">
            <a 
              href="#" 
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                currentHash === "#" || currentHash === "#home"
                  ? "bg-neutral-100 dark:bg-neutral-800/80 text-pink-505 font-semibold text-neutral-900 dark:text-neutral-100" 
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              Home
            </a>

            {userStatus?.loggedIn && !userStatus.user?.isAdmin && (
              <>
                <a 
                  href="#dashboard" 
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    currentHash === "#dashboard" || currentHash === "#attendance"
                      ? "bg-neutral-100 dark:bg-neutral-800/80 text-pink-505 font-semibold text-neutral-900 dark:text-neutral-100" 
                      : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  Dashboard
                </a>
                <a 
                  href="#history" 
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    currentHash === "#history"
                      ? "bg-neutral-100 dark:bg-neutral-800/80 text-pink-505 font-semibold text-neutral-900 dark:text-neutral-100" 
                      : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  My Ledger
                </a>
                <a 
                  href="#profile" 
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    currentHash === "#profile"
                      ? "bg-neutral-100 dark:bg-neutral-800/80 text-pink-505 font-semibold text-neutral-900 dark:text-neutral-100" 
                      : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  Profile
                </a>
              </>
            )}

            {userStatus?.loggedIn && userStatus.user?.isAdmin && (
              <a 
                href="#admin-panel" 
                className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  currentHash === "#admin-panel"
                    ? "bg-pink-500/15 border border-pink-500/30 text-pink-500" 
                    : "text-rose-500 hover:text-rose-400"
                }`}
              >
                <ShieldIcon className="w-3.5 h-3.5" /> Command Center
              </a>
            )}
          </nav>

          {/* Right utility buttons: Theme toggle, Accounts login/out */}
          <div className="flex items-center gap-3">
            {/* Color switcher button */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2.5 rounded-xl border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
              aria-label="Toggle Theme Mode"
            >
              {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Loading Spinner */}
            {loading && (
              <div className="w-5 h-5 border-2 border-pink-500/30 border-t-pink-500 rounded-full animate-spin shrink-0" />
            )}

            {/* Profile Avatar / Login actions */}
            {!loading && (
              <>
                {userStatus?.loggedIn ? (
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex flex-col text-right">
                      <span className="text-xs font-bold leading-tight">
                        {userStatus.user?.fullName}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400 lowercase">
                        @{userStatus.user?.username}
                      </span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 border border-neutral-200/55 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 dark:border-neutral-800 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span className="hidden sm:inline">Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <a
                      href="#login"
                      className="px-4 py-2 sm:py-2.5 rounded-xl border border-neutral-200/55 hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 dark:border-neutral-800 dark:hover:bg-neutral-900 dark:text-neutral-300 text-xs sm:text-sm font-semibold transition-colors shrink-0"
                    >
                      Login
                    </a>
                    <a
                      href="#register"
                      className="px-4 py-2 sm:py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-semibold text-xs sm:text-sm transition-colors shadow-lg shadow-pink-500/20 shrink-0"
                    >
                      Register
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Sub-Bar for Logged in Staff */}
        {userStatus?.loggedIn && !userStatus.user?.isAdmin && (
          <div className="md:hidden flex items-center justify-around py-2 px-1 border-t border-neutral-250 dark:border-neutral-800/60 bg-white dark:bg-neutral-900/40 text-xs">
            <a 
              href="#dashboard" 
              className={`p-2 rounded-lg font-medium flex flex-col items-center gap-0.5 ${
                currentHash === "#dashboard" || currentHash === "#attendance" 
                  ? "text-pink-500 font-bold" 
                  : "text-neutral-400 dark:text-neutral-500"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </a>
            <a 
              href="#history" 
              className={`p-2 rounded-lg font-medium flex flex-col items-center gap-0.5 ${
                currentHash === "#history" 
                  ? "text-pink-500 font-bold" 
                  : "text-neutral-400 dark:text-neutral-500"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>My Ledger</span>
            </a>
            <a 
              href="#profile" 
              className={`p-2 rounded-lg font-medium flex flex-col items-center gap-0.5 ${
                currentHash === "#profile" 
                  ? "text-pink-500 font-bold" 
                  : "text-neutral-400 dark:text-neutral-500"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </a>
          </div>
        )}
      </header>

      {/* VIEWPORT AREA */}
      <main className="flex-grow flex flex-col">
        <AnimatePresence mode="wait">
          
          {/* 1. HOME / LANDING PAGE */}
          {(currentHash === "#" || currentHash === "#home") && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex-grow flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 text-center"
            >
              <div className="max-w-3xl w-full flex flex-col items-center space-y-8">
                {/* Branding Launch Banner */}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-100 hover:bg-pink-200/70 transition-colors text-pink-700 dark:bg-pink-500/10 dark:text-pink-400 text-xs font-semibold tracking-wider uppercase rounded-full select-none cursor-help">
                  <Fingerprint className="w-3.5 h-3.5" /> Staff Management Console
                </div>

                {/* Main Headline */}
                <h1 className="text-4xl sm:text-6xl font-display font-black tracking-tight leading-[1.1] max-w-2xl text-neutral-900 dark:text-white">
                  Streamlined, Secure Attendance Logging
                </h1>

                {/* Main Subparagraph */}
                <p className="text-base sm:text-lg text-neutral-500 dark:text-neutral-400 max-w-xl leading-relaxed">
                  Welcome to the **HDX-STAFF Portal**. Built for robust member registration, attendance verification, and automated 24-hour cooldown integrity tracking.
                </p>

                {/* Clock component widget helper */}
                <Clock />

                {/* Call To Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md pt-4">
                  {userStatus?.loggedIn ? (
                    <a
                      href="#dashboard"
                      className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white font-bold text-shadow flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-pink-500/10 cursor-pointer"
                    >
                      Go to Dashboard <ArrowRight className="w-4 h-4" />
                    </a>
                  ) : (
                    <>
                      <a
                        href="#login"
                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white font-bold text-shadow flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-pink-500/10 cursor-pointer"
                      >
                        Sign in as Staff <ArrowRight className="w-4 h-4" />
                      </a>
                      <a
                        href="#register"
                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-100 font-bold border border-neutral-200 dark:border-neutral-800 transition-all cursor-pointer"
                      >
                        Register New Staff
                      </a>
                    </>
                  )}
                </div>

                {/* Admin Quick Launch anchor */}
                <div className="pt-8">
                  <a
                    href="#admin-login"
                    className="group inline-flex items-center gap-2 text-xs font-mono tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 hover:text-pink-500 dark:hover:text-pink-400 transition-colors"
                  >
                    <ShieldAlert className="w-4 h-4 group-hover:scale-110 transition-transform text-rose-500" /> ADMIN PORTAL LOGIN
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {/* 2. REGISTRATION PAGE */}
          {currentHash === "#register" && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
            >
              <div className="max-w-md w-full bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/80 rounded-3xl shadow-xl overflow-hidden p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-neutral-900 dark:text-white">
                    Create Staff Profile
                  </h2>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Register to log attendance with IP security protocols.
                  </p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-neutral-500">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-neutral-500">
                      Discord Unique ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. johndoe#1234 or johndoe"
                      value={regForm.discordId}
                      onChange={(e) => setRegForm({ ...regForm, discordId: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-neutral-500">
                      Chosen Username
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. johndoe"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-neutral-500">
                      Secure Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 mt-2 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold transition-all shadow-lg hover:shadow-pink-500/10 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? "Registering..." : <>Complete Registration <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>

                <div className="mt-6 text-center text-xs">
                  <span className="text-neutral-400">Already registered?</span>{" "}
                  <a href="#login" className="font-bold text-pink-500 hover:text-pink-400 transition-colors">
                    Sign in here
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. LOGIN PAGE */}
          {currentHash === "#login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
            >
              <div className="max-w-md w-full bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/80 rounded-3xl shadow-xl overflow-hidden p-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-neutral-900 dark:text-white">
                    Staff Authentication
                  </h2>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Provide credentials to log into your shift dashboard.
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-neutral-500">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. johndoe"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-neutral-500">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 mt-1 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold transition-all shadow-lg hover:shadow-pink-500/10 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? "Authenticating..." : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>

                <div className="mt-6 text-center text-xs">
                  <span className="text-neutral-400">New Staff Member?</span>{" "}
                  <a href="#register" className="font-bold text-pink-500 hover:text-pink-400 transition-colors">
                    Register an account
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {/* 4. STAFF DASHBOARD & 5. ATTENDANCE SUBMISSION PAGE */}
          {currentHash === "#dashboard" && userStatus?.user && !userStatus.user.isAdmin && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Primary dashboard info & submit attendance */}
              <div className="lg:col-span-2 space-y-8 flex flex-col">
                
                {/* Greeting banner card */}
                <div className="p-6 sm:p-8 bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-display font-bold tracking-tight">
                      System Cockpit
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                      Good day, <span className="text-pink-500 font-bold">{userStatus.user.fullName}</span>. Check your attendance status status and submit presence safely.
                    </p>
                  </div>
                  <Clock />
                </div>

                {/* Main Attendance Clocking Interactive Center */}
                <div className="flex-grow p-6 sm:p-8 bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col justify-center items-center text-center space-y-6">
                  
                  {/* Attendance status badge */}
                  <div>
                    {userStatus.cooldownActive ? (
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-500/10 text-rose-500 text-xs font-mono tracking-wider uppercase rounded-full">
                        <ClockIcon className="w-3.5 h-3.5" /> Cooldown Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 text-emerald-500 text-xs font-mono tracking-wider uppercase rounded-full animate-pulse">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Clock-in Available
                      </span>
                    )}
                  </div>

                  {/* Submit Button & Timer Dial Representation */}
                  <div className="relative w-56 h-56 flex flex-col items-center justify-center rounded-full border-4 border-dashed border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/30 p-2">
                    
                    {/* Pulsing state background glow */}
                    {!userStatus.cooldownActive && (
                      <div className="absolute inset-2 bg-gradient-to-br from-pink-500/10 to-violet-500/10 rounded-full animate-ping opacity-60" />
                    )}

                    {userStatus.cooldownActive ? (
                      <div className="flex flex-col items-center space-y-2 z-10 p-4">
                        <HelpCircle className="w-8 h-8 text-neutral-400" />
                        <span className="text-2xl font-mono font-extrabold tracking-tight text-neutral-700 dark:text-neutral-300">
                          {formatCountdown(secondsLeft)}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">
                          Remaining Time
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={handleClockIn}
                        disabled={submittingPresence}
                        className="w-full h-full rounded-full bg-gradient-to-tr from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 active:scale-95 text-white shadow-xl shadow-pink-500/10 flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer border border-pink-400/20 z-10"
                      >
                        <Fingerprint className="w-10 h-10 animate-bounce" />
                        <span className="font-display font-extrabold text-sm uppercase tracking-wider">
                          {submittingPresence ? "Submitting..." : "Clock In Present"}
                        </span>
                        <span className="text-[10px] text-pink-200 tracking-tight leading-none">
                          Record for Today
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Descriptive labels */}
                  <div className="max-w-md">
                    {userStatus.cooldownActive ? (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        “You can submit attendance again after 24 hours.” Code restrictions prevent spoofing. Please wait for the digital lock to release.
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        Ready to clock in. Your current IP credentials and device metadata will be stamped onto this ledger record. Duplicate attempts within 24hr slots are locked.
                      </p>
                    )}
                  </div>

                  {/* Status checklist grid */}
                  <div className="w-full grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200/50 dark:border-neutral-800/50 text-left text-xs">
                    <div>
                      <span className="block text-neutral-400 mb-0.5">Last Log Time:</span>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                        {userStatus.lastAttendance
                          ? new Date(userStatus.lastAttendance.timestamp).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "None Registered"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-neutral-400 mb-0.5">Next Gate Release:</span>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                        {userStatus.nextAllowedTime
                          ? new Date(userStatus.nextAllowedTime).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Instantly"}
                      </span>
                    </div>
                  </div>
                  
                </div>

              </div>

              {/* Sidebar Quick-Checks */}
              <div className="space-y-8">
                
                {/* Active profile overview card */}
                <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-display font-semibold text-sm">Staff Info Node</h4>
                        <span className="text-xs text-neutral-400">@HDX Staff System</span>
                      </div>
                    </div>
                  
                  <div className="space-y-2 text-xs pt-2 border-t border-neutral-250 dark:border-neutral-800/60">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Full Name</span>
                      <span className="font-bold">{userStatus.user.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Discord Handle</span>
                      <span className="font-bold text-pink-500 font-mono">{userStatus.user.discordId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Portal User</span>
                      <span className="font-bold">{userStatus.user.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Today's Status</span>
                      <span className={`font-semibold ${userStatus.cooldownActive ? "text-emerald-500" : "text-amber-500 animate-pulse"}`}>
                        {userStatus.cooldownActive ? "Submitted Today" : "Awaiting Action"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Helpful tips and reminders */}
                <div className="p-6 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300/40 dark:border-neutral-800/80 rounded-3xl space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 select-none">
                    <Cpu className="w-4 h-4 text-pink-500" /> Digital Stamp Guidelines
                  </h4>
                  <ul className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    <li className="flex items-start gap-1.5">
                      <span className="text-pink-500 mt-1">•</span>
                      Our smart network catches proxy masking. Submitting over clean static IPs is recommended.
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-pink-500 mt-1">•</span>
                      Cooldown spans exactly 1440 minutes (24 hours) from the database record receipt.
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-pink-500 mt-1">•</span>
                      Need corrections? Please contact organization supervisor <b className="text-pink-500">HDX AMAN</b>.
                    </li>
                  </ul>
                </div>

              </div>
            </motion.div>
          )}

          {/* 8. PERSONAL ATTENDANCE HISTORY PAGE */}
          {currentHash === "#history" && userStatus?.user && !userStatus.user.isAdmin && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8"
            >
              <div className="p-6 sm:p-8 bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl shadow-sm space-y-6">
                <div>
                  <h3 className="text-2xl font-display font-bold tracking-tight">
                    My Attendance History Ledger
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Complete historical records of your digital attendance logs. Authenticated with IP registries.
                  </p>
                </div>

                {/* Simple demo lookup or loading states */}
                {adminLoading ? (
                  <div className="py-12 text-center text-xs text-neutral-405 flex flex-col items-center gap-2">
                    <RefreshCw className="w-6 h-6 text-pink-500 animate-spin" /> Fetching ledger records from database...
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-neutral-200/60 dark:border-neutral-800">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 dark:bg-neutral-950 text-xs font-semibold tracking-wider text-neutral-500 border-b border-neutral-200/60 dark:border-neutral-800 uppercase select-none">
                          <th className="px-6 py-4">Status & Stamp</th>
                          <th className="px-6 py-4">Submission Date</th>
                          <th className="px-6 py-4">IP Address</th>
                          <th className="px-6 py-4">Device Credentials</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
                        {/* Dummy fallback or stats mapped from Admin stats matching the logged-in username */}
                        {adminData?.attendance
                          .filter((r) => r.username === userStatus.user?.username)
                          .map((rec) => (
                            <tr key={rec.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                              <td className="px-6 py-4 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0" />
                                <span className="font-semibold text-neutral-800 dark:text-white">
                                  {rec.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-xs">
                                {new Date(rec.timestamp).toLocaleString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-pink-600 dark:text-pink-400">
                                {rec.ip}
                              </td>
                              <td className="px-6 py-4 text-xs max-w-sm truncate text-neutral-400 select-all" title={rec.userAgent}>
                                {rec.userAgent}
                              </td>
                            </tr>
                          ))
                        }

                        {/* Seeded or missing history fallbacks */}
                        {!adminData || adminData.attendance.filter((r) => r.username === userStatus.user?.username).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-xs text-neutral-400">
                              <ClockIcon className="w-8 h-8 mx-auto text-neutral-600/30 mb-2" />
                              No attendance log records recorded yet. Submit check-in on Dashboard to record your first.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 9. STAFF PROFILE PAGE */}
          {currentHash === "#profile" && userStatus?.user && !userStatus.user.isAdmin && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-xl mx-auto px-4 py-12 w-full"
            >
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl shadow-xl p-8 space-y-6">
                
                {/* Profile Header banner */}
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg">
                    {userStatus.user.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold">{userStatus.user.fullName}</h3>
                    <p className="text-xs text-neutral-400 font-mono mt-1 leading-none">@{userStatus.user.username}</p>
                  </div>
                </div>

                {/* Profile attributes list */}
                <div className="border-t border-neutral-200/50 dark:border-neutral-800/50 pt-6 space-y-4 text-sm">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-neutral-400">Organization Node:</span>
                    <span className="font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest text-xs font-mono">HDX-STAFF</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-neutral-400">Discord Handler:</span>
                    <span className="font-bold text-pink-500 font-mono">{userStatus.user.discordId}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-neutral-400">Staff Status:</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-500">
                      Approved Staff
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-neutral-400">Last IP Logged:</span>
                    <span className="font-bold font-mono text-xs">{userStatus.lastAttendance ? userStatus.lastAttendance.ip : "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-neutral-400">Today's Attendance:</span>
                    <span className={`font-semibold ${userStatus.cooldownActive ? "text-emerald-500" : "text-amber-500"}`}>
                      {userStatus.cooldownActive ? "Marked Present" : "Pending Submit"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <a
                    href="#dashboard"
                    className="w-full inline-flex items-center justify-center py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold transition-colors shadow-md text-xs cursor-pointer"
                  >
                    Return to Dashboard
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {/* 6. ADMIN LOGIN PAGE */}
          {currentHash === "#admin-login" && (
            <motion.div
              key="admin-login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
            >
              <div className="max-w-md w-full bg-white dark:bg-neutral-905 border border-neutral-200/60 dark:border-neutral-800/80 rounded-3xl shadow-xl overflow-hidden p-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-neutral-900 dark:text-white flex items-center justify-center gap-2">
                    <ShieldAlert className="text-rose-500 w-7 h-7" /> Command Center
                  </h2>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Provide the owner key code to access core telemetry and records.
                  </p>
                </div>

                {/* Demonstration helper banner */}
                <div className="mb-6 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-neutral-800 dark:text-neutral-300">
                  <p className="text-xs font-semibold text-rose-500 mb-1 flex items-center gap-1.5 leading-none">
                    🔑 Security Credentials
                  </p>
                  <p className="text-xs leading-relaxed text-neutral-404">
                    Required Admin Password: <code className="font-bold font-mono text-rose-600 dark:text-rose-400">hdy1234</code>
                  </p>
                </div>

                <form onSubmit={handleAdminLoginSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-neutral-500">
                      Owner Password key
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 mt-1 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 text-white font-bold transition-all shadow-lg hover:shadow-rose-500/10 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? "Authenticating..." : <>Access Command Console <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>

                <div className="mt-6 text-center text-xs">
                  <a href="#" className="font-semibold text-neutral-400 hover:text-neutral-200 transition-colors">
                    Back to Home page
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {/* 7. ADMIN PANEL / COCKPIT MONITORING */}
          {currentHash === "#admin-panel" && userStatus?.user && userStatus.user.isAdmin && (
            <motion.div
              key="admin-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8"
            >
              
              {/* Cockpit Stats Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Total registered staff */}
                <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-xs font-semibold uppercase tracking-wider select-none">Total Staff</span>
                    <Users className="w-5 h-5 text-pink-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display font-extrabold tracking-tight">
                      {adminData?.staff.length || 0}
                    </span>
                    <span className="text-xs text-neutral-400">registered members</span>
                  </div>
                </div>

                {/* Submissions today counts */}
                <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-xs font-semibold uppercase tracking-wider select-none">Attended Today</span>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display font-extrabold tracking-tight text-emerald-500">
                      {adminData?.attendedTodayCount || 0}
                    </span>
                    <span className="text-xs text-neutral-400">of {adminData?.staff.length || 0} active</span>
                  </div>
                </div>

                {/* Absent index indicators */}
                <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-xs font-semibold uppercase tracking-wider select-none">Absent / Pending</span>
                    <XCircle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display font-extrabold tracking-tight text-amber-500 animate-pulse">
                      {adminData?.notAttendedTodayCount || 0}
                    </span>
                    <span className="text-xs text-neutral-400">staff pending clock-in</span>
                  </div>
                </div>

                {/* Active telemetry system clock */}
                <div className="p-6 bg-gradient-to-tr from-neutral-100 to-white dark:from-neutral-900 dark:to-neutral-950 border border-neutral-250 dark:border-neutral-800/80 rounded-3xl shadow-sm space-y-2 flex flex-col justify-center">
                  <span className="block text-[10px] uppercase font-mono tracking-widest text-neutral-400 dark:text-neutral-500 mb-1 leading-none select-none">
                    Telemetry System Server Date
                  </span>
                  <span className="text-sm font-mono font-bold leading-none text-pink-500 lg:truncate" title={adminData?.serverTime}>
                    {adminData?.serverTime ? new Date(adminData.serverTime).toLocaleString() : "Syncing Core..."}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-1 select-none">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                    <span>Real-time Secure Sync</span>
                  </div>
                </div>

              </div>

              {/* Administrative Ledger filters and listings controls */}
              <div className="p-6 sm:p-8 bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl shadow-sm space-y-6">
                
                {/* Search query input field and sub tabs navigation */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  
                  {/* Category switcher */}
                  <div className="flex items-center gap-1.5 border-b md:border-b-0 border-neutral-200/50 dark:border-neutral-800 pb-2 md:pb-0">
                    <button
                      onClick={() => { setAdminTab("summary"); setSelectedStaffDetail(null); }}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                        adminTab === "summary"
                          ? "bg-pink-500/15 text-pink-500 font-extrabold border border-pink-500/30"
                          : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                    >
                      All Staff Log Status
                    </button>
                    <button
                      onClick={() => { setAdminTab("today"); setSelectedStaffDetail(null); }}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                        adminTab === "today"
                          ? "bg-pink-500/15 text-pink-500 font-extrabold border border-pink-500/30"
                          : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                    >
                      Today's Attendance Status
                    </button>
                    <button
                      onClick={() => { setAdminTab("ledger"); setSelectedStaffDetail(null); }}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                        adminTab === "ledger"
                          ? "bg-pink-500/15 text-pink-500 font-extrabold border border-pink-500/30"
                          : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                    >
                      Global Logs Archive
                    </button>
                  </div>

                  {/* Search query controller inputs */}
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search name, Discord, user..."
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-pink-500/25 focus:border-pink-500 transition-colors"
                    />
                  </div>

                </div>

                {/* TAB 1: ALL STAFF STATUS COOLDOWNS */}
                {adminTab === "summary" && (
                  <div className="space-y-6">
                    <div className="overflow-x-auto rounded-2xl border border-neutral-200/60 dark:border-neutral-800">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-950 text-xs font-semibold tracking-wider text-neutral-500 border-b border-neutral-200/60 dark:border-neutral-800 uppercase select-none">
                            <th className="px-6 py-4">Register Name</th>
                            <th className="px-6 py-4">Discord Handle</th>
                            <th className="px-6 py-4">Username ID</th>
                            <th className="px-6 py-4">Last Clock-In Received</th>
                            <th className="px-6 py-4">24H Cooldown status</th>
                            <th className="px-6 py-4 text-right">Ledger History</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
                          {adminData?.staff
                            .filter((st) => {
                              const q = adminSearchQuery.trim().toLowerCase();
                              return (
                                !q ||
                                st.fullName.toLowerCase().includes(q) ||
                                st.discordId.toLowerCase().includes(q) ||
                                st.username.toLowerCase().includes(q)
                              );
                            })
                            .map((st) => (
                              <tr key={st.username} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-neutral-800 dark:text-white flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-pink-500 rounded-full" />
                                    {st.fullName}
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs font-bold text-neutral-600 dark:text-neutral-300">
                                  {st.discordId}
                                </td>
                                <td className="px-6 py-4 text-xs font-mono">
                                  @{st.username}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs">
                                  {st.lastAttendanceTime
                                    ? new Date(st.lastAttendanceTime).toLocaleString()
                                    : "No record registered"}
                                </td>
                                <td className="px-6 py-4">
                                  {st.cooldownActive ? (
                                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-rose-500/10 text-rose-500 rounded-full" title={`Locked until: ${st.nextAllowedTime ? new Date(st.nextAllowedTime).toLocaleString() : ""}`}>
                                      Locked Cooldown
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 rounded-full">
                                      Clock-in Available
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setSelectedStaffDetail(st.username)}
                                    className="px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-805 text-xs font-semibold text-pink-500 cursor-pointer"
                                  >
                                    Inspect Checkins
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStaff(st.username)}
                                    className="px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 dark:border-rose-900/40 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    title="Permanently remove staff member"
                                  >
                                    Delete Account
                                  </button>
                                </td>
                              </tr>
                            ))
                          }
                          
                          {/* Search Query Empty tracker */}
                          {adminData && adminData.staff.filter((st) => {
                            const q = adminSearchQuery.trim().toLowerCase();
                            return (
                              !q ||
                              st.fullName.toLowerCase().includes(q) ||
                              st.discordId.toLowerCase().includes(q) ||
                              st.username.toLowerCase().includes(q)
                            );
                          }).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-xs text-neutral-400">
                                No registered staff matches your search constraints. Try clearing input or verify keywords.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 2: DAILY ATTENDANCE TARGET STATUS TRACKING */}
                {adminTab === "today" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* LEFT PANEL: Clocked in today (Present list) */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5 leading-none select-none">
                          <CheckCircle2 className="w-4.5 h-4.5" /> Clocked In Today ({adminData?.attendedToday.length || 0})
                        </h4>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-neutral-200/60 dark:border-neutral-800">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-950 text-[10px] font-bold tracking-wider text-neutral-500 border-b border-neutral-200/60 dark:border-neutral-805 uppercase">
                              <th className="px-4 py-3">FullName / username</th>
                              <th className="px-4 py-3">Logged Date stamp</th>
                              <th className="px-4 py-3 text-right">IP Logs</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800 text-xs">
                            {adminData?.attendedToday
                              .filter((st) => {
                                const q = adminSearchQuery.trim().toLowerCase();
                                return (
                                  !q ||
                                  st.fullName.toLowerCase().includes(q) ||
                                  st.discordId.toLowerCase().includes(q) ||
                                  st.username.toLowerCase().includes(q)
                                );
                              })
                              .map((st) => (
                                <tr key={st.username} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-neutral-700 dark:text-neutral-200">
                                      {st.fullName}
                                    </div>
                                    <div className="text-[10px] text-neutral-400 font-mono">@{st.username}</div>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-neutral-500">
                                    {st.lastAttendanceTime ? new Date(st.lastAttendanceTime).toLocaleTimeString() : "N/A"}
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-pink-500 select-all">
                                    {adminData.attendance.find((r) => r.username === st.username && r.date === new Date().toISOString().split("T")[0])?.ip || "Proxy IP hidden"}
                                  </td>
                                </tr>
                              ))
                            }
                            
                            {adminData?.attendedToday.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-xs text-neutral-400">
                                  No members have logged attendance yet today. Check dashboard clock settings.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* RIGHT PANEL: Not clocked in today yet (Absent list) */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5 leading-none select-none">
                          <XCircle className="w-4.5 h-4.5" /> Absent/Pending Today ({adminData?.notAttendedToday.length || 0})
                        </h4>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-neutral-200/60 dark:border-neutral-800">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-950 text-[10px] font-bold tracking-wider text-neutral-500 border-b border-neutral-200/60 dark:border-neutral-805 uppercase">
                              <th className="px-4 py-3">FullName / Username</th>
                              <th className="px-4 py-3">Discord Unique ID</th>
                              <th className="px-4 py-3 text-right">Cooldown Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800 text-xs">
                            {adminData?.notAttendedToday
                              .filter((st) => {
                                const q = adminSearchQuery.trim().toLowerCase();
                                return (
                                  !q ||
                                  st.fullName.toLowerCase().includes(q) ||
                                  st.discordId.toLowerCase().includes(q) ||
                                  st.username.toLowerCase().includes(q)
                                );
                              })
                              .map((st) => (
                                <tr key={st.username} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-neutral-700 dark:text-neutral-200">
                                      {st.fullName}
                                    </div>
                                    <div className="text-[10px] text-neutral-400 font-mono">@{st.username}</div>
                                  </td>
                                  <td className="px-4 py-3 font-mono font-bold text-neutral-600 dark:text-neutral-400">
                                    {st.discordId}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {st.cooldownActive ? (
                                      <span className="px-2 py-0.5 text-[9px] font-semibold bg-rose-500/10 text-rose-500 rounded-full">
                                        Cooldown Active
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-500 rounded-full">
                                        Open For Clock
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            }

                            {adminData?.notAttendedToday.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-xs text-neutral-400">
                                  Complete 100% attendance! Every registered member logged in today.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 3: GLOBAL LOGS ARCHIVE */}
                {adminTab === "ledger" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-neutral-200/60 dark:border-neutral-800">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-950 text-xs font-semibold tracking-wider text-neutral-500 border-b border-neutral-200/60 dark:border-neutral-805 uppercase select-none">
                            <th className="px-6 py-4">Register Name</th>
                            <th className="px-6 py-4">Discord ID</th>
                            <th className="px-6 py-4">Logged Time & Date</th>
                            <th className="px-6 py-4">IP Tracker</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 max-w-xs truncate">Device Agent info</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
                          {adminData?.attendance
                            .filter((r) => {
                              const q = adminSearchQuery.trim().toLowerCase();
                              return (
                                !q ||
                                r.fullName.toLowerCase().includes(q) ||
                                r.discordId.toLowerCase().includes(q) ||
                                r.username.toLowerCase().includes(q) ||
                                r.ip.toLowerCase().includes(q)
                              );
                            })
                            .map((rec) => (
                              <tr key={rec.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                                <td className="px-6 py-4 font-semibold text-neutral-800 dark:text-white">
                                  {rec.fullName}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs font-bold text-neutral-500">
                                  {rec.discordId}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs">
                                  {new Date(rec.timestamp).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-pink-600 dark:text-pink-400">
                                  {rec.ip}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Present
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs max-w-xs truncate text-neutral-400 select-all" title={rec.userAgent}>
                                  {rec.userAgent}
                                </td>
                              </tr>
                            ))
                          }

                          {adminData && adminData.attendance.filter((rec) => {
                            const q = adminSearchQuery.trim().toLowerCase();
                            return (
                              !q ||
                              rec.fullName.toLowerCase().includes(q) ||
                              rec.discordId.toLowerCase().includes(q) ||
                              rec.username.toLowerCase().includes(q) ||
                              rec.ip.toLowerCase().includes(q)
                            );
                          }).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-xs text-neutral-400">
                                No raw log entries corresponding to this search context.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

              {/* INDIVIDUAL STAFF ATTENDANCE HISTORY DRILLDOWN DETAIL MODAL */}
              <AnimatePresence>
                {selectedStaffDetail && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs flex items-center justify-center p-4"
                  >
                    <motion.div
                      initial={{ scale: 0.95, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 15 }}
                      className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto space-y-6"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="text-xl font-display font-bold">
                            Ledger Drilldown: {adminData?.staff.find((st) => st.username === selectedStaffDetail)?.fullName}
                          </h3>
                          <p className="text-xs text-neutral-400 font-mono mt-1">
                            Username: @{selectedStaffDetail} | Discord: {adminData?.staff.find((st) => st.username === selectedStaffDetail)?.discordId}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedStaffDetail(null)}
                          className="px-3 py-1.5 rounded-xl text-xs bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 font-bold transition-all"
                        >
                          Close Detail
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-950 font-bold text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 uppercase">
                              <th className="px-4 py-3">Logged Stamp & Date</th>
                              <th className="px-4 py-3">Active IP</th>
                              <th className="px-4 py-3">Digital Fingerprint</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                            {adminData?.attendance
                              .filter((rec) => rec.username === selectedStaffDetail)
                              .map((rec) => (
                                <tr key={rec.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                                  <td className="px-4 py-3 font-mono">
                                    {new Date(rec.timestamp).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-pink-500 select-all">
                                    {rec.ip}
                                  </td>
                                  <td className="px-4 py-3 text-neutral-400 max-w-xs truncate" title={rec.userAgent}>
                                    {rec.userAgent}
                                  </td>
                                  <td className="px-4 py-3 flex items-center gap-2">
                                    <span className="text-emerald-500 font-semibold uppercase tracking-wider text-[9px] bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                                      {rec.status}
                                    </span>
                                    <button
                                      onClick={() => handleDeleteAttendance(rec.id)}
                                      className="text-[10px] text-rose-500 hover:text-rose-600 font-bold ml-auto px-1.5 py-0.5 border border-rose-500/20 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                                      title="Delete record"
                                    >
                                      Delete Log
                                    </button>
                                  </td>
                                </tr>
                              ))
                            }

                            {adminData?.attendance.filter((rec) => rec.username === selectedStaffDetail).length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                                  No previous log records exist for this staff user in the datastore yet.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>

                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER ACKNOWLEDGEMENT */}
      <footer className="py-8 bg-white dark:bg-neutral-950/40 text-center text-xs select-none border-t border-neutral-200/40 dark:border-neutral-800/45 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-neutral-400 dark:text-neutral-500">
          <div className="flex items-center gap-1 font-semibold text-neutral-600 dark:text-neutral-400">
            <span className="font-display font-black text-pink-500 tracking-wider">HDX-STAFF</span>
            <span>- Staff Attendance Registry Console © 2026</span>
          </div>
          <div>
            Owner: <span className="text-neutral-700 dark:text-neutral-200 font-bold hover:text-pink-500 transition-colors">HDX AMAN</span>
          </div>
          <div>
            Powered by <span className="font-display font-black tracking-widest text-violet-500 hover:opacity-80 transition-opacity">HDX</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Clock as ClockIcon, Calendar } from "lucide-react";

export function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 px-4 py-3 bg-neutral-100 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-sm select-none">
      <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 font-medium">
        <Calendar className="w-4 h-4 text-pink-500" />
        <span className="text-sm tracking-tight">{formatDate(time)}</span>
      </div>
      <div className="hidden sm:block h-4 w-[1px] bg-neutral-300 dark:bg-neutral-700" />
      <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400 font-mono font-bold">
        <ClockIcon className="w-4 h-4 animate-pulse" />
        <span className="text-sm tracking-wider">{formatTime(time)}</span>
      </div>
    </div>
  );
}

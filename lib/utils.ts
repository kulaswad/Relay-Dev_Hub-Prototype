import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Indian Rupees (INR)
 * Standard Indian grouping: ₹12,50,000
 * Compact format: ₹12.5L, ₹1.2Cr, ₹45K
 */
export function formatINR(
  amount: number | null | undefined,
  options?: { compact?: boolean; showDecimals?: boolean }
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "₹0";
  }

  const { compact = false, showDecimals = false } = options || {};

  if (compact) {
    const isNegative = amount < 0;
    const abs = Math.abs(amount);

    let formatted = "";
    if (abs >= 10_000_000) {
      // Crores
      formatted = `${(abs / 10_000_000).toFixed(abs % 10_000_000 === 0 ? 0 : 1)}Cr`;
    } else if (abs >= 100_000) {
      // Lakhs
      formatted = `${(abs / 100_000).toFixed(abs % 100_000 === 0 ? 0 : 1)}L`;
    } else if (abs >= 1_000) {
      // Thousands
      formatted = `${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`;
    } else {
      formatted = abs.toLocaleString("en-IN", {
        maximumFractionDigits: showDecimals ? 2 : 0,
      });
    }

    return `${isNegative ? "-" : ""}₹${formatted}`;
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date in Indian Standard Time (Asia/Kolkata)
 * Default format: "12 Mar 2026"
 */
export function formatDateIST(
  date: Date | string | number | null | undefined,
  formatPattern: string = "dd MMM yyyy"
): string {
  if (!date) return "—";

  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    const istDate = toZonedTime(d, "Asia/Kolkata");
    return format(istDate, formatPattern);
  } catch (err) {
    return "—";
  }
}

/**
 * Format date with time in IST
 * E.g. "12 Mar 2026, 04:30 PM"
 */
export function formatDateTimeIST(
  date: Date | string | number | null | undefined
): string {
  return formatDateIST(date, "dd MMM yyyy, hh:mm a");
}

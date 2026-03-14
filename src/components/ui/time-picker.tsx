"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string; // "HH:MM" 24-hour
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];

function to24(h: number, m: string, period: "AM" | "PM"): string {
  let h24 = h % 12;
  if (period === "PM") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${m}`;
}

function parse(value: string): { h: number; m: string; period: "AM" | "PM" } {
  if (!value) return { h: 12, m: "00", period: "AM" };
  const [hStr, mStr] = value.split(":");
  const h24 = parseInt(hStr, 10);
  const rawMin = parseInt(mStr, 10);
  // round to nearest 15
  const m = String(Math.round(rawMin / 15) * 15 % 60).padStart(2, "0") as "00" | "15" | "30" | "45";
  return {
    h: h24 % 12 === 0 ? 12 : h24 % 12,
    m,
    period: h24 < 12 ? "AM" : "PM",
  };
}

export function TimePicker({ value, onChange, placeholder = "Set time", hasError, className }: TimePickerProps) {
  const { h, m, period } = parse(value);

  const selectClass = cn(
    "bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 outline-none cursor-pointer",
    "hover:text-primary transition-colors appearance-none",
    hasError && "text-destructive",
    className
  );

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange(to24(12, "00", "AM"))}
        className="text-slate-400 hover:text-primary transition-colors text-sm font-medium"
      >
        {placeholder}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <select
        value={h}
        onChange={(e) => onChange(to24(Number(e.target.value), m, period))}
        className={selectClass}
      >
        {HOURS.map((hr) => (
          <option key={hr} value={hr}>{hr}</option>
        ))}
      </select>

      <span className="text-sm font-bold text-slate-400">:</span>

      <select
        value={m}
        onChange={(e) => onChange(to24(h, e.target.value, period))}
        className={selectClass}
      >
        {MINUTES.map((min) => (
          <option key={min} value={min}>{min}</option>
        ))}
      </select>

      <select
        value={period}
        onChange={(e) => onChange(to24(h, m, e.target.value as "AM" | "PM"))}
        className={cn(selectClass, "ml-1")}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

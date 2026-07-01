// src/modules/industrial-distribution-system/dashboard/components/widgets/WeatherCalendarWidget.tsx
// NOTE: Replaced static weather card (29°C / Light Rain hardcoded) with live Open-Meteo API data.
// Scheduled events are wired to activeDispatches from useDashboard context.

"use client";

import React, { useMemo, useEffect, useState } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import {
  CloudRain,
  Cloud,
  Sun,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
  Calendar,
  Clock,
  MapPin,
  Loader2,
} from "lucide-react";

// Map icon string keys returned by BFF to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
};

interface WeatherData {
  temp: string;
  condition: string;
  humidity: string;
  wind: string;
  icon: string;
  alertLevel: string;
  status: string;
  fallback?: boolean;
}

import { WidgetLayout } from "../../types";
import { cn } from "@/lib/utils";

const ALERT_COLORS: Record<string, string> = {
  normal: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25",
  warning: "text-amber-500 bg-amber-500/10 border-amber-500/25",
  critical: "text-red-500 bg-red-500/10 border-red-500/25",
};

export const WeatherCalendarWidget: React.FC<{ layout?: WidgetLayout }> = ({ layout }) => {
  const { activeDispatches } = useDashboard();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Fetch live weather on mount
  useEffect(() => {
    const fetchWeather = async () => {
      setWeatherLoading(true);
      try {
        const res = await fetch("/api/ids/dashboard/weather", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setWeather(data);
        }
      } catch (e) {
        console.error("[WeatherCalendarWidget] Failed to fetch weather:", e);
      } finally {
        setWeatherLoading(false);
      }
    };
    fetchWeather();
  }, []);

  // Live scheduled events from active dispatches (top 3); fallback to static if none
  const upcomingEvents = useMemo(() => {
    if (activeDispatches && activeDispatches.length > 0) {
      return activeDispatches.slice(0, 3).map((d) => {
        const cleanTime = d.time.replace("Scheduled/Created:", "").trim();
        return {
          title: `Dispatch Run ${d.dispatchNo} — ${d.driverName}`,
          time: cleanTime,
          location: d.route,
          type: "Dispatch",
        };
      });
    }
    // Static fallback only when no dispatches are active
    return [
      { title: "No active dispatch runs scheduled", time: "—", location: "All Warehouses", type: "Info" },
    ];
  }, [activeDispatches]);

  const WeatherIcon = weather ? (ICON_MAP[weather.icon] ?? Cloud) : Cloud;
  const alertColorClass = ALERT_COLORS[weather?.alertLevel ?? "normal"];

  const w = layout?.w ?? 12;
  const isNarrow = w < 8;

  return (
    <div className={cn(
      "flex gap-4 h-full items-center justify-between flex-1 min-h-0 w-full",
      isNarrow ? "flex-row" : "flex-row"
    )}>
      {/* Weather Forecast */}
      <div className={cn(
        "shrink-0 border border-border/40 rounded-xl p-3 bg-muted/5 flex flex-col justify-between self-stretch text-center",
        isNarrow ? " min-h-[120px]" : " lg:w-[160px]"
      )}>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
          Logistics Weather
        </span>

        {weatherLoading ? (
          <div className="flex items-center justify-center flex-1 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="my-2">
            <div className="flex justify-center items-center gap-1.5">
              <WeatherIcon className="h-6 w-6 text-cyan-500 animate-pulse" />
              <span className="text-xl font-black text-foreground leading-none">
                {weather?.temp ?? "—"}
              </span>
            </div>
            <span className="text-[10px] font-bold text-foreground mt-1 block">
              {weather?.condition ?? "—"}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium leading-none">
              Wind: {weather?.wind ?? "—"}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium leading-none">
              Humidity: {weather?.humidity ?? "—"}
            </span>
          </div>
        )}

        <div className={`text-[9px] font-black uppercase py-1 rounded-md px-1.5 border ${alertColorClass}`}>
          {weather?.status ?? "Drive safely"}
        </div>
      </div>

      {/* Calendar Schedule */}
      <div className="flex-1 w-full flex flex-col justify-between self-stretch min-h-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-2 px-1 shrink-0">
          Today&apos;s Scheduled Events
        </span>

        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar min-h-0">
          {upcomingEvents.map((evt, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 border border-border/40 rounded-xl p-2.5 bg-muted/5 transition-all"
            >
              <div className="bg-slate-900/5 dark:bg-white/5 border border-border/40 p-1.5 rounded-lg shrink-0 mt-0.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1 text-[10px]">
                <h4 className="font-bold text-foreground truncate leading-tight">
                  {evt.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-slate-400 font-semibold flex-wrap">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {evt.time}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    {evt.location}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

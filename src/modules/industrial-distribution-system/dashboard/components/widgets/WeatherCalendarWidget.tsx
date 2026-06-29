// src/modules/industrial-distribution-system/dashboard/components/widgets/WeatherCalendarWidget.tsx

"use client";

import React, { useMemo } from "react";
import { CloudRain, Calendar, Clock, MapPin } from "lucide-react";

export const WeatherCalendarWidget: React.FC = () => {
  const weather = useMemo(() => {
    return {
      temp: "29°C",
      condition: "Light Rain showers",
      humidity: "82%",
      wind: "14 km/h NE",
      status: "Wet roads - Drive safely",
      icon: CloudRain,
    };
  }, []);

  const upcomingEvents = useMemo(() => {
    return [
      {
        title: "Pasig Dispatch Peak (PDP-000187)",
        time: "11:30 AM",
        location: "Warehouse A",
        type: "Dispatch",
      },
      {
        title: "Batangas Supplier LPG Refill Delivery",
        time: "02:00 PM",
        location: "Warehouse B",
        type: "Receiving",
      },
      {
        title: "Metered Tank Refill: First Chem Corp",
        time: "04:30 PM",
        location: "Customer Site",
        type: "Refill",
      },
    ];
  }, []);

  const WeatherIcon = weather.icon;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full items-center justify-between">
      {/* Weather Forecast */}
      <div className="w-full lg:w-[160px] shrink-0 border border-border/40 rounded-xl p-3 bg-muted/5 flex flex-col justify-between self-stretch text-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
          Logistics Weather
        </span>

        <div className="my-2">
          <div className="flex justify-center items-center gap-1.5">
            <WeatherIcon className="h-6 w-6 text-cyan-500 animate-bounce" />
            <span className="text-xl font-black text-foreground leading-none">{weather.temp}</span>
          </div>
          <span className="text-[10px] font-bold text-foreground mt-1 block">
            {weather.condition}
          </span>
          <span className="text-[9px] text-slate-400 block mt-0.5 font-medium leading-none">
            Wind: {weather.wind}
          </span>
        </div>

        <div className="text-[9px] font-black uppercase text-amber-500 bg-amber-500/10 py-1 rounded-md px-1.5 border border-amber-500/25">
          {weather.status}
        </div>
      </div>

      {/* Calendar Schedule */}
      <div className="flex-1 w-full flex flex-col justify-between self-stretch">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-2.5 px-1">
          Today&apos;s Scheduled Events
        </span>

        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
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

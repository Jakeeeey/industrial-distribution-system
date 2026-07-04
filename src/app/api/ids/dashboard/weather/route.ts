// src/app/api/ids/dashboard/weather/route.ts
// BFF route: fetches current weather for Metro Manila from the free Open-Meteo API.
// No API key required. Coordinates: Branch 196/197 → Metro Manila (14.5995°N, 120.9842°E).

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// WMO Weather Interpretation Codes → human-readable condition + icon type
// https://open-meteo.com/en/docs#weathervariables
const WMO_CODE_MAP: Record<number, { condition: string; icon: string; alertLevel: string }> = {
  0:  { condition: "Clear sky", icon: "Sun", alertLevel: "normal" },
  1:  { condition: "Mainly clear", icon: "Sun", alertLevel: "normal" },
  2:  { condition: "Partly cloudy", icon: "Cloud", alertLevel: "normal" },
  3:  { condition: "Overcast", icon: "Cloud", alertLevel: "normal" },
  45: { condition: "Foggy conditions", icon: "CloudFog", alertLevel: "warning" },
  48: { condition: "Depositing rime fog", icon: "CloudFog", alertLevel: "warning" },
  51: { condition: "Light drizzle", icon: "CloudDrizzle", alertLevel: "normal" },
  53: { condition: "Moderate drizzle", icon: "CloudDrizzle", alertLevel: "normal" },
  55: { condition: "Dense drizzle", icon: "CloudDrizzle", alertLevel: "warning" },
  61: { condition: "Light rain", icon: "CloudRain", alertLevel: "normal" },
  63: { condition: "Moderate rain", icon: "CloudRain", alertLevel: "warning" },
  65: { condition: "Heavy rain", icon: "CloudRain", alertLevel: "warning" },
  71: { condition: "Light snow", icon: "CloudSnow", alertLevel: "normal" },
  73: { condition: "Moderate snow", icon: "CloudSnow", alertLevel: "warning" },
  75: { condition: "Heavy snow", icon: "CloudSnow", alertLevel: "critical" },
  80: { condition: "Light rain showers", icon: "CloudRain", alertLevel: "normal" },
  81: { condition: "Moderate rain showers", icon: "CloudRain", alertLevel: "warning" },
  82: { condition: "Violent rain showers", icon: "CloudLightning", alertLevel: "critical" },
  95: { condition: "Thunderstorm", icon: "CloudLightning", alertLevel: "critical" },
  96: { condition: "Thunderstorm w/ hail", icon: "CloudLightning", alertLevel: "critical" },
  99: { condition: "Thunderstorm w/ heavy hail", icon: "CloudLightning", alertLevel: "critical" },
};

const ALERT_STATUS_MAP: Record<string, string> = {
  normal: "Clear roads — Drive safely",
  warning: "Wet roads — Drive carefully",
  critical: "Severe weather — Delay dispatch",
};

export async function GET() {
  try {
    // Metro Manila coordinates (covers both Branch 196 and 197)
    const LATITUDE = 14.5995;
    const LONGITUDE = 120.9842;

    const openMeteoUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
      `&current=temperature_2m,weathercode,windspeed_10m,winddirection_10m,relative_humidity_2m` +
      `&timezone=Asia%2FManila` +
      `&forecast_days=1`;

    const res = await fetch(openMeteoUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo API returned ${res.status}`);
    }

    const data = await res.json();
    const current = data?.current;

    if (!current) {
      throw new Error("No current weather data in response");
    }

    const tempC = Math.round(current.temperature_2m ?? 29);
    const weatherCode = current.weathercode ?? 0;
    const windSpeed = Math.round(current.windspeed_10m ?? 0);
    const windDir = current.winddirection_10m ?? 0;
    const humidity = Math.round(current.relative_humidity_2m ?? 70);

    // Map wind direction degrees to compass cardinal
    const compassDir = (() => {
      const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      return dirs[Math.round(windDir / 45) % 8];
    })();

    const mapped = WMO_CODE_MAP[weatherCode] ?? {
      condition: "Variable conditions",
      icon: "Cloud",
      alertLevel: "normal",
    };

    return NextResponse.json({
      temp: `${tempC}°C`,
      condition: mapped.condition,
      humidity: `${humidity}%`,
      wind: `${windSpeed} km/h ${compassDir}`,
      icon: mapped.icon,
      alertLevel: mapped.alertLevel,
      status: ALERT_STATUS_MAP[mapped.alertLevel] ?? "Drive safely",
      weatherCode,
    });
  } catch (error: unknown) {
    console.error("[Weather BFF] Error:", error);

    // Graceful fallback — return static Metro Manila typical values
    return NextResponse.json({
      temp: "29°C",
      condition: "Partly cloudy",
      humidity: "75%",
      wind: "12 km/h NE",
      icon: "Cloud",
      alertLevel: "normal",
      status: "Drive safely",
      weatherCode: 2,
      fallback: true,
    });
  }
}

import { defaultWeatherState, type WeatherType, type WeatherState } from "@/store/useWeatherStore";

export const RAIN_WEATHER_TYPES: WeatherType[] = [
  "drizzle",
  "light_rain",
  "showers",
  "thunderstorm",
];

export const WEATHER_TYPES: WeatherType[] = [
  "clear",
  "cloudy",
  "overcast",
  "mist",
  "breeze",
  "drizzle",
  "light_rain",
  "showers",
  "thunderstorm",
  "clearing",
];

export function isRainWeather(weather: WeatherType): boolean {
  return RAIN_WEATHER_TYPES.includes(weather);
}

const WEATHER_PROFILES: Record<
  WeatherType,
  {
    density: number;
    speed: number;
    intensity: number;
    dropSize: number;
    wind: number;
    hasSun: boolean;
  }
> = {
  clear: { density: 0.05, speed: 0.1, intensity: 0, dropSize: 0, wind: 0, hasSun: true },
  cloudy: { density: 0.3, speed: 0.14, intensity: 0, dropSize: 0, wind: 0.08, hasSun: false },
  overcast: { density: 0.45, speed: 0.12, intensity: 0, dropSize: 0, wind: 0.05, hasSun: false },
  mist: { density: 0.35, speed: 0.08, intensity: 0, dropSize: 0, wind: 0, hasSun: false },
  breeze: { density: 0.15, speed: 0.2, intensity: 0, dropSize: 0, wind: 0.35, hasSun: true },
  drizzle: { density: 0.4, speed: 0.15, intensity: 0.12, dropSize: 0.2, wind: 0.05, hasSun: false },
  light_rain: { density: 0.45, speed: 0.18, intensity: 0.25, dropSize: 0.3, wind: 0.1, hasSun: false },
  showers: { density: 0.55, speed: 0.22, intensity: 0.45, dropSize: 0.45, wind: 0.25, hasSun: false },
  thunderstorm: { density: 0.85, speed: 0.3, intensity: 0.75, dropSize: 0.65, wind: 0.65, hasSun: false },
  clearing: { density: 0.22, speed: 0.16, intensity: 0.04, dropSize: 0.15, wind: 0.12, hasSun: true },
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeWeatherType(value: unknown): WeatherType {
  if (typeof value === "string" && WEATHER_TYPES.includes(value as WeatherType)) {
    return value as WeatherType;
  }
  return "clear";
}

export function sanitizeCloudColor(value: unknown): string {
  const fallback = defaultWeatherState.cloud.color;
  if (typeof value !== "string" || !value.trim()) return fallback;

  const trimmed = value.trim();
  const rgbTriplet = trimmed.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (rgbTriplet) {
    const r = Math.min(255, Math.max(0, Number(rgbTriplet[1])));
    const g = Math.min(255, Math.max(0, Number(rgbTriplet[2])));
    const b = Math.min(255, Math.max(0, Number(rgbTriplet[3])));
    return `${r}, ${g}, ${b}`;
  }

  const rgbaMatch = trimmed.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbaMatch) {
    return `${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}`;
  }

  const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }

  return fallback;
}

export function sanitizeRippleMsgs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 20))
    .slice(0, 8);
}

/** 将大模型返回的新格式映射为引擎可用的 WeatherState。 */
export function mapApiResponseToWeatherState(raw: unknown): WeatherState {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const weather = sanitizeWeatherType(source.weather);
  const profile = WEATHER_PROFILES[weather];

  const durationSeconds = clamp(source.duration, 3, 120, 30);

  return {
    weather,
    cloud: {
      color: sanitizeCloudColor(source.cloudColor ?? (source.cloud as { color?: string })?.color),
      density: profile.density,
      speed: profile.speed,
    },
    rain: {
      intensity: profile.intensity,
      dropSize: profile.dropSize,
      duration: durationSeconds * 1000,
    },
    environment: {
      wind: profile.wind,
      hasSun: profile.hasSun,
    },
    messages: {
      cloudMsg:
        typeof source.cloudSpeech === "string"
          ? source.cloudSpeech
          : typeof (source.messages as { cloudMsg?: string })?.cloudMsg === "string"
            ? (source.messages as { cloudMsg: string }).cloudMsg
            : "",
      rippleMsgs: sanitizeRippleMsgs(
        source.rippleSpeeches ?? (source.messages as { rippleMsgs?: unknown })?.rippleMsgs,
      ),
    },
  };
}

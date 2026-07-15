"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useWeatherStore, type WeatherState, type WeatherType } from "@/store/useWeatherStore";

type WeatherPreset = {
  label: string;
  apply: () => Partial<WeatherState>;
};

function buildPreset(
  weather: WeatherType,
  overrides: {
    intensity?: number;
    cloudColor?: string;
    wind?: number;
  } = {},
): Partial<WeatherState> {
  const profiles: Record<
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

  const profile = profiles[weather];
  const intensity = overrides.intensity ?? profile.intensity;
  const wind = overrides.wind ?? profile.wind;

  return {
    weather,
    cloud: {
      color: overrides.cloudColor ?? "200, 210, 220",
      density: profile.density,
      speed: profile.speed,
    },
    rain: {
      intensity,
      dropSize: profile.dropSize,
      duration: 30000,
    },
    environment: {
      wind,
      hasSun: profile.hasSun,
    },
  };
}

const PRESETS: WeatherPreset[] = [
  { label: "薄雾 (Mist)", apply: () => buildPreset("mist", { intensity: 0 }) },
  {
    label: "暖阳 (Clear)",
    apply: () => buildPreset("clear", { intensity: 0, cloudColor: "255, 230, 200" }),
  },
  { label: "细雨 (Drizzle)", apply: () => buildPreset("drizzle", { intensity: 0.2 }) },
  { label: "阵雨 (Showers)", apply: () => buildPreset("showers", { intensity: 0.6 }) },
  {
    label: "雷暴 (Thunderstorm)",
    apply: () => buildPreset("thunderstorm", { intensity: 1.0, wind: 0.8 }),
  },
];

/**
 * 上帝模式调试面板。不是产品功能，是给开发者的旋钮——
 * 默认藏起来，按一下 ` 键才冒出来，方便直接摆弄 targetWeather
 * 来验证 Canvas 引擎的渐变效果。
 */
export default function DebugPanel() {
  const [visible, setVisible] = useState(false);

  const intensity = useWeatherStore((state) => state.targetWeather.rain.intensity);
  const wind = useWeatherStore((state) => state.targetWeather.environment.wind);
  const setTargetWeather = useWeatherStore((state) => state.setTargetWeather);
  const resetWeather = useWeatherStore((state) => state.resetWeather);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "`" || event.code === "Backquote") {
        setVisible((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!visible) return null;

  const handleIntensityChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTargetWeather({ rain: { intensity: Number(event.target.value) } }, true);
  };

  const handleWindChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTargetWeather({ environment: { wind: Number(event.target.value) } }, true);
  };

  return (
    <div className="fixed top-4 left-4 z-50 w-64 rounded-lg border border-white/10 bg-black/60 p-5 text-white/80 backdrop-blur-md">
      <h2 className="mb-4 text-sm font-medium tracking-wide text-white">
        小波纹 气象控制台
      </h2>

      <label className="mb-4 block text-xs">
        <span className="mb-1 flex justify-between">
          <span>intensity 雨量</span>
          <span className="text-white/50">{intensity.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={intensity}
          onChange={handleIntensityChange}
          className="w-full accent-white/80"
        />
      </label>

      <label className="mb-5 block text-xs">
        <span className="mb-1 flex justify-between">
          <span>wind 风向 / 力度</span>
          <span className="text-white/50">{wind.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={wind}
          onChange={handleWindChange}
          className="w-full accent-white/80"
        />
      </label>

      <div className="flex flex-wrap gap-2 text-xs">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setTargetWeather(preset.apply(), true)}
            className="border border-white/20 px-3 py-1 transition hover:bg-white/10"
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => resetWeather()}
          className="border border-white/20 px-3 py-1 transition hover:bg-white/10"
        >
          雨过天晴
        </button>
      </div>
    </div>
  );
}

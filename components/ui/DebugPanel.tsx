"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

const PRESETS = [
  {
    label: "一场暴雨",
    apply: () => ({ rain: { intensity: 0.9 }, environment: { wind: 0.5 } }),
  },
  {
    label: "绵绵细雨",
    apply: () => ({ rain: { intensity: 0.2 }, environment: { wind: 0.1 } }),
  },
] as const;

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
    setTargetWeather({ rain: { intensity: Number(event.target.value) } });
  };

  const handleWindChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTargetWeather({ environment: { wind: Number(event.target.value) } });
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
            onClick={() => setTargetWeather(preset.apply())}
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

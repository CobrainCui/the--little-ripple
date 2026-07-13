import { create } from "zustand";
import {
  fileToBase64,
  loadActiveBackgroundIndex,
  loadBackgroundData,
  loadBackgroundKeys,
  saveBackgroundData,
  setActiveBackgroundIndex,
  toDisplayUrl,
} from "@/lib/backgroundStorage";

export type WeatherType =
  | "clear"
  | "cloudy"
  | "overcast"
  | "mist"
  | "breeze"
  | "drizzle"
  | "light_rain"
  | "showers"
  | "thunderstorm"
  | "clearing";

/**
 * 核心数据契约 (WeatherState) — MVP 0.2
 * 引擎层（Canvas）仅根据此结构渲染画面。
 */
export interface WeatherState {
  weather: WeatherType;
  cloud: {
    /** 纯 RGB 字符串，例如 "200, 210, 220"（不含 rgba() 或 #） */
    color: string;
    density: number; // 0-1
    speed: number; // 0-1
  };
  rain: {
    intensity: number; // 0-1
    dropSize: number; // 0-1
    duration: number; // ms
  };
  environment: {
    wind: number; // -1 to 1
    hasSun: boolean;
  };
  messages: {
    cloudMsg: string;
    /** 波纹的话——每次点击波纹，随机浮起其中一句。 */
    rippleMsgs: string[];
  };
}

/** 默认状态：晴朗无雨，天空平静。 */
export const defaultWeatherState: WeatherState = {
  weather: "clear",
  cloud: {
    color: "255, 255, 255",
    density: 0.05,
    speed: 0.1,
  },
  rain: {
    intensity: 0,
    dropSize: 0,
    duration: 0,
  },
  environment: {
    wind: 0,
    hasSun: true,
  },
  messages: {
    cloudMsg: "",
    rippleMsgs: [],
  },
};

interface WeatherStore {
  targetWeather: WeatherState;
  /** 当前显示的背景图 URL（由 IndexedDB 中的 base64 转换而来）。 */
  bgImage: string | null;
  /** IndexedDB 中背景图的 key 列表。 */
  backgrounds: string[];
  activeBackgroundIndex: number;

  isCloudActive: boolean;
  lastRippleHit: { x: number; y: number; id: string } | null;

  hasStarted: boolean;
  cloudSpawnKey: number;

  setTargetWeather: (target: Partial<WeatherState>) => void;
  resetWeather: () => void;
  setCloudActive: (active: boolean) => void;
  triggerRippleMessage: (x: number, y: number) => void;

  addBackground: (input: File | string) => Promise<void>;
  switchBackground: (index: number) => Promise<void>;
  hydrateBackgrounds: () => Promise<void>;
}

export const useWeatherStore = create<WeatherStore>((set, get) => ({
  targetWeather: defaultWeatherState,
  bgImage: null,
  backgrounds: [],
  activeBackgroundIndex: 0,
  isCloudActive: false,
  lastRippleHit: null,
  hasStarted: false,
  cloudSpawnKey: 0,

  setTargetWeather: (partial) => {
    const prevTarget = get().targetWeather;
    set({
      hasStarted: true,
      cloudSpawnKey: Date.now(),
      targetWeather: {
        weather: partial.weather ?? prevTarget.weather,
        cloud: { ...prevTarget.cloud, ...partial.cloud },
        rain: { ...prevTarget.rain, ...partial.rain },
        environment: { ...prevTarget.environment, ...partial.environment },
        messages: { ...prevTarget.messages, ...partial.messages },
      },
    });
  },

  resetWeather: () => {
    set({
      targetWeather: defaultWeatherState,
      isCloudActive: false,
    });
  },

  setCloudActive: (active) => {
    set({ isCloudActive: active });
  },

  triggerRippleMessage: (x, y) => {
    set({
      isCloudActive: false,
      lastRippleHit: { x, y, id: crypto.randomUUID() },
    });
  },

  addBackground: async (input) => {
    const base64 = typeof input === "string" ? input : await fileToBase64(input);
    await saveBackgroundData(base64);
    const keys = await loadBackgroundKeys();
    const activeIndex = keys.length - 1;
    set({
      backgrounds: keys,
      activeBackgroundIndex: activeIndex,
      bgImage: toDisplayUrl(base64),
    });
  },

  switchBackground: async (index) => {
    const keys = get().backgrounds;
    if (index < 0 || index >= keys.length) return;

    const data = await loadBackgroundData(keys[index]);
    if (!data) return;

    await setActiveBackgroundIndex(index);
    set({
      activeBackgroundIndex: index,
      bgImage: toDisplayUrl(data),
    });
  },

  hydrateBackgrounds: async () => {
    const keys = await loadBackgroundKeys();
    if (keys.length === 0) return;

    const activeIndex = Math.min(await loadActiveBackgroundIndex(), keys.length - 1);
    const data = await loadBackgroundData(keys[activeIndex]);
    if (!data) return;

    set({
      backgrounds: keys,
      activeBackgroundIndex: activeIndex,
      bgImage: toDisplayUrl(data),
    });
  },
}));

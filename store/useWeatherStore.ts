import { sanitizeRippleMsgs } from "@/lib/weather";
import { create } from "zustand";
import {
  addBackgroundToStorage,
  getActiveBackgroundId,
  getAllBackgrounds,
  removeBackgroundFromStorage,
  setActiveBackgroundId,
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

export interface SavedBackground {
  id: string;
  dataUrl: string;
}

/**
 * 核心数据契约 (WeatherState) — MVP 0.2
 * 引擎层（Canvas）仅根据此结构渲染画面。
 */
export interface WeatherState {
  weather: WeatherType;
  cloud: {
    color: string;
    density: number;
    speed: number;
  };
  rain: {
    intensity: number;
    dropSize: number;
    duration: number;
  };
  environment: {
    wind: number;
    hasSun: boolean;
  };
  messages: {
    cloudMsg: string;
    rippleMsgs: string[];
  };
}

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

export type CloudInteractState = "idle" | "menu" | "input";

interface WeatherStore {
  targetWeather: WeatherState;
  bgImage: string | null;
  savedBackgrounds: SavedBackground[];
  activeBackgroundId: string | null;

  cloudInteractState: CloudInteractState;
  setCloudInteractState: (state: CloudInteractState) => void;

  isWeatherExtended: boolean;
  extendCount: number;
  extendWeatherTimer: () => void;
  updateRippleSpeeches: (newSpeeches: string[]) => void;

  lastRippleHit: { x: number; y: number; id: string; text: string } | null;

  rippleReadIndex: number;
  incrementRippleReadIndex: () => void;

  cloudOpacity: number;
  cloudAnchor: { x: number; y: number; radius: number } | null;
  isDissipating: boolean;
  triggerDissipate: () => void;
  isLeaving: boolean;
  triggerLeave: () => void;

  hasStarted: boolean;
  cloudSpawnKey: number;

  showTutorial: boolean;
  closeTutorial: () => void;

  isWritingLetter: boolean;
  setWritingLetter: (isWriting: boolean) => void;

  isWeatherPending: boolean;
  weatherPendingSince: number | null;
  beginWeatherRequest: (isModification?: boolean) => void;
  endWeatherRequest: () => void;

  setTargetWeather: (target: Partial<WeatherState>, isModification?: boolean) => void;
  resetWeather: () => void;
  triggerRippleMessage: (x: number, y: number, text: string) => void;

  loadSavedBackgrounds: () => Promise<void>;
  addBackground: (dataUrl: string) => Promise<void>;
  removeBackground: (id: string) => Promise<void>;
  setBgImage: (dataUrl: string | null) => Promise<void>;
}

export const useWeatherStore = create<WeatherStore>((set, get) => ({
  targetWeather: defaultWeatherState,
  bgImage: null,
  savedBackgrounds: [],
  activeBackgroundId: null,
  cloudInteractState: "idle",
  isWeatherExtended: false,
  extendCount: 0,
  lastRippleHit: null,
  rippleReadIndex: 0,
  cloudOpacity: 0,
  cloudAnchor: null,
  isDissipating: false,
  isLeaving: false,
  hasStarted: false,
  cloudSpawnKey: 0,
  showTutorial: true,

  closeTutorial: () => {
    set({ showTutorial: false });
  },

  isWritingLetter: false,

  setWritingLetter: (isWriting) => {
    set({ isWritingLetter: isWriting });
  },

  isWeatherPending: false,
  weatherPendingSince: null,

  beginWeatherRequest: (isModification = false) => {
    set({
      isWeatherPending: true,
      weatherPendingSince: Date.now(),
      hasStarted: true,
      cloudSpawnKey: isModification ? get().cloudSpawnKey : Date.now(),
    });
  },

  endWeatherRequest: () => {
    set({ isWeatherPending: false, weatherPendingSince: null });
  },

  setTargetWeather: (partial, isModification = false) => {
    const prevTarget = get().targetWeather;
    const wasPending = get().isWeatherPending;
    set({
      isWeatherPending: false,
      weatherPendingSince: null,
      hasStarted: true,
      rippleReadIndex: 0,
      isDissipating: false,
      isLeaving: false,
      isWeatherExtended: false,
      extendCount: 0,
      cloudInteractState: "idle",
      cloudSpawnKey: isModification || wasPending ? get().cloudSpawnKey : Date.now(),
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
      cloudInteractState: "idle",
      isWeatherExtended: false,
      extendCount: 0,
      isWeatherPending: false,
      weatherPendingSince: null,
      rippleReadIndex: 0,
      isDissipating: false,
      isLeaving: false,
      cloudOpacity: 0,
    });
  },

  setCloudInteractState: (state) => {
    set({ cloudInteractState: state });
  },

  extendWeatherTimer: () => {
    set({
      isWeatherExtended: true,
      isLeaving: false,
      extendCount: get().extendCount + 1,
    });
  },

  updateRippleSpeeches: (newSpeeches) => {
    const rippleMsgs = sanitizeRippleMsgs(newSpeeches);
    if (rippleMsgs.length === 0) return;

    set((state) => ({
      rippleReadIndex: 0,
      targetWeather: {
        ...state.targetWeather,
        messages: {
          ...state.targetWeather.messages,
          rippleMsgs,
        },
      },
    }));
  },

  incrementRippleReadIndex: () => {
    set({ rippleReadIndex: get().rippleReadIndex + 1 });
  },

  triggerDissipate: () => {
    set({ isDissipating: true });
  },

  triggerLeave: () => {
    set({ isLeaving: true });
  },

  triggerRippleMessage: (x, y, text) => {
    set({
      cloudInteractState: "idle",
      lastRippleHit: { x, y, id: crypto.randomUUID(), text },
    });
  },

  loadSavedBackgrounds: async () => {
    const savedBackgrounds = await getAllBackgrounds();
    const activeBackgroundId = await getActiveBackgroundId();
    const active = savedBackgrounds.find((item) => item.id === activeBackgroundId);

    set({
      savedBackgrounds,
      activeBackgroundId,
      bgImage: active?.dataUrl ?? null,
    });
  },

  addBackground: async (dataUrl) => {
    const id = await addBackgroundToStorage(dataUrl);
    await setActiveBackgroundId(id);

    const savedBackgrounds = await getAllBackgrounds();
    set({
      savedBackgrounds,
      activeBackgroundId: id,
      bgImage: dataUrl,
    });
  },

  removeBackground: async (id) => {
    const { activeBackgroundId } = get();
    await removeBackgroundFromStorage(id);

    const savedBackgrounds = await getAllBackgrounds();
    const wasActive = activeBackgroundId === id;

    if (wasActive) {
      await setActiveBackgroundId(null);
      set({
        savedBackgrounds,
        activeBackgroundId: null,
        bgImage: null,
      });
      return;
    }

    set({ savedBackgrounds });
  },

  setBgImage: async (dataUrl) => {
    if (dataUrl === null) {
      await setActiveBackgroundId(null);
      set({ bgImage: null, activeBackgroundId: null });
      return;
    }

    const match = get().savedBackgrounds.find((item) => item.dataUrl === dataUrl);
    const activeId = match?.id ?? null;
    await setActiveBackgroundId(activeId);
    set({ bgImage: dataUrl, activeBackgroundId: activeId });
  },
}));

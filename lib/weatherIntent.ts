import type { WeatherType } from "@/store/useWeatherStore";

export const PRESET_BACKGROUNDS = {
  night: "/backgrounds/night_lake.jpg",
  mountain: "/backgrounds/mountain_lake.jpg",
  forest: "/backgrounds/forest_lake.jpg",
  foggy: "/backgrounds/foggy_lake.jpg",
  cloudy: "/backgrounds/cloudy_seaside.jpg",
  autumn: "/backgrounds/autumn.jpg",
  winter: "/backgrounds/winter.jpg",
  afterRain: "/backgrounds/after_rain.jpg",
} as const;

export interface ExplicitWeatherIntent {
  weather: WeatherType;
  backgroundUrl: string;
}

interface IntentRule {
  weather: WeatherType;
  backgroundUrl: string;
  patterns: RegExp[];
}

/** 强天气词规则：越具体的模式越靠前，避免「暴雨」被「雨」抢先匹配。 */
const EXPLICIT_INTENT_RULES: IntentRule[] = [
  {
    weather: "thunderstorm",
    backgroundUrl: PRESET_BACKGROUNDS.night,
    patterns: [
      /雷暴|雷雨|暴雨|打雷|闪电|电闪雷鸣|霹雳/u,
      /\b(thunderstorm|thunder\s*storm|thunder|lightning)\b/i,
    ],
  },
  {
    weather: "overcast",
    backgroundUrl: PRESET_BACKGROUNDS.winter,
    patterns: [
      /下雪|降雪|雪花|大雪|小雪|雪天|飘雪|鹅毛大雪/u,
      /\b(snow|snowing|snowfall|snowy)\b/i,
    ],
  },
  {
    weather: "clear",
    backgroundUrl: PRESET_BACKGROUNDS.mountain,
    patterns: [
      /晴天|晴朗|艳阳|大太阳|万里无云|晴空/u,
      /\b(sunny|clear\s*sky|sunshine|blue\s*sky)\b/i,
    ],
  },
  {
    weather: "clearing",
    backgroundUrl: PRESET_BACKGROUNDS.afterRain,
    patterns: [/转晴|雨停|雨后天晴|云开/u, /\b(clearing|after\s*rain|rain\s*cleared)\b/i],
  },
  {
    weather: "showers",
    backgroundUrl: PRESET_BACKGROUNDS.afterRain,
    patterns: [/大雨|阵雨|瓢泼/u, /\b(downpour|heavy\s*rain|showers)\b/i],
  },
  {
    weather: "drizzle",
    backgroundUrl: PRESET_BACKGROUNDS.afterRain,
    patterns: [/毛毛雨|细雨/u, /\b(drizzle|drizzling)\b/i],
  },
  {
    weather: "light_rain",
    backgroundUrl: PRESET_BACKGROUNDS.afterRain,
    patterns: [
      /下雨|雨天|降雨|小雨/u,
      /\b(rain|raining|rainy)\b/i,
    ],
  },
  {
    weather: "mist",
    backgroundUrl: PRESET_BACKGROUNDS.foggy,
    patterns: [/大雾|薄雾|雾气|雾天|起雾|雾/u, /\b(fog|foggy|mist|misty|haze)\b/i],
  },
  {
    weather: "cloudy",
    backgroundUrl: PRESET_BACKGROUNDS.cloudy,
    patterns: [/阴天|多云|阴/u, /\b(cloudy|overcast|grey\s*sky|gray\s*sky)\b/i],
  },
  {
    weather: "breeze",
    backgroundUrl: PRESET_BACKGROUNDS.forest,
    patterns: [/刮风|风大|狂风|微风|有风/u, /\b(windy|breeze|gusty)\b/i],
  },
];

/**
 * 检测用户是否明确指定了某种天气。
 * 命中时返回对应天气类型与预设风景，供背景与画面同步过渡。
 */
export function detectExplicitWeatherIntent(text: string): ExplicitWeatherIntent | null {
  const normalized = text.trim();
  if (!normalized) return null;

  for (const rule of EXPLICIT_INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return {
        weather: rule.weather,
        backgroundUrl: rule.backgroundUrl,
      };
    }
  }

  return null;
}

"use client";

import { useEffect, useState } from "react";
import { useWeatherStore, type WeatherType } from "@/store/useWeatherStore";

const AMBIENT_BY_WEATHER: Record<
  WeatherType,
  { from: string; via: string; to: string }
> = {
  clear: {
    from: "rgba(8, 18, 38, 0.42)",
    via: "rgba(0, 0, 0, 0.12)",
    to: "rgba(0, 0, 0, 0.55)",
  },
  breeze: {
    from: "rgba(10, 22, 40, 0.45)",
    via: "rgba(0, 0, 0, 0.16)",
    to: "rgba(0, 0, 0, 0.58)",
  },
  clearing: {
    from: "rgba(12, 24, 44, 0.4)",
    via: "rgba(0, 0, 0, 0.14)",
    to: "rgba(0, 0, 0, 0.52)",
  },
  cloudy: {
    from: "rgba(6, 10, 18, 0.58)",
    via: "rgba(0, 0, 0, 0.28)",
    to: "rgba(0, 0, 0, 0.72)",
  },
  overcast: {
    from: "rgba(4, 8, 16, 0.62)",
    via: "rgba(0, 0, 0, 0.32)",
    to: "rgba(0, 0, 0, 0.78)",
  },
  mist: {
    from: "rgba(14, 18, 24, 0.55)",
    via: "rgba(0, 0, 0, 0.34)",
    to: "rgba(0, 0, 0, 0.74)",
  },
  drizzle: {
    from: "rgba(4, 10, 22, 0.58)",
    via: "rgba(0, 0, 0, 0.3)",
    to: "rgba(0, 0, 0, 0.76)",
  },
  light_rain: {
    from: "rgba(2, 8, 20, 0.6)",
    via: "rgba(0, 0, 0, 0.32)",
    to: "rgba(0, 0, 0, 0.78)",
  },
  showers: {
    from: "rgba(0, 4, 14, 0.68)",
    via: "rgba(0, 0, 0, 0.38)",
    to: "rgba(0, 0, 0, 0.82)",
  },
  thunderstorm: {
    from: "rgba(0, 0, 8, 0.72)",
    via: "rgba(0, 0, 0, 0.45)",
    to: "rgba(0, 0, 0, 0.88)",
  },
};

/**
 * 全屏背景层。氛围永远大于功能：这里不做任何多余装饰，
 * 只在有用户上传图片时铺满并压暗，衬托雨水与波纹。
 */
export default function Background() {
  const bgImage = useWeatherStore((state) => state.bgImage);
  const weather = useWeatherStore((state) => state.targetWeather.weather);
  const ambient = AMBIENT_BY_WEATHER[weather];

  const [displaySrc, setDisplaySrc] = useState<string | null>(bgImage);
  const [imageVisible, setImageVisible] = useState(true);

  useEffect(() => {
    if (bgImage === displaySrc) return;

    if (!displaySrc && bgImage) {
      setDisplaySrc(bgImage);
      setImageVisible(true);
      return;
    }

    setImageVisible(false);
    const timer = window.setTimeout(() => {
      setDisplaySrc(bgImage);
      setImageVisible(true);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [bgImage, displaySrc]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
      {displaySrc && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-in-out ${
              imageVisible ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      )}

      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-[1800ms] ease-in-out"
        style={{
          background: `linear-gradient(to bottom, ${ambient.from}, ${ambient.via}, ${ambient.to})`,
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

const SERIF_FONT = '"Noto Serif SC", "Songti SC", "SimSun", serif';
const RIPPLE_TEXT_DURATION_MS = 8000;

interface FloatingRipple {
  id: string;
  x: number;
  y: number;
  text: string;
}

/**
 * 交互层：不点不说话。
 * 云与波纹的点击检测均在 Canvas 内完成，这里只负责渲染文字。
 */
export default function InteractiveLayer() {
  const [floatingRipples, setFloatingRipples] = useState<FloatingRipple[]>([]);

  const cloudMsg = useWeatherStore((state) => state.targetWeather.messages.cloudMsg);
  const isCloudActive = useWeatherStore((state) => state.isCloudActive);
  const lastRippleHit = useWeatherStore((state) => state.lastRippleHit);

  useEffect(() => {
    if (!lastRippleHit) return;

    const msgs = useWeatherStore.getState().targetWeather.messages.rippleMsgs;
    if (msgs.length === 0) return;

    const text = msgs[Math.floor(Math.random() * msgs.length)];
    const { id, x, y } = lastRippleHit;

    setFloatingRipples((prev) => [...prev, { id, x, y, text }]);

    const timer = window.setTimeout(() => {
      setFloatingRipples((prev) => prev.filter((item) => item.id !== id));
    }, RIPPLE_TEXT_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [lastRippleHit?.id]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* 云的悄悄话：Canvas 命中云后浮现 */}
      {isCloudActive && cloudMsg && (
        <p
          style={{
            fontFamily: SERIF_FONT,
            textShadow: "0 1px 12px rgba(0, 0, 0, 0.6), 0 0 24px rgba(0, 0, 0, 0.3)",
            animation: "fade-in-slow 3s ease-out forwards",
          }}
          className="fixed left-1/2 top-20 w-[85vw] max-w-sm -translate-x-1/2 text-center text-base font-serif tracking-[0.15em] text-white/85 opacity-0 md:top-24 md:w-80 md:max-w-[85vw] md:tracking-[0.2em] md:text-lg"
        >
          {cloudMsg}
        </p>
      )}

      {/* 命中真实波纹后浮现的短句：8 秒内向上漂浮 60px */}
      {floatingRipples.map((item) => (
        <span
          key={item.id}
          style={{
            fontFamily: SERIF_FONT,
            left: item.x,
            top: item.y,
            animation: "ripple-float-up 8s ease-out forwards",
          }}
          className="pointer-events-none fixed max-w-[80vw] -translate-x-1/2 text-base font-serif tracking-[0.15em] text-white/90 md:max-w-none md:text-lg md:tracking-[0.2em] md:text-xl"
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}

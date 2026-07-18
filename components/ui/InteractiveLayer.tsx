"use client";

import { useCallback, useEffect, useState } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

const SERIF_FONT = '"Noto Serif SC", "Songti SC", "SimSun", serif';
const RIPPLE_TEXT_DURATION_MS = 8000;

const EXTEND_RIPPLE_PROMPT =
  "用户希望在这场雨里多待一会儿。请为这场雨生成一套全新的三阶段波纹回应。";

interface FloatingRipple {
  id: string;
  x: number;
  y: number;
  text: string;
}

interface CloudAnchor {
  x: number;
  y: number;
  radius: number;
}

function extractRippleSpeeches(data: unknown): string[] | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const fromMessages = (record.messages as { rippleMsgs?: unknown } | undefined)?.rippleMsgs;
  if (Array.isArray(fromMessages)) return fromMessages as string[];

  if (Array.isArray(record.rippleSpeeches)) return record.rippleSpeeches as string[];

  return null;
}

/**
 * 交互层：不点不说话。
 * 云与波纹的点击检测均在 Canvas 内完成，这里只负责渲染文字。
 */
export default function InteractiveLayer() {
  const [floatingRipples, setFloatingRipples] = useState<FloatingRipple[]>([]);
  const [isGatheringRipples, setIsGatheringRipples] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<CloudAnchor | null>(null);

  const cloudMsg = useWeatherStore((state) => state.targetWeather.messages.cloudMsg);
  const cloudInteractState = useWeatherStore((state) => state.cloudInteractState);
  const setCloudInteractState = useWeatherStore((state) => state.setCloudInteractState);
  const lastRippleHit = useWeatherStore((state) => state.lastRippleHit);

  useEffect(() => {
    if (cloudInteractState !== "menu") {
      setMenuAnchor(null);
      return;
    }

    let frameId = 0;
    const followCloud = () => {
      const anchor = useWeatherStore.getState().cloudAnchor;
      if (anchor) {
        setMenuAnchor(anchor);
      }
      frameId = requestAnimationFrame(followCloud);
    };

    frameId = requestAnimationFrame(followCloud);
    return () => cancelAnimationFrame(frameId);
  }, [cloudInteractState]);

  useEffect(() => {
    if (!lastRippleHit) return;

    const { text } = lastRippleHit;
    if (!text) return;

    const { id, x, y } = lastRippleHit;

    setFloatingRipples((prev) => [...prev, { id, x, y, text }]);

    const timer = window.setTimeout(() => {
      setFloatingRipples((prev) => prev.filter((item) => item.id !== id));
    }, RIPPLE_TEXT_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [lastRippleHit?.id]);

  const handleExtendWeather = useCallback(async () => {
    setCloudInteractState("idle");
    useWeatherStore.getState().extendWeatherTimer();

    const { targetWeather } = useWeatherStore.getState();
    if (targetWeather.rain.intensity <= 0) return;

    setIsGatheringRipples(true);

    try {
      const response = await fetch("/api/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: EXTEND_RIPPLE_PROMPT }),
      });

      if (!response.ok) return;

      const data: unknown = await response.json();
      const speeches = extractRippleSpeeches(data);
      if (speeches && speeches.length > 0) {
        useWeatherStore.getState().updateRippleSpeeches(speeches);
      }
    } catch (error) {
      console.error("[extend] 波纹回应获取失败:", error);
    } finally {
      setIsGatheringRipples(false);
    }
  }, [setCloudInteractState]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {isGatheringRipples && (
        <p
          style={{
            fontFamily: SERIF_FONT,
            animation: "fade-in-slow 2s ease-out forwards",
          }}
          className="fixed left-6 top-6 text-xs font-serif tracking-[0.3em] text-white/35 opacity-0 md:left-8 md:top-8 md:text-sm md:tracking-[0.35em]"
        >
          波纹正在重新汇聚...
        </p>
      )}

      {/* 点击云后：描述语在云正上方，选项在云正下方，随云漂移 */}
      {cloudInteractState === "menu" && menuAnchor && (
        <>
          {cloudMsg && (
            <p
              style={{
                fontFamily: SERIF_FONT,
                left: menuAnchor.x,
                top: menuAnchor.y - menuAnchor.radius - 20,
                textShadow: "0 1px 12px rgba(0, 0, 0, 0.6), 0 0 24px rgba(0, 0, 0, 0.3)",
                animation: "fade-in-slow 2s ease-out forwards",
              }}
              className="pointer-events-none fixed w-[85vw] max-w-xs -translate-x-1/2 -translate-y-full text-center text-sm font-serif tracking-[0.2em] text-white/80 opacity-0 md:max-w-sm md:text-base md:tracking-[0.25em]"
            >
              {cloudMsg}
            </p>
          )}

          <div
            className="pointer-events-auto fixed flex flex-col items-center space-y-5 md:space-y-6"
            style={{
              left: menuAnchor.x,
              top: menuAnchor.y + menuAnchor.radius + 16,
              transform: "translateX(-50%)",
              animation: "fade-in-slow 2.5s ease-out 0.4s forwards",
              opacity: 0,
            }}
          >
            <button
              type="button"
              onClick={() => void handleExtendWeather()}
              className="border-0 bg-transparent p-0 font-serif text-sm tracking-[0.35em] text-white/55 transition-colors duration-700 hover:text-white/90 md:text-base md:tracking-[0.4em]"
              style={{ fontFamily: SERIF_FONT }}
            >
              我希望这个天气持久一些
            </button>
            <button
              type="button"
              onClick={() => setCloudInteractState("input")}
              className="border-0 bg-transparent p-0 font-serif text-sm tracking-[0.35em] text-white/55 transition-colors duration-700 hover:text-white/90 md:text-base md:tracking-[0.4em]"
              style={{ fontFamily: SERIF_FONT }}
            >
              和天气说一句话
            </button>
          </div>
        </>
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

"use client";

import { useEffect, useState } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

const SERIF_FONT = '"Noto Serif SC", "Songti SC", "SimSun", serif';

const TUTORIAL_LINES = [
  "在这里，语言会化作一场天气。",
  "云朵路过时，你可以试着触碰它。",
  "雨落下时，也可以轻抚水面的波纹。",
  "右下角的微光，能换上属于你的风景。",
] as const;

const LINE_INTERVAL_MS = 1500;
const ENTER_BUTTON_DELAY_MS = 1500;

/**
 * 进入世界前的情绪缓冲——不是教程，是一段缓缓浮现的诗。
 */
export default function TutorialOverlay() {
  const showTutorial = useWeatherStore((state) => state.showTutorial);
  const closeTutorial = useWeatherStore((state) => state.closeTutorial);

  const [revealedCount, setRevealedCount] = useState(0);
  const [showEnter, setShowEnter] = useState(false);

  useEffect(() => {
    if (!showTutorial) return;

    setRevealedCount(0);
    setShowEnter(false);

    const timers: ReturnType<typeof setTimeout>[] = [];

    TUTORIAL_LINES.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          setRevealedCount(index + 1);
        }, index * LINE_INTERVAL_MS),
      );
    });

    timers.push(
      setTimeout(() => {
        setShowEnter(true);
      }, (TUTORIAL_LINES.length - 1) * LINE_INTERVAL_MS + ENTER_BUTTON_DELAY_MS),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [showTutorial]);

  if (!showTutorial) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
      <button
        type="button"
        onClick={closeTutorial}
        className="absolute right-8 top-8 cursor-pointer text-sm tracking-widest text-white/20 transition hover:text-white/60"
      >
        跳过 (Skip)
      </button>

      <div
        style={{ fontFamily: SERIF_FONT }}
        className="max-w-lg space-y-8 px-8 text-center font-serif tracking-[0.2em] text-white/80"
      >
        {TUTORIAL_LINES.map((line, index) => (
          <p
            key={line}
            className={`text-base leading-relaxed transition-opacity duration-1000 md:text-lg ${
              revealedCount > index ? "opacity-100" : "opacity-0"
            }`}
          >
            {line}
          </p>
        ))}

        <button
          type="button"
          onClick={closeTutorial}
          className={`mx-auto mt-4 cursor-pointer border-b border-white/20 pb-1 text-sm tracking-[0.25em] transition-opacity duration-1000 hover:text-white ${
            showEnter ? "text-white/60 opacity-100" : "pointer-events-none text-white/60 opacity-0"
          }`}
        >
          走进世界
        </button>
      </div>
    </div>
  );
}

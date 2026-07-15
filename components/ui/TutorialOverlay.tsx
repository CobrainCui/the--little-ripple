"use client";

import { useEffect, useState } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

const SERIF_FONT = '"Noto Serif SC", "Songti SC", "SimSun", serif';

const TUTORIAL_LINES = [
  {
    zh: "在这里，语言会化作一场天气。",
    en: "Here, words become weather.",
  },
  {
    zh: "云朵路过时，你可以试着触碰它。",
    en: "When a cloud drifts by, try touching it.",
  },
  {
    zh: "雨落下时，也可以轻抚水面的波纹。",
    en: "When rain falls, gently touch the ripples.",
  },
  {
    zh: "右下角的微光，能换上属于你的风景。",
    en: "A soft glow below can change your scenery.",
  },
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
        className="max-w-xl space-y-10 px-8 text-center font-serif tracking-[0.2em] text-white/80"
      >
        {TUTORIAL_LINES.map((line, index) => (
          <div
            key={line.zh}
            className={`space-y-3 transition-opacity duration-1000 ${
              revealedCount > index ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="text-base leading-relaxed md:text-lg">{line.zh}</p>
            <p className="text-sm leading-relaxed tracking-[0.16em] text-white/45 md:text-base">
              {line.en}
            </p>
          </div>
        ))}

        <button
          type="button"
          onClick={closeTutorial}
          className={`mx-auto mt-4 cursor-pointer border-b border-white/20 pb-1 text-sm tracking-[0.2em] transition-opacity duration-1000 hover:text-white ${
            showEnter ? "text-white/60 opacity-100" : "pointer-events-none text-white/60 opacity-0"
          }`}
        >
          走进世界 / Enter
        </button>
      </div>
    </div>
  );
}

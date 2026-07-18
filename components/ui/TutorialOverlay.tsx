"use client";

import { useEffect, useState } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

const SERIF_FONT = '"Noto Serif SC", "Songti SC", "SimSun", serif';

const TUTORIAL_LINES = [
  {
    zh: "1. 在底部写下一句话，天空会为你凝聚一场专属的天气。",
    en: "1. Write a line at the bottom — the sky will gather a weather just for you.",
  },
  {
    zh: "2. 触碰水面的波纹，倾听它的渐次回应；触碰云朵，可以挽留它或改变天气。",
    en: "2. Touch ripples on the water for its unfolding replies; touch the cloud to linger or change the weather.",
  },
  {
    zh: "3. 右下角可更换风景，左下角可向造物主递出一封信。",
    en: "3. Change the landscape at bottom-right; send a letter to the maker at bottom-left.",
  },
] as const;

const LINE_INTERVAL_MS = 1500;
const ENTER_BUTTON_DELAY_MS = 1000;

/**
 * 进入世界前的轻引导——清晰、留白、双语。
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
        className="max-w-2xl px-8 text-center font-serif"
      >
        {TUTORIAL_LINES.map((line, index) => (
          <div
            key={line.zh}
            className={`mb-6 transition-opacity duration-700 ease-out ${
              revealedCount > index ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="text-lg leading-relaxed tracking-wider text-white/80 md:text-xl">
              {line.zh}
            </p>
            <p className="mt-2 text-base leading-relaxed tracking-wider text-white/45 md:text-lg">
              {line.en}
            </p>
          </div>
        ))}

        <button
          type="button"
          onClick={closeTutorial}
          className={`mx-auto mt-2 cursor-pointer border-b border-white/20 pb-1 text-base tracking-wider transition-opacity duration-700 ease-out hover:text-white md:text-lg ${
            showEnter ? "text-white/70 opacity-100" : "pointer-events-none text-white/70 opacity-0"
          }`}
        >
          {"开始体验 -> / Start ->"}
        </button>
      </div>
    </div>
  );
}

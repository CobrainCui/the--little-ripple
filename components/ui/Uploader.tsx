"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

export default function Uploader() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const backgrounds = useWeatherStore((state) => state.backgrounds);
  const activeBackgroundIndex = useWeatherStore((state) => state.activeBackgroundIndex);
  const addBackground = useWeatherStore((state) => state.addBackground);
  const switchBackground = useWeatherStore((state) => state.switchBackground);
  const hydrateBackgrounds = useWeatherStore((state) => state.hydrateBackgrounds);

  useEffect(() => {
    hydrateBackgrounds();
  }, [hydrateBackgrounds]);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await addBackground(file);
    event.target.value = "";
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {backgrounds.length > 1 && (
        <div className="flex items-center gap-1.5">
          {backgrounds.map((_, index) => (
            <button
              key={backgrounds[index]}
              type="button"
              aria-label={`切换背景 ${index + 1}`}
              onClick={() => switchBackground(index)}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
                index === activeBackgroundIndex
                  ? "bg-white/60"
                  : "bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label="上传一张背景图"
        onClick={() => inputRef.current?.click()}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white/10 opacity-50 outline-none transition-all duration-500 ease-out hover:border-white/70 hover:opacity-100 focus-visible:border-white/70 focus-visible:opacity-100"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
      </button>
    </div>
  );
}

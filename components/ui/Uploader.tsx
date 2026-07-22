"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { fileToBase64 } from "@/lib/backgroundStorage";
import { PRESET_BACKGROUNDS } from "@/lib/weatherIntent";
import { useWeatherStore } from "@/store/useWeatherStore";

const DEFAULT_BACKGROUNDS = [
  { id: "default-night", dataUrl: PRESET_BACKGROUNDS.night },
  { id: "default-mountain", dataUrl: PRESET_BACKGROUNDS.mountain },
  { id: "default-forest", dataUrl: PRESET_BACKGROUNDS.forest },
  { id: "default-foggy", dataUrl: PRESET_BACKGROUNDS.foggy },
  { id: "default-cloudy", dataUrl: PRESET_BACKGROUNDS.cloudy },
  { id: "default-autumn", dataUrl: PRESET_BACKGROUNDS.autumn },
  { id: "default-winter", dataUrl: PRESET_BACKGROUNDS.winter },
  { id: "default-after-rain", dataUrl: PRESET_BACKGROUNDS.afterRain },
];

export default function Uploader() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const savedBackgrounds = useWeatherStore((state) => state.savedBackgrounds);
  const bgImage = useWeatherStore((state) => state.bgImage);
  const loadSavedBackgrounds = useWeatherStore((state) => state.loadSavedBackgrounds);
  const addBackground = useWeatherStore((state) => state.addBackground);
  const removeBackground = useWeatherStore((state) => state.removeBackground);
  const setBgImage = useWeatherStore((state) => state.setBgImage);

  useEffect(() => {
    loadSavedBackgrounds();
  }, [loadSavedBackgrounds]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await fileToBase64(file);
    await addBackground(dataUrl);
    event.target.value = "";
  };

  return (
    <div ref={containerRef} className="fixed bottom-16 right-4 z-40 md:bottom-8">
      {isOpen && (
        <div
          style={{ animation: "fade-in-slow 0.6s ease-out forwards" }}
          className="absolute bottom-14 right-0 w-48 rounded-lg border border-white/10 bg-black/70 p-3 text-white/80 opacity-0 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setBgImage(null)}
            className={`mb-2 w-full border-0 bg-transparent py-2 text-left text-xs tracking-wide outline-none transition-colors duration-500 active:text-white/90 ${
              bgImage === null ? "text-white/90" : "text-white/50 md:hover:text-white/75"
            }`}
          >
            纯黑 (Void)
          </button>

          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {DEFAULT_BACKGROUNDS.map((item) => (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => setBgImage(item.dataUrl)}
                  className={`block w-full overflow-hidden rounded outline-none transition-opacity duration-500 active:opacity-100 ${
                    bgImage === item.dataUrl
                      ? "opacity-100 ring-1 ring-white/50"
                      : "opacity-50 md:hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.dataUrl} alt="" className="h-10 w-full object-cover" />
                </button>
              </div>
            ))}

            {savedBackgrounds.length > 0 && (
              <div className="my-1 border-t border-white/10" />
            )}

            {savedBackgrounds.map((item) => (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => setBgImage(item.dataUrl)}
                  className={`block w-full overflow-hidden rounded outline-none transition-opacity duration-500 active:opacity-100 ${
                    bgImage === item.dataUrl
                      ? "opacity-100 ring-1 ring-white/50"
                      : "opacity-50 md:hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.dataUrl} alt="" className="h-10 w-full object-cover" />
                </button>
                <button
                  type="button"
                  aria-label="删除背景"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeBackground(item.id);
                  }}
                  className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end border-0 bg-transparent p-1 text-lg leading-none text-white/30 outline-none transition-all duration-300 active:text-white md:hover:text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="my-2 border-t border-white/10" />

          <label className="block w-full cursor-pointer py-2 text-left text-xs tracking-wide text-white/40 transition-colors duration-500 active:text-white/70 md:hover:text-white/70">
            + 上传新背景
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        </div>
      )}

      <button
        type="button"
        aria-label="背景画廊"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white/10 p-4 opacity-50 outline-none transition-all duration-500 ease-out active:border-white/70 active:opacity-100 md:h-8 md:w-8 md:p-0 md:hover:border-white/70 md:hover:opacity-100 focus-visible:border-white/70 focus-visible:opacity-100"
      />
    </div>
  );
}

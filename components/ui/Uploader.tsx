"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { fileToBase64 } from "@/lib/backgroundStorage";
import { useWeatherStore } from "@/store/useWeatherStore";

const DEFAULT_BACKGROUNDS = [
  { id: 'default-night', dataUrl: '/backgrounds/night_lake.jpg' },
  { id: 'default-mountain', dataUrl: '/backgrounds/mountain_lake.jpg' },
  { id: 'default-forest', dataUrl: '/backgrounds/forest_lake.jpg' },
  { id: 'default-foggy', dataUrl: '/backgrounds/foggy_lake.jpg' },
  { id: 'default-cloudy', dataUrl: '/backgrounds/cloudy_seaside.jpg' },
  { id: 'default-autumn', dataUrl: '/backgrounds/autumn.jpg' },
  { id: 'default-winter', dataUrl: '/backgrounds/winter.jpg' },
  { id: 'default-after-rain', dataUrl: '/backgrounds/after_rain.jpg' },
];

export default function Uploader() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await fileToBase64(file);
    await addBackground(dataUrl);
    event.target.value = "";
  };

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-40">
      {isOpen && (
        <div
          style={{ animation: "fade-in-slow 0.6s ease-out forwards" }}
          className="absolute bottom-10 right-0 w-48 rounded-lg border border-white/10 bg-black/70 p-3 text-white/80 opacity-0 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setBgImage(null)}
            className={`mb-2 w-full border-0 bg-transparent py-1.5 text-left text-xs tracking-wide outline-none transition-colors duration-500 ${
              bgImage === null ? "text-white/90" : "text-white/50 hover:text-white/75"
            }`}
          >
            纯黑 (Void)
          </button>

          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {DEFAULT_BACKGROUNDS.map((item) => (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setBgImage(item.dataUrl)}
                  className={`block w-full overflow-hidden rounded outline-none transition-opacity duration-500 ${
                    bgImage === item.dataUrl ? "opacity-100 ring-1 ring-white/50" : "opacity-50 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.dataUrl}
                    alt=""
                    className="h-10 w-full object-cover"
                  />
                </button>
              </div>
            ))}

            {savedBackgrounds.length > 0 && (
              <div className="my-1 border-t border-white/10" />
            )}

            {savedBackgrounds.map((item) => (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setBgImage(item.dataUrl)}
                  className={`block w-full overflow-hidden rounded outline-none transition-opacity duration-500 ${
                    bgImage === item.dataUrl ? "opacity-100" : "opacity-50 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.dataUrl}
                    alt=""
                    className="h-10 w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  aria-label="删除背景"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeBackground(item.id);
                  }}
                  className="absolute right-1 top-1 border-0 bg-transparent px-1 text-xs text-white/50 opacity-0 outline-none transition-all duration-300 group-hover:opacity-100 hover:text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="my-2 border-t border-white/10" />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full border-0 bg-transparent py-1 text-left text-xs tracking-wide text-white/40 outline-none transition-colors duration-500 hover:text-white/70"
          >
            + 上传新背景
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label="背景画廊"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white/10 opacity-50 outline-none transition-all duration-500 ease-out hover:border-white/70 hover:opacity-100 focus-visible:border-white/70 focus-visible:opacity-100"
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

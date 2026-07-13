"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

/**
 * 不是聊天框。没有气泡，没有发送按钮，没有边界。
 * 只是一根安静的线，等一句话落下去，然后变成天气。
 */
export default function ThoughtInput() {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isCloudActive = useWeatherStore((state) => state.isCloudActive);
  const setTargetWeather = useWeatherStore((state) => state.setTargetWeather);
  const setCloudActive = useWeatherStore((state) => state.setCloudActive);

  useEffect(() => {
    if (isCloudActive) {
      inputRef.current?.focus();
    }
  }, [isCloudActive]);

  const placeholder = isSending
    ? "云在聚集..."
    : isCloudActive
      ? "我想要一场..."
      : "今天，想落下一句话吗？";

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setText("");

    try {
      const response = await fetch("/api/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const weather = await response.json();
      setTargetWeather(weather);
      setCloudActive(false);
    } catch (error) {
      console.error("[ThoughtInput] 这句话没能抵达天空：", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="pointer-events-auto fixed bottom-32 left-1/2 z-[100] -translate-x-1/2">
      <input
        ref={inputRef}
        type="text"
        value={text}
        disabled={isSending}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`pointer-events-auto w-72 border-0 border-b border-white/20 bg-transparent px-1 py-2 text-center text-sm tracking-wide text-white/80 outline-none transition-colors duration-500 placeholder:text-white/40 focus:border-white/40 disabled:cursor-default ${
          isSending ? "animate-pulse" : ""
        }`}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { detectInputLanguage, type InputLanguage } from "@/lib/language";
import { useWeatherStore } from "@/store/useWeatherStore";

const UI_COPY = {
  bilingual: {
    idle: "今天，想落下一句话吗？ / A line for today?",
    cloudActive: "我想要一场... / I'd like...",
    sending: "云正在聚集... / Cloud is gathering...",
  },
  zh: {
    idle: "今天，想落下一句话吗？",
    cloudActive: "我想要一场...",
    sending: "云正在聚集...",
  },
  en: {
    idle: "A line for today?",
    cloudActive: "I'd like...",
    sending: "Cloud is gathering...",
  },
} as const;

function resolveUiLanguage(text: string, sendingLanguage: InputLanguage | null): InputLanguage | "bilingual" {
  const trimmed = text.trim();
  if (trimmed) return detectInputLanguage(trimmed);
  if (sendingLanguage) return sendingLanguage;
  return "bilingual";
}

/**
 * 不是聊天框。没有气泡，没有发送按钮，没有边界。
 * 只是一根安静的线，等一句话落下去，然后变成天气。
 */
export default function ThoughtInput() {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendingLanguage, setSendingLanguage] = useState<InputLanguage | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isCloudActive = useWeatherStore((state) => state.isCloudActive);
  const setTargetWeather = useWeatherStore((state) => state.setTargetWeather);
  const setCloudActive = useWeatherStore((state) => state.setCloudActive);

  useEffect(() => {
    if (isCloudActive) {
      inputRef.current?.focus();
    }
  }, [isCloudActive]);

  const uiLanguage = resolveUiLanguage(text, sendingLanguage);
  const copy = UI_COPY[uiLanguage];

  const displayValue = isSending ? copy.sending : text;
  const placeholder = isCloudActive ? copy.cloudActive : copy.idle;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const isModification = useWeatherStore.getState().isCloudActive;
    const language = detectInputLanguage(trimmed);
    setSendingLanguage(language);
    setIsSending(true);
    console.log("正在发送天气请求...", trimmed);

    let succeeded = false;

    try {
      const response = await fetch("/api/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("提交失败: 响应不是合法 JSON", parseError);
        throw parseError;
      }

      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : `请求失败 (${response.status})`;
        throw new Error(message);
      }

      if (!data || typeof data !== "object" || !("weather" in data)) {
        throw new Error("返回数据格式无效，缺少 weather 字段");
      }

      console.log("收到天气数据:", data);
      setTargetWeather(data as Parameters<typeof setTargetWeather>[0], isModification);
      setCloudActive(false);
      succeeded = true;
    } catch (error) {
      console.error("提交失败:", error);
    } finally {
      setIsSending(false);
      setSendingLanguage(null);
      if (succeeded) {
        setText("");
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="pointer-events-auto fixed bottom-32 left-1/2 z-[100] -translate-x-1/2">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        disabled={isSending}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`pointer-events-auto w-80 max-w-[85vw] border-0 border-b border-white/20 bg-transparent px-1 py-2 text-center text-sm tracking-wide outline-none transition-colors duration-500 focus:border-white/40 disabled:cursor-default ${
          isSending
            ? "animate-pulse text-white/40 placeholder:text-white/40"
            : "text-white/80 placeholder:text-white/40"
        }`}
      />
    </div>
  );
}

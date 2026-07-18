"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { detectInputLanguage, type InputLanguage } from "@/lib/language";
import { useWeatherStore } from "@/store/useWeatherStore";

const UI_COPY = {
  bilingual: {
    idle: "今天，想落下一句话吗？ / A line for today?",
    cloudActive: "想要换一种天气吗... / Whisper a new weather...",
    sending: "云正在聚集... / Cloud is gathering...",
  },
  zh: {
    idle: "今天，想落下一句话吗？",
    cloudActive: "我想要一场...",
    sending: "云正在聚集...",
  },
  en: {
    idle: "A line for today?",
    cloudActive: "Whisper a new weather...",
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

  const cloudInteractState = useWeatherStore((state) => state.cloudInteractState);
  const setTargetWeather = useWeatherStore((state) => state.setTargetWeather);
  const setCloudInteractState = useWeatherStore((state) => state.setCloudInteractState);
  const beginWeatherRequest = useWeatherStore((state) => state.beginWeatherRequest);
  const endWeatherRequest = useWeatherStore((state) => state.endWeatherRequest);

  const isInputMode = cloudInteractState === "input";

  useEffect(() => {
    if (isInputMode) {
      inputRef.current?.focus();
    }
  }, [isInputMode]);

  const uiLanguage = resolveUiLanguage(text, sendingLanguage);
  const copy = UI_COPY[uiLanguage];

  const displayValue = isSending ? copy.sending : text;
  const placeholder = isInputMode ? copy.cloudActive : copy.idle;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const isModification = useWeatherStore.getState().cloudInteractState === "input";
    const language = detectInputLanguage(trimmed);
    setSendingLanguage(language);
    setIsSending(true);
    beginWeatherRequest(isModification);
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
      setCloudInteractState("idle");
      succeeded = true;
    } catch (error) {
      console.error("提交失败:", error);
      endWeatherRequest();
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
    <div className="pointer-events-auto fixed bottom-36 left-1/2 z-[100] w-[80vw] max-w-[80vw] -translate-x-1/2 md:bottom-32 md:w-96 md:max-w-none">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        disabled={isSending}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`pointer-events-auto w-full border-0 border-b border-white/20 bg-transparent px-1 py-2 text-center text-sm tracking-wide outline-none transition-colors duration-500 focus:border-white/40 disabled:cursor-default ${
          isSending
            ? "animate-pulse text-white/40 placeholder:text-white/40"
            : "text-white/80 placeholder:text-white/40"
        }`}
      />
    </div>
  );
}

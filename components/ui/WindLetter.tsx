"use client";

import { useEffect, useRef, useState } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

const SERIF_FONT = '"Noto Serif SC", "Songti SC", "SimSun", serif';
const SUCCESS_MESSAGE = "信已随风飘走...";
const CLOSE_DELAY_MS = 2000;
const FADE_DURATION_MS = 1200;

/**
 * 风中的信 — 不是意见箱，只是悄悄递给世界的一句话。
 */
export default function WindLetter() {
  const isWritingLetter = useWeatherStore((state) => state.isWritingLetter);
  const setWritingLetter = useWeatherStore((state) => state.setWritingLetter);

  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resetState = () => {
    setContent("");
    setIsSending(false);
    setIsSent(false);
    setIsClosing(false);
  };

  const closeLetter = () => {
    if (isSending) return;
    resetState();
    setWritingLetter(false);
  };

  const beginGracefulClose = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      closeLetter();
    }, FADE_DURATION_MS);
  };

  useEffect(() => {
    if (!isWritingLetter) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    const frame = requestAnimationFrame(() => setIsOpen(true));
    textareaRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSending && !isSent) {
        closeLetter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isWritingLetter, isSending, isSent]);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSending || isSent) return;

    setIsSending(true);

    try {
      const response = await fetch("/api/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok) {
        throw new Error("发送失败");
      }

      setIsSent(true);
      setIsSending(false);
      setContent(SUCCESS_MESSAGE);

      window.setTimeout(() => {
        beginGracefulClose();
      }, CLOSE_DELAY_MS);
    } catch (error) {
      console.error("[WindLetter] 信件未能递出：", error);
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setWritingLetter(true)}
        className="pointer-events-auto fixed bottom-8 left-8 z-50 cursor-pointer text-sm tracking-widest text-white/20 transition hover:text-white/60"
      >
        落下一封信...
      </button>

      {isWritingLetter && (
        <div
          role="presentation"
          onClick={closeLetter}
          className={`fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-[1200ms] ease-out ${
            isClosing || !isOpen ? "opacity-0" : "opacity-100"
          }`}
        >
          <div
            role="presentation"
            onClick={(event) => event.stopPropagation()}
            className={`flex w-full max-w-md flex-col items-center px-8 transition-all duration-[1200ms] ease-out ${
              isClosing ? "translate-y-2 scale-[1.02] opacity-0 blur-[2px]" : "translate-y-0 opacity-100 blur-0"
            }`}
            style={{ fontFamily: SERIF_FONT }}
          >
            <textarea
              ref={textareaRef}
              value={content}
              readOnly={isSent}
              disabled={isSending}
              rows={4}
              placeholder="想对这个世界说点什么..."
              onChange={(event) => setContent(event.target.value)}
              className={`w-full resize-none border-0 border-b border-white/15 bg-transparent py-3 text-center text-base leading-relaxed tracking-[0.15em] text-white/80 outline-none transition-colors placeholder:text-white/30 focus:border-white/30 disabled:cursor-default ${
                isSent ? "animate-pulse text-white/50" : ""
              }`}
            />

            {!isSent && (
              <button
                type="button"
                disabled={isSending || !content.trim()}
                onClick={() => void handleSend()}
                className="mt-10 cursor-pointer border-b border-white/20 pb-1 text-sm tracking-[0.25em] text-white/40 transition hover:text-white/80 disabled:cursor-default disabled:opacity-30"
              >
                {isSending ? "递出中..." : "随风递出"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

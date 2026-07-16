"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useWeatherStore } from "@/store/useWeatherStore";

const SERIF_FONT = '"Noto Serif SC", "Songti SC", "SimSun", serif';
const SUCCESS_MESSAGE = "信已随风飘走...";
const SUCCESS_CLOSE_MS = 1500;
const FADE_OUT_MS = 500;

/**
 * 风中的信 — 不是意见箱，只是悄悄递给世界的一句话。
 */
export default function WindLetter() {
  const isWritingLetter = useWeatherStore((state) => state.isWritingLetter);
  const setWritingLetter = useWeatherStore((state) => state.setWritingLetter);

  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetState = () => {
    setContent("");
    setIsSubmitting(false);
    setIsSent(false);
    setIsClosing(false);
    setSubmitError(false);
  };

  const closeOverlay = () => {
    resetState();
    setWritingLetter(false);
  };

  const scheduleAutoClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);

    closeTimerRef.current = setTimeout(() => {
      setIsClosing(true);
      closeTimerRef.current = setTimeout(() => {
        closeOverlay();
      }, FADE_OUT_MS);
    }, SUCCESS_CLOSE_MS);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isWritingLetter) {
      setIsOpen(false);
      return;
    }

    resetState();
    setIsOpen(false);
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [isWritingLetter]);

  useEffect(() => {
    if (!isWritingLetter) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting && !isSent) {
        closeOverlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWritingLetter, isSubmitting, isSent]);

  useEffect(() => {
    if (isWritingLetter && !isSent && !isSubmitting) {
      textareaRef.current?.focus();
    }
  }, [isWritingLetter, isSent, isSubmitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = content.trim();
    if (!trimmed || isSubmitting || isSent) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      let data: { success?: boolean; error?: string } | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      if (!data?.success) {
        throw new Error(data?.error ?? "服务器未确认发送成功");
      }

      setIsSent(true);
      scheduleAutoClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "发送失败";
      console.error("[WindLetter] 信件未能递出：", error);
      alert(`发送失败: ${message}`);

      setSubmitError(true);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setSubmitError(false);
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = () => {
    if (isSubmitting || isSent) return;
    closeOverlay();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setWritingLetter(true)}
        className="pointer-events-auto fixed bottom-8 left-8 z-50 cursor-pointer text-sm tracking-widest text-white/20 transition hover:text-white/60"
      >
        落下一封信... / Leave a letter...
      </button>

      {isWritingLetter && (
        <div
          role="presentation"
          onClick={handleBackdropClick}
          className={`fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-500 ease-out ${
            isClosing || !isOpen ? "opacity-0" : "opacity-100"
          }`}
        >
          <form
            onSubmit={(event) => void handleSubmit(event)}
            onClick={(event) => event.stopPropagation()}
            className={`flex w-full max-w-lg flex-col items-center px-8 transition-all duration-500 ease-out ${
              isClosing ? "translate-y-1 scale-[1.01] opacity-0 blur-[1px]" : "opacity-100 blur-0"
            }`}
            style={{ fontFamily: SERIF_FONT }}
          >
            {isSent ? (
              <p className="animate-pulse font-serif tracking-widest text-white/60">
                {SUCCESS_MESSAGE}
              </p>
            ) : (
              <>
                <p className="mb-4 text-center font-serif text-xs tracking-widest text-white/30">
                  写给造物主的信 · Feedback
                </p>

                <textarea
                  ref={textareaRef}
                  value={content}
                  disabled={isSubmitting}
                  rows={4}
                  placeholder="关于这个世界的建议，或是期待的新天气... / Suggestions or new weather you wish for..."
                  onChange={(event) => setContent(event.target.value)}
                  className="w-full resize-none border-0 border-b border-white/15 bg-transparent py-3 text-center text-base leading-relaxed tracking-[0.12em] text-white/80 outline-none transition-colors placeholder:text-white/30 focus:border-white/30 disabled:cursor-default disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={isSubmitting || !content.trim()}
                  className={`mt-10 cursor-pointer border-b pb-1 text-sm tracking-[0.25em] transition disabled:cursor-default disabled:opacity-30 ${
                    submitError
                      ? "border-red-400/40 text-red-400/80"
                      : "border-white/20 text-white/40 hover:text-white/80"
                  }`}
                >
                  {submitError
                    ? "递出失败，请重试"
                    : isSubmitting
                      ? "正在递出..."
                      : "随风递出"}
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}

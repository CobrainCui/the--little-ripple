"use client";

import { useWeatherStore } from "@/store/useWeatherStore";

/**
 * 全屏背景层。氛围永远大于功能：这里不做任何多余装饰，
 * 只在有用户上传图片时铺满并压暗，衬托雨水与波纹。
 */
export default function Background() {
  const bgImage = useWeatherStore((state) => state.bgImage);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
      {bgImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />
        </>
      )}
    </div>
  );
}

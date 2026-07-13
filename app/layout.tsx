import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小波纹 · Ripple",
  description: "一场安静的天气，理解很多，表达很少。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

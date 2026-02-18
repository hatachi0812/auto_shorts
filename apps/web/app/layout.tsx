import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alphacut - 숏폼 자동 제작 도구",
  description: "YouTube 영상을 AI로 분석하여 숏폼 콘텐츠를 자동 제작합니다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#0f0f0f] text-white">
        <nav className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            A
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Alphacut
          </span>
          <span className="text-xs text-white/40 ml-1">숏폼 자동 제작 도구</span>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

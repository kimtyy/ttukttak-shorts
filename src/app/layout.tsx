import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavigationHeader } from "@/components/ui/NavigationHeader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "뚝딱쇼츠 (ttukttak-shorts) - AI 범용 쇼츠·릴스 제작 플랫폼",
  description: "만들고 싶은 내용을 직접 입력하거나 AI 추천 주제를 선택하면, 쇼츠·릴스용 대본과 장면을 자동으로 기획해주는 범용 콘텐츠 제작 서비스",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased min-h-screen flex flex-col`}>
        <NavigationHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

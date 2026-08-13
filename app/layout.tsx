import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PortfolioCacheProvider from "@/components/PortfolioCacheProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ITSD Project Tracker",
  description: "IT Department Project Tracker System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PortfolioCacheProvider>{children}</PortfolioCacheProvider>
      </body>
    </html>
  );
}

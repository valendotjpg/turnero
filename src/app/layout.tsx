import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { isDemoMode } from "@/lib/demo";
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
  title: { default: "Turnero", template: "%s · Turnero" },
  description: "Turnos online para negocios locales.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {isDemoMode() && (
          <p className="bg-foreground px-4 py-1.5 text-center text-xs text-background">
            Demo de portfolio: los datos se reinician todos los días y los emails no se envían.
          </p>
        )}
        {children}
      </body>
    </html>
  );
}

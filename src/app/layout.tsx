import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
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

// Condensada para los títulos de afiche (clase display-type).
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
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
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {isDemoMode() && (
          <p className="eyebrow bg-accent-soft px-4 py-2 text-center !text-[0.6875rem] text-soft">
            Demo de portfolio · los datos se reinician todos los días · los emails no se envían
          </p>
        )}
        {children}
      </body>
    </html>
  );
}

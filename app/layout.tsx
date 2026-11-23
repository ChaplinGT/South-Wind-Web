import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: {
    default: "South Wind · Pagos para empresas bolivianas",
    template: "%s · South Wind",
  },
  description:
    "Portal de South Wind Global Services LLC para pagos transfronterizos de pequeñas y medianas empresas de Bolivia.",
  icons: {
    icon: brand.mark,
    apple: brand.mark,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-BO" translate="no" className="notranslate">
      <body className={`${outfit.variable} ${fraunces.variable} font-sans text-ink`}>{children}</body>
    </html>
  );
}

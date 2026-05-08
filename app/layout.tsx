import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Cinzel, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Valmir Veronez — Engenharia de Software",
  description:
    "Engenharia de software para empresas que tratam tecnologia como ativo estratégico.",
  openGraph: {
    title: "Valmir Veronez — Engenharia de Software",
    description:
      "Engenharia de software para empresas que tratam tecnologia como ativo estratégico.",
    locale: "pt_BR",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VVeronez",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} ${cinzel.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <meta name="theme-color" content="#0a0814" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}

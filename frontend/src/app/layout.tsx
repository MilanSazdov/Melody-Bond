import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RWA DAO - Sepolia Testnet",
  description: "Real World Asset DAO Governance on Sepolia Testnet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          <header className="border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
            <div className="container flex h-16 items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-wide">RWA DAO</span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 text-[10px] font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    SEPOLIA
                  </span>
                </Link>
                <nav className="hidden md:flex items-center gap-4 text-sm text-zinc-300">
                  <Link className="hover:text-white transition-colors" href="/projects">Projects</Link>
                  <Link className="hover:text-white transition-colors" href="/governance">Governance</Link>
                  <Link className="hover:text-white transition-colors" href="/portfolio">Portfolio</Link>
                  <Link className="hover:text-white transition-colors" href="/admin">Admin</Link>
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <WalletConnect />
              </div>
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
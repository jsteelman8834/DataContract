import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Missouri Legislative Tracker",
  description: "Track Missouri legislation, committees, and representatives. A civic accountability tool for the 103rd General Assembly.",
  keywords: ["Missouri", "legislature", "bills", "senate", "house", "legislation", "civic", "government"],
  authors: [{ name: "Missouri Legislative Tracker" }],
  openGraph: {
    title: "Missouri Legislative Tracker",
    description: "Track Missouri legislation, committees, and representatives.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

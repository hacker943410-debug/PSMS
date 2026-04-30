import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSMS",
  description: "Phone shop management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

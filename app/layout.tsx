import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BANG! Online",
  description: "Chơi board game BANG! trực tuyến cùng bạn bè",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

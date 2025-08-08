import React from "react";
import Sidebar from "../components/sidebar";
import "./globals.css";
//this is the root layout for the app, it wraps all pages and components
export const metadata = {
  title: "TwoPlace",
  description: "Secure video calls with loved ones.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
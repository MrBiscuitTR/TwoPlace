"use client";

import React , {useEffect, useState}from "react";
import { CallProvider } from "@/context/Callcontext"; // senin CallProvider dosyanın adı/path'ine göre düzenle
import Sidebar from "@/components/sidebar";
import IncomingCallPopup from "@/components/IncomingCallPopup"; // bu bileşenin useCall() ile çalışan versiyonu olmalı
import "./globals.css";
import { onAuthStateChanged , User} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // firebase auth check ve redirect 
  const router = useRouter();
  const pathname = usePathname();
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (checkingAuth) return; // auth durumu kontrol ediliyor, bekle

    // Korunacak route'lar listesi
    const protectedRoutes = ["/dashboard", "/call", "/friends", "/search", "/settings", "/calls", "/friends"];

    // Eğer korumalı bir route'daysak ve user yoksa login sayfasına yönlendir
    if (
      protectedRoutes.some((route) => pathname.startsWith(route)) &&
      !user
    ) {
      router.push("/login");
    }
  }, [user, checkingAuth, pathname, router]);

  // auth durumu belli olana kadar veya yönlendirme yapılana kadar loading gösterebilirsin
  if (checkingAuth) {
    return (<html lang="en">
      <body> 
        {/* CallProvider uygulama genelinde signaling / RTC yönetimini sağlar */}
        <CallProvider>
          <div className="app-layout" style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <main className="main-content" style={{ flex: 1 }}>
              <div className="flex items-center justify-center min-h-screen">
                <p>Yükleniyor...</p>
              </div>
            </main>
          </div>
        </CallProvider>
      </body>
    </html>);
  }


  return (
    <html lang="en">
      <body> 
        {/* CallProvider uygulama genelinde signaling / RTC yönetimini sağlar */}
        <CallProvider>
          <div className="app-layout" style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <main className="main-content" style={{ flex: 1 }}>
              {children}
            </main>

            {/* IncomingCallPopup artık provider'dan gelen state'i gösterir.
                Bu bileşenin props beklemeyen, useCall() kullanan bir versiyon olmalı
                (ör. provider içindeki callStatus === 'ringing' && callData varsa modal göster). */}
            <IncomingCallPopup />
          </div>
        </CallProvider>
      </body>
    </html>
  );
}

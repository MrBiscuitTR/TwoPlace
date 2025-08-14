"use client";

import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/useAuthStore";

export default function SettingsPage() {
  // get firebase user
  useAuth();
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <div>Yükleniyor...</div>;
  }
  const username = user.displayName;
  const usermail = user.email;
  
  return (
    <div>
      <h1>Ayarlar</h1>
      <p> Merhaba {username}, {usermail} e-posta adresinle giriş yapmış bulunmaktasın. </p>
      <p>Bu sayfa henüz geliştirilmedi.</p>
      <p>Aramalarda kullanacağın varsayılan tercihlerin, gizlilik ve güvenlik ayarların, aboneliklerin vb. burada bulunacak.</p>
      <p>Gelecek güncellemeler için takipte kal!</p>
    </div>
  );
}
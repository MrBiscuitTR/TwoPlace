"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, AuthError } from "firebase/auth";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    const googleProvider = new GoogleAuthProvider();

    const handleEmailLogin = async () => {
        try {
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/dashboard");
        } catch (e: unknown) {
        if (e && typeof e === "object" && "message" in e) {
            setError((e as { message: string }).message);
        } else {
            setError("Bilinmeyen bir hata oluştu.");
        }
        }
    };

    const handleGoogleLogin = async () => {
        try {
        await signInWithPopup(auth, googleProvider);
        router.push("/dashboard");
        console.log("Google ile giriş yapıldı"+ auth.currentUser?.displayName);
        } catch (e : unknown) {
        if (e && typeof e === "object" && "message" in e) {
            setError((e as { message: string }).message);
        } else {
            setError("Bilinmeyen bir hata oluştu.");
        }
        }
    };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-4">
      <h1 className="text-3xl mb-6">Giriş Yap</h1>

      <input
        type="email"
        placeholder="Email"
        className="mb-3 p-2 rounded text-black w-full max-w-sm"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Şifre"
        className="mb-3 p-2 rounded text-black w-full max-w-sm"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleEmailLogin}
        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded w-full max-w-sm mb-3"
      >
        Giriş Yap
      </button>

      <button
        onClick={handleGoogleLogin}
        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded w-full max-w-sm mb-3"
      >
        Google ile Giriş
      </button>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      <p>
        Hesabın yok mu?{" "}
        <a href="/register" className="text-blue-400 hover:underline">
          Kayıt Ol
        </a>
      </p>
    </div>
  );
}

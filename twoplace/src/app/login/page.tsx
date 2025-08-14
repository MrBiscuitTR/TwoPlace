"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, AuthError } from "firebase/auth";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { create } from "domain";
import { createUserProfileIfNotExists } from "@/lib/user";

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
      await signInWithPopup(auth, googleProvider).then((result) => {
        if (!result.user) throw new Error("User is missing in signInWithPopup result");
        createUserProfileIfNotExists(result.user).then(() => {
          console.log("User profile created or already exists.");
          router.push("/dashboard");
          console.log("Google ile giriş yapıldı" + auth.currentUser?.displayName);
        }).catch((error: unknown) => {
          console.error("Error creating user profile:", error);
        });
      });

    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e) {
        setError((e as { message: string }).message);
      } else {
        setError("Bilinmeyen bir hata oluştu.");
      }
    }
  };

  return (
    <div className="login">
      <h1>Giriş Yap</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleEmailLogin} className="btn-email">
        Giriş Yap
      </button>

      <button onClick={handleGoogleLogin} className="btn-google">
        Google ile Giriş
      </button>

      {error && <p className="error">{error}</p>}

      <p>
        Hesabın yok mu?{" "}
        <a href="/register">
          Kayıt Ol
        </a>
      </p>
    </div>
  );
}

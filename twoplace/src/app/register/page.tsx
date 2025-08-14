"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!username) {
      setError("Kullanıcı adı zorunlu");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: username });
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          username,
          email,
          friends: [],
          friendRequests: [],
        });
      }
      router.push("/dashboard");
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Bilinmeyen bir hata oluştu.");
      }
    }
  };

  return (
    <div className="register">
      <h1>Kayıt Ol</h1>

      <input
        type="text"
        placeholder="Kullanıcı Adı"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
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

      <button onClick={handleRegister} className="btn-register">
        Kayıt Ol
      </button>

      {error && <p className="error">{error}</p>}

      <p>
        Zaten hesabın var mı?{" "}
        <a href="/login">
          Giriş Yap
        </a>
      </p>
    </div>
  );
}

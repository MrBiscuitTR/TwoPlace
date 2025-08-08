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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-4">
      <h1 className="text-3xl mb-6">Kayıt Ol</h1>

      <input
        type="text"
        placeholder="Kullanıcı Adı"
        className="mb-3 p-2 rounded text-black w-full max-w-sm"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
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
        onClick={handleRegister}
        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded w-full max-w-sm mb-3"
      >
        Kayıt Ol
      </button>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      <p>
        Zaten hesabın var mı?{" "}
        <a href="/login" className="text-blue-400 hover:underline">
          Giriş Yap
        </a>
      </p>
    </div>
  );
}

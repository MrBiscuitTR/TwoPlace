"use client"

import { useEffect } from "react"
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { createUserProfileIfNotExists } from "@/lib/user"

export function AuthButton() {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    if (!result.user) throw new Error("User is missing in signInWithPopup result");
    await createUserProfileIfNotExists(result.user).then(() => {
      console.log("User profile created or already exists.")
    }).catch((error) => {
      console.error("Error creating user profile:", error)
    })
    console.log("Logged in as", result.user.displayName || result.user.email)
  }

  const handleLogout = () => {
    signOut(auth)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Logged in as", user.displayName)
      }
    })

    return unsubscribe
  }, [])

  return (
    <div className="p-4">
      <button onClick={handleLogin} className="px-4 py-2 bg-blue-500 text-white rounded">
        Giriş Yap (Google)
      </button>
      <button onClick={handleLogout} className="px-4 py-2 bg-gray-500 text-white rounded ml-2">
        Çıkış Yap
      </button>
    </div>
  )
}

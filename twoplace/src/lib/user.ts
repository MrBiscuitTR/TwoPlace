import { auth, db } from "./firebase"
import { doc, getDoc, setDoc, serverTimestamp} from "firebase/firestore"
import { Timestamp } from "firebase/firestore"
import { User } from "firebase/auth"
import type { UserProfile } from "./types"
// lib/user.ts
export async function createUserProfileIfNotExists(user: User) {
  const userRef = doc(db, "users", user.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    const profile: UserProfile = {
      uid: user.uid,
      username: user.email?.split("@")[0] || user.uid.slice(0, 6),
      email: user.email || "",
      displayName: user.displayName || "Anonymous",
      photoURL: user.photoURL || undefined,
      createdAt: serverTimestamp() as Timestamp,
    }

    await setDoc(userRef, profile)
  }
}

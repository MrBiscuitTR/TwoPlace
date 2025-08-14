import { auth, db } from "./firebase"
import { doc, getDoc, setDoc, serverTimestamp} from "firebase/firestore"
import { Timestamp } from "firebase/firestore"
import { User } from "firebase/auth"
import type { UserProfile } from "./types"
// lib/user.ts
export async function createUserProfileIfNotExists(user: User) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    const profile: UserProfile = {
      uid: user.uid,
      username: user.email?.split("@")[0] || user.uid.slice(0, 6),
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] ||"Anonymous (Possibly bugged, marked for removal)",
      photoURL: user.photoURL || undefined,
      createdAt: serverTimestamp() as Timestamp,
    };

    try {
      await setDoc(userRef, profile);
      console.log("User profile created for", user.uid);
    } catch (error) {
      console.error("Error creating user profile:", error);
    }
  } else {
    console.log("User profile already exists for", user.uid);
  }
}


// helper function to get user display name from UID
export async function getUserDisplayNameOrUserNameFromUid(uid: string | undefined): Promise<string> {
  if (!uid) {
    return "Unknown User";
  }
  
  try {
    const userDoc = doc(db, "users", uid);
    const userSnapshot = await getDoc(userDoc);

    if (userSnapshot.exists()) {
      const userData = userSnapshot.data() as { displayName?: string; username: string };
      return userData.displayName || userData.username;
    }

    return "Unknown User";
  } catch (error) {
    console.error("Error fetching user displayName/username:", error);
    return "Unknown User";
  }
}



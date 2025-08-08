import { db } from "@/lib/firebase";
import { collection, deleteDoc, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { FriendRequest } from "@/lib/types";
export async function toggleFriendRequest(
  fromUid: string,
  fromName: string,
  toUid: string,
  toName: string
) {
  const requestRef = doc(db, "friendRequests", `${fromUid}_${toUid}`);

  const docSnapshot = await getDoc(requestRef);

  if (docSnapshot.exists()) {
    // İstek varsa sil (geri çek)
    await deleteDoc(requestRef);
  } else {
    // Yeni istek oluştur
    await setDoc(requestRef, {
      fromUid,
      fromName,
      toUid,
      toName,
      status: "pending",
      sentAt: serverTimestamp(),
    });
  }
}

export async function getFriendRequestStatus(fromUid: string, toUid: string): Promise<FriendRequest | null> {
  const requestRef = doc(db, "friendRequests", `${fromUid}_${toUid}`);
  const snap = await getDoc(requestRef);

  if (snap.exists()) {
    return snap.data() as FriendRequest;
  } else {
    return null;
  }
}

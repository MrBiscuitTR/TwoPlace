//  lin/friends.ts
import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { FriendRequest, UserProfile } from "@/lib/types";

// Arkadaşlık isteği gönder / geri çek
export async function toggleFriendRequest(
  fromUid: string,
  fromName: string,
  toUid: string,
  toName: string
) {
  const requestRef = doc(db, "friendRequests", `${fromUid}_${toUid}`);
  const docSnapshot = await getDoc(requestRef);

  if (docSnapshot.exists()) {
    await deleteDoc(requestRef);
  } else {
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

// Arkadaşlık isteği reddet
export async function rejectRequest(requestId: string) {
  await deleteDoc(doc(db, "friendRequests", requestId));
}

// Arkadaşlık isteği kabul et ve iki kullanıcıya birbirini ekle
export async function acceptRequest(request: FriendRequest) {
  const { id, fromUid, toUid } = request;

  await updateDoc(doc(db, "friendRequests", id), {
    status: "accepted",
  });

  const fromUserRef = doc(db, "users", fromUid);
  const toUserRef = doc(db, "users", toUid);

  const fromUserDoc = await getDoc(fromUserRef);
  const toUserDoc = await getDoc(toUserRef);

  if (!fromUserDoc.exists() || !toUserDoc.exists()) return;

  const fromUserData = fromUserDoc.data() as UserProfile;
  const toUserData = toUserDoc.data() as UserProfile;

  // Map yapısı: uid: true
  const updatedFromFriends = {
    ...(fromUserData.friends || {}),
    [toUid]: true,
  };
  const updatedToFriends = {
    ...(toUserData.friends || {}),
    [fromUid]: true,
  };

  await updateDoc(fromUserRef, { friends: updatedFromFriends });
  await updateDoc(toUserRef, { friends: updatedToFriends });
}

// Arkadaşı çıkar (iki taraftan da)
export async function removeFriend(userUid: string, friendUid: string) {
  const userRef = doc(db, "users", userUid);
  const friendRef = doc(db, "users", friendUid);

  const userSnap = await getDoc(userRef);
  const friendSnap = await getDoc(friendRef);

  if (!userSnap.exists() || !friendSnap.exists()) return;

  const userData = userSnap.data() as UserProfile;
  const friendData = friendSnap.data() as UserProfile;

  const updatedUserFriends = { ...(userData.friends || {}) };
  const updatedFriendFriends = { ...(friendData.friends || {}) };

  delete updatedUserFriends[friendUid];
  delete updatedFriendFriends[userUid];

  await updateDoc(userRef, { friends: updatedUserFriends });
  await updateDoc(friendRef, { friends: updatedFriendFriends });

  // Arkadaşlık isteklerini de sil (varsa)
  const requestId1 = `${userUid}_${friendUid}`;
  const requestId2 = `${friendUid}_${userUid}`;

  await Promise.all([
    deleteDoc(doc(db, "friendRequests", requestId1)).catch(() => {}),
    deleteDoc(doc(db, "friendRequests", requestId2)).catch(() => {}),
  ]);
}

// Gönderilen istek durumu kontrolü
export async function getFriendRequestStatus(
  fromUid: string,
  toUid: string
): Promise<FriendRequest | null> {
  const requestRef = doc(db, "friendRequests", `${fromUid}_${toUid}`);
  const snap = await getDoc(requestRef);

  if (snap.exists()) {
    return snap.data() as FriendRequest;
  } else {
    return null;
  }
}

// Arkadaş profillerini UID map'inden çek
export async function fetchFriendProfiles(friendUIDs: string[]): Promise<UserProfile[]> {
  const profiles: UserProfile[] = [];

  for (const uid of friendUIDs) {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      profiles.push(docSnap.data() as UserProfile);
    }
  }

  return profiles;
}

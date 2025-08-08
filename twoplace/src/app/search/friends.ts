import { db } from "@/lib/firebase";
import { collection, deleteDoc, doc, getDoc, setDoc, serverTimestamp, updateDoc, getDocs } from "firebase/firestore";
import { Friend, FriendRequest } from "@/lib/types";
import { getAuth } from "firebase/auth";

export type FriendProfile = {
  userID: string;
  displayName: string;
  photoURL?: string;
};

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

export async function rejectRequest(requestId: string) {
  await deleteDoc(doc(db, "friendRequests", requestId));
}

export async function acceptRequest(request: FriendRequest) {
  const { id, fromUid, fromName, toUid, toName } = request;

  // 1. İsteği "accepted" yap
  await updateDoc(doc(db, "friendRequests", id), {
    status: "accepted",
  });

  // 2. Her iki kullanıcının friends listesine diğerini ekle
  const fromUserRef = doc(db, "users", fromUid);
  const toUserRef = doc(db, "users", toUid);

  // fromUser friends array'ine toUser ekle
  const fromUserDoc = await getDoc(fromUserRef);
  const fromUserData = fromUserDoc.data();

  const newFromFriends = [
    ...(fromUserData?.friends || []),
    { uid: toUid, displayName: toName },
  ];

  await updateDoc(fromUserRef, {
    friends: newFromFriends,
  });

  // toUser friends array'ine fromUser ekle
  const toUserDoc = await getDoc(toUserRef);
  const toUserData = toUserDoc.data();

  const newToFriends = [
    ...(toUserData?.friends || []),
    { uid: fromUid, displayName: fromName },
  ];

  await updateDoc(toUserRef, {
    friends: newToFriends,
  });
}

export async function removeFriend(userUid: string, friendUid: string) {
  const userRef = doc(db, "users", userUid);
  const friendRef = doc(db, "users", friendUid);

  const userSnap = await getDoc(userRef);
  const friendSnap = await getDoc(friendRef);

  if (!userSnap.exists() || !friendSnap.exists()) return;

  const userData = userSnap.data();
  const friendData = friendSnap.data();

  const newUserFriends = (userData?.friends || []).filter(
    (f: Friend) => f.userId !== friendUid
  );

  const newFriendFriends = (friendData?.friends || []).filter(
    (f: Friend) => f.userId !== userUid
  );

  await updateDoc(userRef, { friends: newUserFriends });
  await updateDoc(friendRef, { friends: newFriendFriends });
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


export const fetchFriendProfiles = async (): Promise<FriendProfile[]> => {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    console.error("No current user");
    return [];
  }

  const friendsRef = collection(db, "users", currentUser.uid, "friends");

  const snapshot = await getDocs(friendsRef);
  const friends: FriendProfile[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    friends.push({
      userID: data.userID,
      displayName: data.displayName,
      photoURL: data.photoURL || undefined,
    });
  });

  return friends;
};
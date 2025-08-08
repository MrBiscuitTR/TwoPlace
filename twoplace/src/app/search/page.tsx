"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  Timestamp,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import type { UserProfile, FriendRequest } from "@/lib/types";

export default function SearchPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }

      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        setUser(userDoc.data() as UserProfile);
      }

      const sentReqQuery = query(
        collection(db, "friendRequests"),
        where("fromUid", "==", firebaseUser.uid),
        where("status", "==", "pending")
      );
      const sentReqDocs = await getDocs(sentReqQuery);
      setSentRequests(
        sentReqDocs.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FriendRequest))
      );
    });

    return () => unsubscribe();
  }, []);

  const handleSearch = async () => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    const q = query(collection(db, "users"));
    const snapshot = await getDocs(q);
    const users = snapshot.docs
      .map((doc) => doc.data() as UserProfile)
      .filter((u) => {
        const term = search.toLowerCase();
        return (
          u.username.toLowerCase().includes(term) ||
          u.displayName.toLowerCase().includes(term)
        );
      })
      .filter((u) => u.uid !== user?.uid);

    setResults(users);
  };

  const sendRequest = async (toUser: UserProfile) => {
    if (!user) return;

    const newRequestId = doc(collection(db, "friendRequests")).id;

    await setDoc(doc(db, "friendRequests", newRequestId), {
      id: newRequestId,
      fromUid: user.uid,
      fromName: user.displayName,
      toUid: toUser.uid,
      toName: toUser.displayName,
      status: "pending",
      sentAt: new Date(),
    });

    setSentRequests((prev) => [
      ...prev,
      {
        id: newRequestId,
        fromUid: user.uid,
        fromName: user.displayName,
        toUid: toUser.uid,
        toName: toUser.displayName,
        status: "pending",
        sentAt: serverTimestamp() as Timestamp
      },
    ]);
  };

  const cancelRequest = async (requestId: string) => {
    await deleteDoc(doc(db, "friendRequests", requestId));
    setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  const toggleRequest = (toUser: UserProfile) => {
    const existingReq = sentRequests.find((r) => r.toUid === toUser.uid);
    if (existingReq) {
      cancelRequest(existingReq.id);
    } else {
      sendRequest(toUser);
    }
  };

  return (
    <div>
      <h1>Arkadaş Ara</h1>
      <input
        type="text"
        placeholder="Kullanıcı adı veya isim ile ara"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button onClick={handleSearch}>Ara</button>

      <ul>
        {results.map((user) => {
          const isRequested = sentRequests.some((r) => r.toUid === user.uid);

          return (
            <li key={user.uid}>
              {user.displayName} (@{user.username})
              <button
                className={`friend-button ${isRequested ? "sent" : ""}`}
                onClick={() => toggleRequest(user)}
              >
                {isRequested ? "İstek Gönderildi (Geri Çek)" : "İstek Gönder"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

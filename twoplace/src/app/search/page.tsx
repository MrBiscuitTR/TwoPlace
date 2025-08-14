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
import Image from "next/image";

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

      // Gönderilmiş bekleyen istekleri çek
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
          (u.displayName && u.displayName.toLowerCase().includes(term))
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
        fromName: user.displayName || user.username,
        toUid: toUser.uid,
        toName: toUser.displayName || toUser.username,
        status: "pending",
        sentAt: serverTimestamp() as Timestamp,
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
    <div style={{ padding: "1rem" }}>
      <h1>Arkadaş Ara</h1>
      <input
        type="text"
        placeholder="Kullanıcı adı veya isim ile ara"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "0.5rem",
          marginBottom: "1rem",
          borderRadius: 6,
          border: "1px solid #ccc",
        }}
      />
      <button
        onClick={handleSearch}
        style={{ padding: "0.5rem 1rem", marginBottom: "1rem" }}
      >
        Ara
      </button>

      {results.length === 0 ? (
        <p>Sonuç bulunamadı.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {results.map((resultUser) => {
            const isRequested = sentRequests.some((r) => r.toUid === resultUser.uid);
            // friends objesi object olduğundan Object.keys ile kontrol
            const isFriend = Object.keys(resultUser.friends || {}).some(
              (uid) => uid === user?.uid
            );

            return (
              <div
                key={resultUser.uid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  gap: 16,
                }}
              >
                {resultUser.photoURL ? (
                  <img
                    src={resultUser.photoURL}
                    alt={resultUser.displayName}
                    width={50}
                    height={50}
                    style={{ borderRadius: "50%" }}
                  />
                ) : (
                  <div
                    style={{
                      minHeight: 50,
                      minWidth: 50,
                      width: 50,
                      height: 50,
                      borderRadius: "50%",
                      backgroundColor: "#ccc",
                    }}
                  />
                )}
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontWeight: "600" }}>{resultUser.displayName}</div>
                  <div style={{ color: "#666", fontSize: "0.9rem" }}>
                    @{resultUser.username}
                  </div>
                </div>
                <button
                  onClick={() => toggleRequest(resultUser)}
                  style={{
                    padding: "0.3rem 0.7rem",
                    borderRadius: 4,
                    cursor: "pointer",
                    backgroundColor: isRequested ? "#ccc" : "#4caf50",
                    color: isRequested ? "#666" : "white",
                    border: "none",
                  }}
                  disabled={isFriend}
                >
                  {isFriend
                    ? "Zaten Arkadaşsınız"
                    : isRequested
                    ? "İstek Gönderildi (Geri Çek)"
                    : "İstek Gönder"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

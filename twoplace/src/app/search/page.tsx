"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { UserProfile, FriendRequest } from "@/lib/types";

export default function SearchPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    setCurrentUser(user?.uid || null);

    if (user) {
      const q = query(
        collection(db, "friendRequests"),
        where("fromUid", "==", user.uid),
        where("status", "==", "pending")
      );
      getDocs(q).then((snapshot) => {
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
        setRequests(reqs);
      });
    }
  }, []);

  const handleSearch = async () => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    const usersCol = collection(db, "users");
    const snapshot = await getDocs(usersCol);
    const allUsers = snapshot.docs.map(doc => doc.data() as UserProfile);

    const searchLower = search.toLowerCase();

    const filtered = allUsers.filter(user => {
      const displayName = user.displayName.toLowerCase();
      const username = user.username.toLowerCase();
      const email = (user.email ?? "").toLowerCase();
      return (
        displayName.includes(searchLower) ||
        username.includes(searchLower) ||
        email.includes(searchLower)
      ) && user.uid !== currentUser;
    });

    setResults(filtered);
  };

  const sendFriendRequest = async (toUid: string) => {
    if (!currentUser) return;

    await addDoc(collection(db, "friendRequests"), {
      fromUid: currentUser,
      toUid,
      status: "pending",
      sentAt: serverTimestamp(),
    });

    // İstek gönderilen kullanıcıyı state'e ekle
    setRequests(prev => [...prev, { id: "temp", fromUid: currentUser, toUid, status: "pending", sentAt: Timestamp.now() } as FriendRequest]);
  };

  const isRequestPending = (uid: string) => {
    return requests.some(r => r.toUid === uid && r.status === "pending");
  };

  return (
    <div className="search-page">
      <h1>Kullanıcı Ara</h1>
      <input
        type="text"
        placeholder="Kullanıcı adı ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
      />
      <button onClick={handleSearch}>Ara</button>

      <ul>
        {results.map(user => (
          <li key={user.uid}>
            {user.displayName} (@{user.username})
            {isRequestPending(user.uid) ? (
              <button disabled>İstek Gönderildi</button>
            ) : (
              <button onClick={() => sendFriendRequest(user.uid)}>İstek Gönder</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { UserProfile } from "@/lib/types";
import { fetchFriendProfiles, removeFriend } from "../search/friends";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createCall } from "@/lib/call";

export default function FriendsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const router = useRouter();

  async function handleRemoveFriend(friendUid: string) {
    if (!user) return;
    await removeFriend(user.uid, friendUid);

    // Güncel kullanıcı verisini çek
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const updatedUser = userDoc.data() as UserProfile;
      setUser(updatedUser);
      // friendProfiles içinden çıkar
      setFriendProfiles((prev) => prev.filter((f) => f.uid !== friendUid));
    }
  }

  const handleStartCall = async (friendUid: string) => {
    if (!user?.uid) return;
    const callId = await createCall(user.uid, friendUid);
    router.push(`/call/${callId}`);
    setTimeout(async () => {
        const callDoc = await getDoc(doc(db, 'calls', callId));
        if (callDoc.exists() && callDoc.data().status === 'ringing') {
            await updateDoc(doc(db, 'calls', callId), { status: 'missed' });
        }
    }, 15000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setFriendProfiles([]);
        return;
      }

      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (!userDoc.exists()) {
        setUser(null);
        setFriendProfiles([]);
        return;
      }

      const userData = userDoc.data() as UserProfile;
      setUser(userData);

      if (!userData.friends || Object.keys(userData.friends).length === 0) {
        setFriendProfiles([]);
        return;
      }

      // friends artık map<string, true>, o yüzden sadece anahtarları yolluyoruz
      const friendUIDs = Object.keys(userData.friends);
      const profiles = await fetchFriendProfiles(friendUIDs);
      setFriendProfiles(profiles);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="friends-page-container">
      <h1 className="friends-page-title">Your Friends</h1>

      {friendProfiles.length === 0 ? (
        <p className="no-friends-text">You don&apos;t have any friends yet.</p>
      ) : (
        <div className="friends-grid">
          {friendProfiles.map((friend) => (
            <div
              key={friend.uid}
              className="friend-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                border: "1px solid #ccc",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                marginBottom: "0.5rem",
              }}
            >
              {friend.photoURL ? (
                <Image
                  src={friend.photoURL}
                  alt={friend.displayName}
                  width={50}
                  height={50}
                  className="friend-photo"
                  style={{ borderRadius: "50%" }}
                />
              ) : (
                <div
                  className="friend-photo-placeholder"
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    backgroundColor: "#ccc",
                  }}
                />
              )}
              <span style={{ flexGrow: 1, fontWeight: "500" }}>
                {friend.displayName}
                
              </span>
              <button style={{
                    padding: "0.3rem 0.7rem",
                    borderRadius: 4,
                    cursor: "pointer",
                    backgroundColor: "#4caf50",
                    color: "white",
                    border: "none",
                  }} onClick={() => handleStartCall(friend.uid)}>Arama Başlat</button>
              <button
                className="remove-friend-button"
                style={{ marginLeft: "auto", backgroundColor: "#f44336", color: "white", border: "none", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer" }}
                onClick={() => handleRemoveFriend(friend.uid)}
              >
                Arkadaşlıktan Çıkar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

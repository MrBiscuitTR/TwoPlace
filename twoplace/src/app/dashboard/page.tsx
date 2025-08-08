"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { UserProfile, FriendRequest, CallRecord, Friend } from "@/lib/types";
import { acceptRequest, rejectRequest , removeFriend, fetchFriendProfiles} from "../search/friends";
import router from "next/router";
import { redirect } from "next/navigation";

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);


  //fetch friend profiles, and also edit the friends section below to show their names with @s and photos or a gray icon of no photo url.

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setFriends([]);
        setRequests([]);
        setCallHistory([]);
        redirect("/register");
        return;
      }

      // Kullanıcı profilini çek
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (!userDoc.exists()) return;

      const userData = userDoc.data() as UserProfile;
      setUser(userData);

      // Friends listesi (varsayılan boş dizi)
      setFriends(userData.friends || []);

      // Gelen arkadaş isteklerini çek (toUid == kullanıcı ve status pending)
      const reqQuery = query(
        collection(db, "friendRequests"),
        where("toUid", "==", firebaseUser.uid),
        where("status", "==", "pending")
      );
      const reqDocs = await getDocs(reqQuery);
      const friendReqs = reqDocs.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as FriendRequest)
      );
      setRequests(friendReqs);

      // Çağrı geçmişi (callerUid == kullanıcı)
      const callQuery = query(
        collection(db, "calls"),
        where("callerUid", "==", firebaseUser.uid)
      );
      const callDocs = await getDocs(callQuery);
      const calls = callDocs.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as CallRecord)
      );
      setCallHistory(calls);
    });

    return () => unsubscribe();
  }, []);

  async function handleAcceptRequest(request: FriendRequest) {
    if (!user) return;
    await acceptRequest(request);

    // İstek onaylandıktan sonra güncel kullanıcıyı ve arkadaş listesini çek
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const updatedUser = userDoc.data() as UserProfile;
      setUser(updatedUser);
      setFriends(updatedUser.friends || []);
    }

    // İstek listesinden kaldır
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
  }

  async function handleRejectRequest(requestId: string) {
    await rejectRequest(requestId);
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  async function handleRemoveFriend(friendUid: string) {
    if (!user) return;
    await removeFriend(user.uid, friendUid);

    // Güncel arkadaş listesini tekrar çek
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const updatedUser = userDoc.data() as UserProfile;
      setUser(updatedUser);
      setFriends(updatedUser.friends || []);
    }
  }

  return (
    <div className="dashboard-container" style={{ padding: "1rem" }}>
      <h1>Hoşgeldin, {user?.displayName || "..."}</h1>

      <section style={{ marginTop: "2rem" }}>
        <h2>Arkadaşlar</h2>
        {friends.length === 0 ? (
          <p>Henüz arkadaşınız yok.</p>
        ) : (
          <ul>
            {friendProfiles.map((friend) => (
              <li key={friend.uid}>
                {friend.displayName}{" "}
                <button
                  style={{ marginLeft: "1rem" }}
                  onClick={() => handleRemoveFriend(friend.uid)}
                >
                  Arkadaşlıktan Çıkar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Gelen Arkadaş İstekleri</h2>
        {requests.length === 0 && <p>Bekleyen istek yok.</p>}
        <ul>
          {requests.map((req) => (
            <li key={req.id} style={{ marginBottom: "0.5rem" }}>
              <span>
                {req.fromName} (@{req.fromUid})
              </span>
              <button
                onClick={() => handleAcceptRequest(req)}
                style={{ marginLeft: "1rem", marginRight: "0.5rem" }}
              >
                Onayla
              </button>
              <button onClick={() => handleRejectRequest(req.id)}>Reddet</button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Çağrı Geçmişi</h2>
        {callHistory.length === 0 && <p>Henüz çağrı geçmişiniz yok.</p>}
        <ul>
          {callHistory.map((call) => (
            <li key={call.id}>
              <div>
                <strong>Aranan:</strong> {call.receiverUid}
                <br />
                <small>
                  Başlangıç: {call.startedAt.toDate().toLocaleString()}
                </small>
                <br />
                {call.endedAt && (
                  <small>Bitiş: {call.endedAt.toDate().toLocaleString()}</small>
                )}
                {call.wasAutoEnded && <div>Otomatik Sonlandı</div>}
                {call.sleepTimerMinutes && (
                  <div>Uyku Zamanlayıcı: {call.sleepTimerMinutes} dk</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

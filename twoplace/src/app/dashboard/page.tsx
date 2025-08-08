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
import type { UserProfile, FriendRequest, CallRecord } from "@/lib/types";
import { rejectRequest, acceptRequest } from "../search/friends";

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<FriendRequest[]>([]); // Gelen istekler
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]); // Gönderilen istekler

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // İstersen yönlendirme yapılabilir
        // redirect("/register");
        setUser(null);
        return;
      }

      // Kullanıcı profilini çek
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        setUser(userDoc.data() as UserProfile);
      }

      // Arkadaşları çek (status accepted, fromUid veya toUid user olabilir, ikisini de kontrol etmek gerekebilir)
      const acceptedQuery = query(
        collection(db, "friendRequests"),
        where("status", "==", "accepted"),
        where("fromUid", "==", firebaseUser.uid)
      );
      const acceptedDocs = await getDocs(acceptedQuery);
      const friendUidsFrom = acceptedDocs.docs.map((doc) => doc.data().toUid);

      // Ayrıca toUid == user olabilir (ters istekler için)
      const acceptedQueryTo = query(
        collection(db, "friendRequests"),
        where("status", "==", "accepted"),
        where("toUid", "==", firebaseUser.uid)
      );
      const acceptedDocsTo = await getDocs(acceptedQueryTo);
      const friendUidsTo = acceptedDocsTo.docs.map((doc) => doc.data().fromUid);

      const friendUids = Array.from(new Set([...friendUidsFrom, ...friendUidsTo]));

      const profiles: UserProfile[] = [];
      for (const uid of friendUids) {
        const fDoc = await getDoc(doc(db, "users", uid));
        if (fDoc.exists()) {
          profiles.push(fDoc.data() as UserProfile);
        }
      }
      setFriends(profiles);

      // Çağrı geçmişi çek (caller veya receiver user olabilir, o da yapılabilir)
      const callQuery = query(
        collection(db, "calls"),
        where("callerUid", "==", firebaseUser.uid)
      );
      const callDocs = await getDocs(callQuery);
      const calls = callDocs.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as CallRecord)
      );
      setCallHistory(calls);

      // Gelen bekleyen istekler (status pending, toUid current user)
      const reqQuery = query(
        collection(db, "friendRequests"),
        where("toUid", "==", firebaseUser.uid),
        where("status", "==", "pending")
      );
      const reqDocs = await getDocs(reqQuery);
      const reqs = reqDocs.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as FriendRequest)
      );
      setRequests(reqs);

      // Gönderilen bekleyen istekler (status pending, fromUid current user)
      const sentReqQuery = query(
        collection(db, "friendRequests"),
        where("fromUid", "==", firebaseUser.uid),
        where("status", "==", "pending")
      );
      const sentReqDocs = await getDocs(sentReqQuery);
      const sentReqs = sentReqDocs.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as FriendRequest)
      );
      setSentRequests(sentReqs);
    });

    return () => unsubscribe();
  }, []);

  // Arama filtresi
  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleCancelRequest = async (requestId: string) => {
    await deleteDoc(doc(db, "friendRequests", requestId));
    setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  return (
    <div className="dashboard-page">
      <h1>Hoşgeldin, {user?.displayName}</h1>

      <div className="friend-search">
        <input
          type="text"
          placeholder="Arkadaş ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="friend-list">
        <h2>Arkadaşlar</h2>
        <ul>
          {filteredFriends.map((friend) => (
            <li key={friend.uid} className="friend-item">
              {friend.displayName} (@{friend.username})
              {/* Buraya Call butonu veya diğer aksiyonlar eklenebilir */}
            </li>
          ))}
        </ul>
      </section>

      <section className="sent-friend-requests">
        <h2>Gönderilen Arkadaşlık İstekleri</h2>
        <ul>
          {sentRequests.map((req) => (
            <li key={req.id} className="sent-request-item">
              <span>To: {req.toName} (@{req.toUid})</span>
              <button onClick={() => handleCancelRequest(req.id)}>
                İsteği Geri Çek
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="friend-requests">
        <h2>Gelen Arkadaşlık İstekleri</h2>
        <ul>
          {requests.map((req) => (
            <li key={req.id} className="request-item">
              <span>From: {req.fromName} (@{req.fromUid})</span>
              <div className="request-actions">
                {/* Accept / Reject butonlarını buraya ekleyebilirsin */}
                <button onClick={() => acceptRequest(req)}>Onayla</button>
                <button onClick={() => rejectRequest(req.id)}>Reddet</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="past-calls">
        <h2>Çağrı Geçmişi</h2>
        <ul>
          {callHistory.map((call) => (
            <li key={call.id} className="call-item">
              <div>
                <strong>To:</strong> {call.receiverUid}
                <br />
                <small>
                  Başlangıç: {call.startedAt.toDate().toLocaleString()}
                </small>
                <br />
                {call.endedAt && (
                  <small>Bitiş: {call.endedAt.toDate().toLocaleString()}</small>
                )}
                {call.wasAutoEnded && <div className="auto-ended">Otomatik Sonlandı</div>}
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

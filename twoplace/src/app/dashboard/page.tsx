"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { UserProfile, FriendRequest, CallRecord } from "@/lib/types";
import { createUserProfileIfNotExists } from "@/lib/user";

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        return;
      }

      // Eğer Firestore'da kullanıcı profili yoksa otomatik oluştur
      await createUserProfileIfNotExists(firebaseUser);

      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        setUser(userDoc.data() as UserProfile);
      } else {
        // Çok nadir durumda yine register yönlendirmesi olabilir ama normalde buraya gelmez
        router.push("/register");
        return;
      }

      // Arkadaşları çek
      const friendQuery = query(
        collection(db, "friendRequests"),
        where("status", "==", "accepted"),
        where("fromUid", "==", firebaseUser.uid)
      );
      const friendDocs = await getDocs(friendQuery);

      const friendUids = friendDocs.docs.map((doc) => doc.data().toUid);
      const profiles: UserProfile[] = [];

      for (const uid of friendUids) {
        const fDoc = await getDoc(doc(db, "users", uid));
        if (fDoc.exists()) {
          profiles.push(fDoc.data() as UserProfile);
        }
      }
      setFriends(profiles);

      // Çağrı geçmişi çek
      const callQuery = query(
        collection(db, "calls"),
        where("callerUid", "==", firebaseUser.uid)
      );
      const callDocs = await getDocs(callQuery);
      const calls = callDocs.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as CallRecord)
      );
      setCallHistory(calls);

      // Arkadaşlık isteklerini çek
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

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return <div className="loading">Yükleniyor...</div>;
  }

  if (!user) {
    return <div>Kullanıcı bulunamadı.</div>;
  }

  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard-page">
      <h1>Hoşgeldin, {user.displayName}</h1>

      <div className="friend-search">
        <input
          type="text"
          placeholder="Arkadaşlarda ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-search"
        />
      </div>

      <section className="friend-list">
        <h2>Arkadaşlar</h2>
        <ul>
          {filteredFriends.map((friend) => (
            <li key={friend.uid} className="friend-item">
              {friend.displayName} (@{friend.username})
              <button className="call-button">Ara</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="past-calls">
        <h2>Geçmiş Çağrılar</h2>
        <ul>
          {callHistory.map((call) => (
            <li key={call.id} className="call-item">
              <div>
                <strong>Aranan:</strong> {call.receiverUid}<br />
                <small>Başlama: {call.startedAt.toDate().toLocaleString()}</small><br />
                {call.endedAt && (
                  <small>Bitiş: {call.endedAt.toDate().toLocaleString()}</small>
                )}
                {call.wasAutoEnded && <div className="auto-ended">Otomatik Sonlandı</div>}
                {call.sleepTimerMinutes && (
                  <div>Uyku Zamanlayıcı: {call.sleepTimerMinutes} dakika</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="friend-requests">
        <h2>Arkadaşlık İstekleri</h2>
        <ul>
          {requests.map((req) => (
            <li key={req.id} className="request-item">
              <span>Gönderen: {req.fromUid}</span>
              <div className="request-actions">
                <button className="accept-button">Kabul Et</button>
                <button className="decline-button">Reddet</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

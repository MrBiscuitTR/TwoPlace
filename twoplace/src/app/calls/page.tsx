"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  getDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { formatDistanceToNowStrict } from "date-fns";

// icons
import CallIcon from '@mui/icons-material/Call';
import CallEndIcon from '@mui/icons-material/CallEnd';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallMissedIcon from '@mui/icons-material/CallMissed';
import CallMissedOutgoingIcon from '@mui/icons-material/CallMissedOutgoing';
import CallReceivedIcon from '@mui/icons-material/CallReceived';

interface CallData {
  id: string;
  callerUid: string;
  calleeUid: string;
  bytesSent?: number;
  bytesReceived?: number;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
}

interface UserProfile {
  username: string;
  displayName: string;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userUid, setUserUid] = useState<string | null>(null);

  // callId => partner profile (callee or caller olan diğer kişi)
  const [callPartners, setCallPartners] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setUserUid(user.uid);

      const callsRef = collection(db, "calls");
      if (!callsRef) return;
      const q = query(
        callsRef,
        where("participants", "array-contains", user.uid),
        orderBy("startedAt", "desc")
      );

      const unsub = onSnapshot(q, async (snap) => {
        const callList: CallData[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as Partial<CallData>;
          return {
            id: docSnap.id,
            callerUid: data.callerUid ?? "",
            calleeUid: data.calleeUid ?? "",
            bytesSent: data.bytesSent,
            bytesReceived: data.bytesReceived,
            startedAt: data.startedAt,
            endedAt: data.endedAt,
          };
        });

        setCalls(callList);
        setLoading(false);

        // Her çağrının partnerini (karşı taraf user) çek
        const partnersToFetch = callList
          .map((call) => {
            // Diğer taraf kim?
            return call.callerUid === user.uid ? call.calleeUid : call.callerUid;
          })
          .filter((uid) => uid); // boş uid filtrele

        // Unik partner uid'leri
        const uniquePartnerUids = Array.from(new Set(partnersToFetch));

        // Partner profillerini çek (paralel)
        const profiles = await Promise.all(
          uniquePartnerUids.map(async (partnerUid) => {
            const docSnap = await getDoc(doc(db, "users", partnerUid));
            if (!docSnap.exists()) return null;
            const data = docSnap.data() as UserProfile;
            return { uid: partnerUid, profile: data };
          })
        );

        // Partner profillerini objeye çevir
        const partnerMap: Record<string, UserProfile> = {};
        profiles.forEach((p) => {
          if (p) partnerMap[p.uid] = p.profile;
        });

        setCallPartners(partnerMap);
      });

      return () => unsub();
    });

    return () => unsubAuth();
  }, []);

  if (!userUid) {
    return <div>Giriş yapmanız gerekiyor.</div>;
  }

  if (loading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Çağrı Geçmişi</h1>
      <table
        border={1}
        cellPadding={8}
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th>Yön</th>
            <th>Karşı Taraf</th>
            <th>Süre</th>
            <th>Toplam Veri (MB)</th>
            <th>Başlangıç</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => {
            const isOutgoing = call.callerUid === userUid;
            const partnerUid = isOutgoing ? call.calleeUid : call.callerUid;
            const partner = callPartners[partnerUid] ?? {
              username: partnerUid,
              displayName: "Bilinmeyen",
            };

            const totalBytes = (call.bytesSent || 0) + (call.bytesReceived || 0);
            const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

            let duration = "-";
            if (call.startedAt?.toDate && call.endedAt?.toDate) {
              const diffMs =
                call.endedAt.toDate().getTime() - call.startedAt.toDate().getTime();
              const seconds = Math.floor(diffMs / 1000);
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              duration = `${mins}:${secs.toString().padStart(2, "0")}`;
            }

            return (
              <tr key={call.id}>
                <td>{isOutgoing ? "Giden" : "Karşıdan Gelen"}</td>
                <td>
                  {partner.displayName} ({partner.username})
                </td>
                <td>{duration}</td>
                <td>{totalMB}</td>
                <td>
                  {call.startedAt?.toDate
                    ? formatDistanceToNowStrict(call.startedAt.toDate(), {
                        addSuffix: true,
                      })
                    : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

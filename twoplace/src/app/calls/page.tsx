// app/calls/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { formatDistanceToNowStrict } from "date-fns";

interface CallData {
  id: string;
  callerUid: string;
  calleeUid: string;
  bytesSent?: number;
  bytesReceived?: number;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userUid, setUserUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setUserUid(user.uid);

      const callsRef = collection(db, "calls");
      const q = query(
        callsRef,
        where("participants", "array-contains", user.uid),
        orderBy("startedAt", "desc")
      );

      const unsub = onSnapshot(q, (snap) => {
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
      <table border={1} cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Yön</th>
            <th>Süre</th>
            <th>Toplam Veri (MB)</th>
            <th>Başlangıç</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => {
            const isOutgoing = call.callerUid === userUid;
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
                <td>{duration}</td>
                <td>{totalMB}</td>
                <td>
                  {call.startedAt?.toDate
                    ? formatDistanceToNowStrict(call.startedAt.toDate(), { addSuffix: true })
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

// src/app/calls/page.tsx
'use client';
// bu çalışmıyor gibi düzelt
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { useAuthStore } from "@/store/useAuthStore";

type CallLog = {
  id: string;
  from: string;
  to: string;
  startTime: number;
  endTime: number;
  bytesSent: number;
  bytesReceived: number;
  displayName: string;
};

export default function CallsPage() {
  const { user } = useAuthStore();
  const [calls, setCalls] = useState<CallLog[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchCalls = async () => {
      const callsRef = collection(db, "calls");
      const q = query(
        callsRef,
        where("participants", "array-contains", user.uid),
        orderBy("startTime", "desc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          from: d.from,
          to: d.to,
          startTime: d.startTime,
          endTime: d.endTime,
          bytesSent: d.bytesSent,
          bytesReceived: d.bytesReceived,
          displayName: user.uid === d.from ? d.toDisplayName : d.fromDisplayName
        };
      });
      setCalls(data);
    };

    fetchCalls();
  }, [user]);
  

  const formatBytes = (bytes: number) => (bytes / 1_000_000).toFixed(2) + " MB";
  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString();
  const formatDuration = (start: number, end: number) =>
    ((end - start) / 1000 / 60).toFixed(1) + " min";

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Call History</h1>
      <div className="space-y-4">
    {calls && calls.length > 0 ? calls.map(call => (
      <div
        key={call.id}
        className="border p-4 rounded shadow bg-white text-black"
      >
        <p><strong>With:</strong> {call.displayName}</p>
        <p><strong>Start:</strong> {formatTime(call.startTime)}</p>
        <p><strong>End:</strong> {formatTime(call.endTime)}</p>
        <p><strong>Duration:</strong> {formatDuration(call.startTime, call.endTime)}</p>
        <p><strong>Data Used:</strong> {formatBytes(call.bytesSent + call.bytesReceived)}</p>
      </div>
    )) : <p>No call records found.</p>}
      </div>
    </div>
  );
}

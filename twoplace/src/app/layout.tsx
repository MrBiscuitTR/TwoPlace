"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import CallIncomingModal from "@/components/CallIncomingModal";
import Sidebar from "@/components/sidebar";
import { CallProvider } from "../context/Callcontext";
import MiniCallWidget from "@/components/MiniCallWidget";
import "@/app/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [userUid, setUserUid] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<null | {
    id: string;
    callerUid: string;
    calleeUid: string;
  }>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUserUid(user ? user.uid : null);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!userUid) {
      setIncomingCall(null);
      return;
    }

    const q = query(
      collection(db, "calls"),
      where("calleeUid", "==", userUid),
      where("accepted", "==", false),
      where("endedAt", "==", null)
    );

    const unsubscribeCall = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0];
        const callData = callDoc.data();

        // otomatik sonlandırma
        setIncomingCall({
          id: callDoc.id,
          callerUid: callData.callerUid,
          calleeUid: callData.calleeUid,
        });

        setTimeout(() => {
          updateDoc(doc(db, "calls", callDoc.id), {
            endedAt: serverTimestamp(),
            wasAutoEnded: true,
            accepted: false,
          });
          setIncomingCall(null);
        }, 15000);
      } else {
        setIncomingCall(null);
      }
    });

    return () => unsubscribeCall();
  }, [userUid]);

  const handleRejectCall = async () => {
    if (!incomingCall) return;
    await updateDoc(doc(db, "calls", incomingCall.id), {
      endedAt: serverTimestamp(),
      wasAutoEnded: false,
      accepted: false,
    });
    setIncomingCall(null);
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    window.location.href = `/call/${incomingCall.id}`;
  };

  return (
    <html lang="en">
      <body>
        <CallProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">{children}</main>
              {incomingCall && (
                <CallIncomingModal
                  callerUid={incomingCall.callerUid}
                  onAccept={handleAcceptCall}
                  onReject={handleRejectCall}
                />
              )}
          </div>
          <MiniCallWidget />
        </CallProvider>
      </body>
    </html>
  );
}

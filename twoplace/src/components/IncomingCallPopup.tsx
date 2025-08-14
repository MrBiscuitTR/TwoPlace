// src/components/IncomingCallPopup.tsx
"use client";
import React from "react";
import { useCall } from "@/context/Callcontext";
import { getUserDisplayNameOrUserNameFromUid } from "@/lib/user";
export default function IncomingCallPopup() {
  const { callStatus, callData, acceptCall, rejectCall, user } = useCall();

  if (callStatus !== "ringing" || !callData) return null;
  // sadece callee için göster
  if (user?.uid !== callData.calleeUid) return null;

  // caller displayName'ı al
  const name = getUserDisplayNameOrUserNameFromUid(callData.callerUid);

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        <h3>{name} seni arıyor</h3>
        <div className="incoming-call-buttons" style={{ display: "flex", gap: 8 }}>
          <button className="accept-button" onClick={() => acceptCall(callData.id)}>Kabul Et</button>
          <button className="reject-button" onClick={() => rejectCall(callData.id)}>Reddet</button>
        </div>
      </div>
    </div>
  );
}

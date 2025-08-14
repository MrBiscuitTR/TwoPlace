// src/components/IncomingCallPopup.tsx
import React, {useState, useEffect} from "react";
import { useCall } from "@/context/Callcontext";
import { getUserDisplayNameOrUserNameFromUid } from "@/lib/user";
export default function IncomingCallPopup() {
  const { callStatus, callData, acceptCall, rejectCall, user } = useCall();
  const [callerName, setCallerName] = useState<string>("");

  // caller displayName'ı al
  useEffect(() => {
    if (callData?.callerUid) {
      getUserDisplayNameOrUserNameFromUid(callData.callerUid)
        .then(setCallerName)
        .catch(() => setCallerName("Unknown User"));
    }
  }, [callData?.callerUid]);

  if (callStatus !== "ringing" || !callData) return null;
  // sadece callee için göster
  if (user?.uid !== callData.calleeUid) return null;

  

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        <h3>{callerName} seni arıyor</h3>
        <div className="incoming-call-buttons" style={{ display: "flex", gap: 8 }}>
          <button className="accept-button" onClick={() => acceptCall(callData.id)}>Kabul Et</button>
          <button className="reject-button" onClick={() => rejectCall(callData.id)}>Reddet</button>
        </div>
      </div>
    </div>
  );
}

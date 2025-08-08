"use client";

import React, { useEffect, useRef } from "react";
import { useCall } from "@/context/Callcontext";

export default function CallPage() {
  const {
    callStatus,
    callData,
    acceptCall,
    rejectCall,
    endCall,
    localStream,
    remoteStream,
    videoEnabled,
    audioEnabled,
    setVideoEnabled,
    setAudioEnabled,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!callData) return <div>Çağrı bilgisi bulunamadı</div>;

  if (callStatus === "ringing" && callData.calleeUid === callData.callerUid) {
    // Mantıksız ama güvenlik için
    return <div>Arama geçersiz.</div>;
  }

  return (
    <div>
      {callStatus === "ringing" && callData.calleeUid === callData.calleeUid && (
        <div>
          <h2>Çağrı Geliyor</h2>
          <p>Birisi sizi arıyor.</p>
          <button onClick={acceptCall}>Kabul Et</button>
          <button onClick={rejectCall}>Reddet</button>
        </div>
      )}

      {callStatus === "accepted" && (
        <div>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: "80vw", height: "45vw", backgroundColor: "black" }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "20vw",
              height: "15vw",
              position: "absolute",
              bottom: 10,
              right: 10,
              borderRadius: 8,
              border: "2px solid #0f0",
            }}
          />

          <button onClick={endCall} style={{ backgroundColor: "red", color: "white" }}>
            Aramayı Bitir
          </button>
          <button onClick={() => setVideoEnabled(!videoEnabled)}>
            {videoEnabled ? "Video Kapat" : "Video Aç"}
          </button>
          <button onClick={() => setAudioEnabled(!audioEnabled)}>
            {audioEnabled ? "Ses Kapat" : "Ses Aç"}
          </button>
        </div>
      )}

      {callStatus === "ended" && (
        <div>
          <h2>Çağrı Sonlandırıldı</h2>
          <button onClick={() => window.location.href = "/dashboard"}>
            Geri Dön
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCall } from "@/context/Callcontext"; // provider'ın hook'u
import LightFrame from "@/components/lightFrame";

/**
 * Bu sayfa *UI* tarafını gösterir.
 * Sinyalizasyon / offer/answer / ice candidate işlemleri CallProvider içinde yapılmalı.
 *
 * ÖNEMLİ: Dashboard veya arama başlatan yerlerde
 *    const { startCall } = useCall();
 *    startCall(friendUid);
 * şeklinde çağırmalısın. Eğer hala createCall() (lib/call) ile sadece doküman oluşturuyorsan
 * caller offer üretmeyecek ve callee "Offer bulunamadı" hatası alır.
 */

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = Array.isArray(params.id) ? params.id[0] : params.id;

  const {
    user,
    callData,
    callStatus,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    setVideoEnabled,
    setAudioEnabled,
    liveBytesSent,
    liveBytesReceived,
  } = useCall();

  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream ?? null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream ?? null;
    }
  }, [remoteStream]);

  // If provider's callData is different from URL id, show message
  useEffect(() => {
    if (!callData) {
      // callData yoksa muhtemelen provider üzerinden startCall yapılmadı (dashboard değiştirilmeli)
      // veya kullanıcı doğrudan /call/{id} açtı. Burada sadece bilgilendiriyoruz.
      return;
    }
  }, [callData]);

  // on mount: if callId mismatch, we don't auto-create call.
  // Caller SHOULD have used provider.startCall before redirecting to this page.
  // If callee opened the page (from incoming modal) provider already set callData via snapshot listener.
  useEffect(() => {
    // If user navigates away (close tab), ensure call is ended
    const handler = async () => {
      // Do not auto-end if call already ended
      if (callData && !callData.endedAt) {
        try {
          await endCall(callData.id);
        } catch (e) {
          console.warn("endCall on unload failed", e);
        }
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [callData, endCall]);

  // Accept handler (only callee should click)
  const handleAccept = async () => {
    if (!callData) return;
    await acceptCall(callData.id);
  };

  const handleReject = async () => {
    if (!callData) return;
    await rejectCall(callData.id);
    router.push("/dashboard");
  };

  const handleEnd = async () => {
    if (!callData) return;
    await endCall(callData.id);
    router.push("/dashboard");
  };

  // toggle local media via provider helpers
  const toggleVideo = () => {
    setVideoOn((v) => {
      const nv = !v;
      setVideoEnabled(nv);
      return nv;
    });
  };
  const toggleAudio = () => {
    setAudioOn((a) => {
      const na = !a;
      setAudioEnabled(na);
      return na;
    });
  };

  // UI
  if (!callData) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Çağrı bilgisi bulunamadı</h2>
        <p>
          Bu çağrıya ait veriler henüz yüklenmedi veya bu sayfaya doğrudan erişildi. Normal
          akış için arkadaş listesinden arama başlatırken provider&apos;ın <code>startCall</code> fonksiyonunu
          kullan (dashboard&apos;daki butonlar).
        </p>
        <button onClick={() => router.push("/dashboard")}>Geri Dön</button>
      </div>
    );
  }

  // Show ringing modal only to callee
  const amICallee = user?.uid === callData.calleeUid;
  const amICaller = user?.uid === callData.callerUid;

  return (
    <div className="call-container" style={{ padding: 20 }}>
      {callStatus === "ringing" && amICallee && (
        <div style={{ textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
          <h2>Çağrı Geliyor</h2>
          <p>{callData.callerUid} tarafından çağrılıyorsunuz</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
            <button onClick={handleAccept} style={{ backgroundColor: "#4caf50", color: "white", padding: "8px 12px" }}>
              Kabul Et
            </button>
            <button onClick={handleReject} style={{ backgroundColor: "#f44336", color: "white", padding: "8px 12px" }}>
              Reddet
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <small>15s sonra otomatik reddedilebilir (provider / modal ayarıyla değişir)</small>
          </div>
        </div>
      )}

      {callStatus === "ringing" && amICaller && (
        <div style={{ textAlign: "center" }}>
          <h2>Aranıyor...</h2>
          <p>Karşı taraf kabul edene kadar bekleyin</p>
          <div style={{ marginTop: 12 }}>
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "320px", height: "180px", backgroundColor: "#222", borderRadius: 8 }} />
          </div>
        </div>
      )}

      {callStatus === "accepted" && (
        <LightFrame color="#00ff99" thickness={6} brightness={0.7}>
          <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" }}>
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "60%", borderRadius: 8, backgroundColor: "#000" }} />
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "30%", borderRadius: 8, backgroundColor: "#222" }} />
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={toggleVideo}>{videoOn ? "Video Kapat" : "Video Aç"}</button>
            <button onClick={toggleAudio}>{audioOn ? "Ses Kapat" : "Ses Aç"}</button>

            <div style={{ marginLeft: 8 }}>
              <strong>Live data:</strong>
              <div style={{ fontSize: 13 }}>
                bytesSent: {liveBytesSent} — bytesReceived: {liveBytesReceived}
              </div>
            </div>

            <button onClick={handleEnd} style={{ marginLeft: 12, backgroundColor: "red", color: "white", padding: "8px 12px" }}>
              Aramayı Bitir
            </button>
          </div>
        </LightFrame>
      )}

      {callStatus === "ended" && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <h2>Çağrı Sonlandırıldı</h2>
          <button onClick={() => router.push("/dashboard")}>Geri Dön</button>
        </div>
      )}
    </div>
  );
}

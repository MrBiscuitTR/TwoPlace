"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCall } from "@/context/Callcontext";
import LightFrame from "@/components/lightFrame";

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

  // Bu iki değeri ref ile tutacağız ki endCall’da güncel halini alabilelim
  const liveBytesSentRef = useRef(liveBytesSent);
  const liveBytesReceivedRef = useRef(liveBytesReceived);

  useEffect(() => { liveBytesSentRef.current = liveBytesSent; }, [liveBytesSent]);
  useEffect(() => { liveBytesReceivedRef.current = liveBytesReceived; }, [liveBytesReceived]);

  // Video / Audio toggle
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);

  // Glow light toggle
  const [glowOn, setGlowOn] = useState(false);

  // Resolution & FPS
  const [resolution, setResolution] = useState("720p");
  const [fps, setFps] = useState(30);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Timer state
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [targetDate, setTargetDate] = useState("");

  // Çağrı süresi (saniye)
  const [callDuration, setCallDuration] = useState(0);

  // Attach streams
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

  // Call duration timer
  useEffect(() => {
    if (!callData?.startedAt) return;
    const startTime =
      typeof callData.startedAt?.toDate === "function"
        ? callData.startedAt.toDate()
        : callData.startedAt;

    const interval = setInterval(() => {
      const startTimestamp =
        startTime instanceof Date
          ? startTime.getTime()
          : typeof startTime === "object" && typeof (startTime as { toDate?: () => Date }).toDate === "function"
          ? (startTime as { toDate: () => Date }).toDate().getTime()
          : 0;
      setCallDuration(Math.floor((Date.now() - startTimestamp) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callData]);

  // Timer countdown
  useEffect(() => {
    if (!timerEnabled || timerSeconds <= 0) return;

    const timerId = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          clearInterval(timerId);
          endCall(callData?.id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [timerEnabled, timerSeconds, callData, endCall]);

  // Target date değişince timerSeconds güncelle
  useEffect(() => {
    if (!timerEnabled || !targetDate) return;
    const target = new Date(targetDate).getTime();
    const now = Date.now();
    if (target > now) {
      setTimerSeconds(Math.floor((target - now) / 1000));
    }
  }, [targetDate, timerEnabled]);

  // Bytes → MB dönüşümü
  const bytesToMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

  // Toplam veri ve dakika/saat başı MB hesapla
  const totalMB = (liveBytesSent + liveBytesReceived) / (1024 * 1024);
  const mbPerMin = callDuration > 0 ? totalMB / (callDuration / 60) : 0;
  const mbPerHour = mbPerMin * 60;

  // Çözünürlük ve fps seçenekleri
  const resolutionOptions = [
    
    { label: "480p", width: 640, height: 480 },
    { label: "720p", width: 1280, height: 720 },
    { label: "1080p", width: 1920, height: 1080 },
  ];
  const fpsOptions = [15, 30, 60];
  const colorDepth = 24; // bit

  const calculateEstimatedMBPerSecond = () => {
    const res = resolutionOptions.find((r) => r.label === resolution) ?? resolutionOptions[1];
    const bps = res.width * res.height * fps * colorDepth;
    const bytesPerSecond = bps / 8;
    return bytesPerSecond / (1024 * 1024);
  };

  const estimatedMBPerSecond = calculateEstimatedMBPerSecond();
  const estimatedMBPerMinute = estimatedMBPerSecond * 60;
  const estimatedMBPerHour = estimatedMBPerMinute * 60;

  // Video / Audio toggle handlers
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

  // Timer manual increment
  const incrementTimer = (sec: number) => {
    setTimerSeconds((s) => Math.max(0, s + sec));
  };

  // Accept, Reject, End handlers
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
    await endCall(callData.id, liveBytesSentRef.current, liveBytesReceivedRef.current);
    router.push("/dashboard");
  };

  if (!callData) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Çağrı bilgisi bulunamadı</h2>
        <p>
          Bu çağrıya ait veriler henüz yüklenmedi veya bu sayfaya doğrudan erişildi. Normal akış için arkadaş listesinden arama başlatırken provider&apos;ın <code>startCall</code> fonksiyonunu kullan (dashboard&apos;daki butonlar).
        </p>
        <button onClick={() => router.push("/dashboard")}>Geri Dön</button>
      </div>
    );
  }

  const amICallee = user?.uid === callData.calleeUid;
  const amICaller = user?.uid === callData.callerUid;

  return (
    <>
      {/* Glow toggle button */}
      <button
        onClick={() => setGlowOn((on) => !on)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          backgroundColor: glowOn ? "#ffec3d" : "#555",
          boxShadow: glowOn ? "0 0 12px 4px #ffec3d" : "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
        }}
        aria-label="Toggle Glow Light"
        title="Gece Işığı Aç/Kapat"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill={glowOn ? "#333" : "#fff"}
          viewBox="0 0 24 24"
          width="20"
          height="20"
        >
          <path d="M9 21h6v-1H9v1zm3-19a5 5 0 00-5 5c0 1.5.8 2.8 2 3.6V15h6v-4.4a4.98 4.98 0 002-3.6 5 5 0 00-5-5z" />
        </svg>
      </button>

      <div className={`call-container ${glowOn ? "glow-frame" : ""}`} style={{ padding: 20 }}>
        {/* Çağrı Durumları */}
        {callStatus === "ringing" && amICallee && (
          <div style={{ textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <h2>Çağrı Geliyor</h2>
            <p>{callData.callerUid} tarafından çağrılıyorsunuz</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
              <button
                onClick={handleAccept}
                style={{ backgroundColor: "#4caf50", color: "white", padding: "8px 12px" }}
              >
                Kabul Et
              </button>
              <button
                onClick={handleReject}
                style={{ backgroundColor: "#f44336", color: "white", padding: "8px 12px" }}
              >
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
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: "320px", height: "180px", backgroundColor: "#222", borderRadius: 8 }}
              />
            </div>
          </div>
        )}

        {callStatus === "accepted" && (
          <LightFrame color="#00ff99" thickness={6} brightness={0.7}>
            <div
              style={{
                display: "flex",
                gap: 20,
                justifyContent: "center",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: "60%", borderRadius: 8, backgroundColor: "#000" }}
              />
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: "30%", borderRadius: 8, backgroundColor: "#222" }}
              />
            </div>

            {/* İnternet kullanımı gösterimi */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxWidth: 600,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <div>
                <strong>Anlık Veri Kullanımı (Live):</strong>{" "}
                {bytesToMB(liveBytesSent)} MB gönderildi — {bytesToMB(liveBytesReceived)} MB alındı
              </div>
              <div>
                <strong>Toplam Kullanım:</strong>{" "}
                {totalMB.toFixed(2)} MB —{" "}
                {mbPerMin.toFixed(2)} MB/dakika — {mbPerHour.toFixed(2)} MB/saat
              </div>
              <div>
                <strong>Tahmini Veri Kullanımı (seçilen çözünürlük & fps):</strong>{" "}
                {estimatedMBPerMinute.toFixed(2)} MB/dakika — {estimatedMBPerHour.toFixed(2)} MB/saat
              </div>
            </div>

            {/* Resolution ve FPS seçimi */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 20,
                justifyContent: "center",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <label>
                Çözünürlük:
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  style={{ marginLeft: 8 }}
                >
                  {resolutionOptions.map((r) => (
                    <option key={r.label} value={r.label}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                FPS:
                <select
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  style={{ marginLeft: 8 }}
                >
                  {fpsOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Timer kontrolü */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={timerEnabled}
                  onChange={() => setTimerEnabled((v) => !v)}
                />{" "}
                Zamanlayıcıyı Kullan
              </label>

              {timerEnabled && (
                <>
                  <input
                    type="datetime-local"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    style={{ minWidth: 200 }}
                  />

                  <button onClick={() => incrementTimer(60)}>+1 dakika</button>
                  <button onClick={() => incrementTimer(-60)} disabled={timerSeconds < 60}>
                    -1 dakika
                  </button>

                  <div>
                    Kalan Süre:{" "}
                    {new Date(timerSeconds * 1000).toISOString().substr(11, 8)}
                  </div>
                </>
              )}
            </div>

            {/* Kontroller */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 12,
                justifyContent: "center",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button onClick={toggleVideo}>
                {videoOn ? "Video Kapat" : "Video Aç"}
              </button>
              <button onClick={toggleAudio}>
                {audioOn ? "Ses Kapat" : "Ses Aç"}
              </button>
              <button
                onClick={handleEnd}
                style={{ marginLeft: 12, backgroundColor: "red", color: "white", padding: "8px 12px" }}
              >
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

      <style jsx>{`
        @media (max-width: 768px) {
          .glow-frame {
            box-shadow: 0 0 40px 12px rgba(0, 255, 153, 0.7);
            border-radius: 12px;
            transition: box-shadow 0.3s ease-in-out;
          }
        }
      `}</style>
    </>
  );
}

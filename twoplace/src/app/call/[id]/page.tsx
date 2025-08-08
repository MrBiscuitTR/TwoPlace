"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { CallRecord, UserProfile } from "@/lib/types";
import LightFrame from "@/components/lightFrame";

const FPS_OPTIONS = [15, 24, 30];
const RESOLUTION_OPTIONS = [
  { label: "144p (256x144)", width: 256, height: 144, bitrate: 150 },
  { label: "240p (426x240)", width: 426, height: 240, bitrate: 300 },
  { label: "360p (640x360)", width: 640, height: 360, bitrate: 500 },
  { label: "480p (854x480)", width: 854, height: 480, bitrate: 800 },
  { label: "720p HD (1280x720)", width: 1280, height: 720, bitrate: 1500 },
];

// Gerçek veri kullanımı hesaplaması için MediaStreamTrackStats tipi (minimal)
type StatsReport = {
  bytesSent?: number;
  bytesReceived?: number;
};

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [callData, setCallData] = useState<CallRecord | null>(null);
  const [callStatus, setCallStatus] = useState<"ringing" | "accepted" | "ended">("ringing");
  const [authorized, setAuthorized] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [fps, setFps] = useState(24);
  const [resolution, setResolution] = useState(RESOLUTION_OPTIONS[2]);

  const [callDuration, setCallDuration] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [autoEndTimer, setAutoEndTimer] = useState(5 * 60); // Örnek 5 dakika otomatik çağrı sonu
  const autoEndIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const callAccepted = callStatus === "accepted";

  // --- Kullanıcı doğrulama ve çağrı bilgisi ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/register");
        return;
      }

      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (!userDoc.exists()) {
        router.push("/register");
        return;
      }
      setUser(userDoc.data() as UserProfile);

      if (!callId || typeof callId !== "string") {
        router.push("/not-found");
        return;
      }

      const callDoc = await getDoc(doc(db, "calls", callId));
      if (!callDoc.exists()) {
        router.push("/not-found");
        return;
      }

      const callInfo = callDoc.data() as CallRecord;
      if (firebaseUser.uid !== callInfo.callerUid && firebaseUser.uid !== callInfo.calleeUid) {
        router.push("/unauthorized");
        return;
      }

      setCallData({ ...callInfo, id: callDoc.id });

      if (!callInfo.accepted) setCallStatus("ringing");
      else if (callInfo.endedAt) setCallStatus("ended");
      else setCallStatus("accepted");

      setAuthorized(true);
    });

    return () => unsubscribe();
  }, [callId, router]);

  // --- Çağrı bitişini sayfa kapandığında / reload olduğunda otomatik yap ---
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (callData && !callData.endedAt) {
        await updateDoc(doc(db, "calls", callData.id), {
          endedAt: serverTimestamp(),
          wasAutoEnded: true,
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [callData]);

  // --- WebRTC & Signaling ---
  useEffect(() => {
    if (!callAccepted || !user || !callData) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = pc;

    // Local stream setup fonksiyonu
    async function startLocalStream() {
      try {
        if (localStreamRef.current) {
          // Önceki stream varsa durdur
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoEnabled
            ? {
                width: resolution.width,
                height: resolution.height,
                frameRate: fps,
              }
            : false,
          audio: audioEnabled,
        });

        localStreamRef.current = stream;

        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } catch (err) {
        console.error("Media stream alınırken hata:", err);
      }
    }

    startLocalStream();

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    // Firestore signaling koleksiyonları
    const callDocRef = doc(db, "calls", callData.id);
    const callerCandidatesCollection = collection(callDocRef, "callerCandidates");
    const calleeCandidatesCollection = collection(callDocRef, "calleeCandidates");

    // ICE candidate'ları Firestore'a ekle
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.toJSON();
        if (user && user.uid === callData.callerUid) {
          addDoc(callerCandidatesCollection, candidate);
        } else {
          addDoc(calleeCandidatesCollection, candidate);
        }
      }
    };

    // Signaling işleyişi
    async function signaling() {
      if (user && callData && user.uid === callData.callerUid) {
        // Caller
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await updateDoc(callDocRef, { offer: { type: offer.type, sdp: offer.sdp } });

        onSnapshot(callDocRef, (snapshot) => {
          const data = snapshot.data();
          if (data?.answer && !pc.currentRemoteDescription) {
            const answerDesc = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDesc);
          }
        });

        onSnapshot(calleeCandidatesCollection, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate);
            }
          });
        });
      } else if (user) {
        // Callee
        const callSnapshot = await getDoc(callDocRef);
        const data = callSnapshot.data();

        if (!data?.offer) {
          console.error("Offer bulunamadı");
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await updateDoc(callDocRef, { answer: { type: answer.type, sdp: answer.sdp } });

        onSnapshot(callerCandidatesCollection, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate);
            }
          });
        });
      }
    }

    signaling();

    return () => {
      // Çağrı kapatılırken gerçek veri kullanımını hesapla ve Firestore'a yaz
      async function cleanup() {
        if (!peerConnectionRef.current) return;

        // WebRTC bağlantısını kapat
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;

        // Local stream durdur
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }

        // Veri kullanımı topla
        let totalBytesSent = 0;
        let totalBytesReceived = 0;

        try {
          const stats = await peerConnectionRef.current!.getStats(); // ! koydum çünkü burada kesinlikle var gibi
          stats.forEach((report) => {
            if (report.type === "outbound-rtp") {
              const s = report as StatsReport;
              if (s.bytesSent) totalBytesSent += s.bytesSent;
            }
            if (report.type === "inbound-rtp") {
              const s = report as StatsReport;
              if (s.bytesReceived) totalBytesReceived += s.bytesReceived;
            }
          });
        } catch (e) {
          console.warn("Stat toplanamadı:", e);
        }

        // Firestore'a yaz
        if (callData?.id) {
          await updateDoc(doc(db, "calls", callData.id), {
            endedAt: serverTimestamp(),
            bytesSent: totalBytesSent,
            bytesReceived: totalBytesReceived,
          });
        }
      }

      cleanup();
    };
  }, [callAccepted, user, callData, videoEnabled, audioEnabled, fps, resolution]);

  // --- Çağrı süresi sayaç ---
  useEffect(() => {
    if (callStatus !== "accepted") {
      setCallDuration(0);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      return;
    }

    durationIntervalRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
      setAutoEndTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);

    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [callStatus]);

  // --- Otomatik çağrı sonlandırma ---
  useEffect(() => {
    if (autoEndTimer === 0 && callStatus === "accepted") {
      handleEndCall();
    }
  }, [autoEndTimer, callStatus]);

  // --- Çağrı kabul ---
  const handleAcceptCall = async () => {
    if (!callData) return;

    await updateDoc(doc(db, "calls", callData.id), {
      accepted: true,
      acceptedAt: serverTimestamp(),
    });
    setCallStatus("accepted");
  };

  // --- Çağrı reddet ---
  const handleRejectCall = async () => {
    if (!callData) return;

    await updateDoc(doc(db, "calls", callData.id), {
      endedAt: serverTimestamp(),
      wasAutoEnded: false,
    });

    router.push("/dashboard");
  };

  // --- Çağrıyı bitir ---
  const handleEndCall = async () => {
    if (!callData) return;

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    await updateDoc(doc(db, "calls", callData.id), {
      endedAt: serverTimestamp(),
    });

    router.push("/dashboard");
  };

  if (!authorized) return null;

  // Sayfa / modal UI:
  return (
    <div className="call-container" style={{ padding: 20 }}>
      {callStatus === "ringing" && user?.uid === callData?.calleeUid && (
        <div
          className="call-popup"
          role="dialog"
          aria-modal="true"
          style={{
            border: "1px solid #ccc",
            padding: 20,
            borderRadius: 10,
            maxWidth: 400,
            margin: "auto",
            textAlign: "center",
          }}
        >
          <h2>Çağrı Geliyor</h2>
          <p>
            {user?.uid === callData?.calleeUid
              ? "Birisi sizi arıyor."
              : "Arama başlatılıyor..."}
          </p>
          <button
            onClick={handleAcceptCall}
            style={{
              marginRight: 10,
              backgroundColor: "#4caf50",
              color: "white",
              padding: "10px 20px",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Kabul Et
          </button>
          <button
            onClick={handleRejectCall}
            style={{
              backgroundColor: "#f44336",
              color: "white",
              padding: "10px 20px",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Reddet
          </button>
        </div>
      )}

      {callStatus === "accepted" && (
        <LightFrame color="#00ff99" thickness={6} brightness={0.7}>
          <div
            className="call-videos"
            style={{ display: "flex", gap: 20, justifyContent: "center" }}
          >
            <video
              ref={remoteVideoRef}
              className="remote-video"
              autoPlay
              playsInline
              muted={false}
              style={{ width: "60%", borderRadius: 8, backgroundColor: "#000" }}
            />
            <video
              ref={localVideoRef}
              className="local-video"
              autoPlay
              playsInline
              muted
              draggable
              style={{
                width: "30%",
                borderRadius: 8,
                backgroundColor: "#222",
                cursor: "grab",
              }}
            />
          </div>

          <div
            className="controls"
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button onClick={() => setVideoEnabled((v) => !v)}>
              {videoEnabled ? "Video Kapat" : "Video Aç"}
            </button>
            <button onClick={() => setAudioEnabled((a) => !a)}>
              {audioEnabled ? "Ses Kapat" : "Ses Aç"}
            </button>

            <label>
              FPS:
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                style={{ marginLeft: 6 }}
              >
                {FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Çözünürlük:
              <select
                value={resolution.label}
                onChange={(e) =>
                  setResolution(
                    RESOLUTION_OPTIONS.find((r) => r.label === e.target.value) ||
                      RESOLUTION_OPTIONS[2]
                  )
                }
                style={{ marginLeft: 6 }}
              >
                {RESOLUTION_OPTIONS.map((r) => (
                  <option key={r.label} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            className="data-usage"
            style={{ marginTop: 20, textAlign: "center", fontSize: 14 }}
          >
            <div>Çağrı Süresi: {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")}</div>
            <div>Otomatik Sonlandırma: {Math.floor(autoEndTimer / 60)}:{(autoEndTimer % 60).toString().padStart(2, "0")}</div>
            <button
              onClick={handleEndCall}
              style={{
                marginTop: 10,
                backgroundColor: "red",
                color: "white",
                padding: "10px 20px",
                border: "none",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              Aramayı Bitir
            </button>
          </div>
        </LightFrame>
      )}

      {callStatus === "ended" && (
        <div
          className="call-ended"
          style={{ textAlign: "center", padding: 40, fontSize: 18 }}
        >
          <h2>Çağrı Sonlandırıldı</h2>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Geri Dön
          </button>
        </div>
      )}
    </div>
  );
}

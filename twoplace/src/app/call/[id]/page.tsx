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
import LightFrame from "@/components/lightFrame"; // opsiyonel ışıklı çerçeve

const FPS_OPTIONS = [15, 24, 30];
const RESOLUTION_OPTIONS = [
  { label: "144p (256x144)", width: 256, height: 144, bitrate: 150 },
  { label: "240p (426x240)", width: 426, height: 240, bitrate: 300 },
  { label: "360p (640x360)", width: 640, height: 360, bitrate: 500 },
  { label: "480p (854x480)", width: 854, height: 480, bitrate: 800 },
  { label: "720p HD (1280x720)", width: 1280, height: 720, bitrate: 1500 },
];

// Helper: Veri kullanımı tahmini
function estimateDataUsage(bitrateKbps: number, durationSeconds: number) {
  const MBperSecond = bitrateKbps / 8 / 1024;
  return MBperSecond * durationSeconds;
}

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = Array.isArray(params.id) ? params.id[0] : params.id;

  // Kullanıcı ve çağrı bilgileri
  const [user, setUser] = useState<UserProfile | null>(null);
  const [callData, setCallData] = useState<CallRecord | null>(null);
  const [callStatus, setCallStatus] = useState<"ringing" | "accepted" | "ended">("ringing");
  const [authorized, setAuthorized] = useState(false);

  // Medya element referansları
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Medya ayarları
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [fps, setFps] = useState(24);
  const [resolution, setResolution] = useState(RESOLUTION_OPTIONS[2]); // default 360p

  // Çağrı süresi
  const [callDuration, setCallDuration] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Çağrı kabul durumu
  const callAccepted = callStatus === "accepted";

  // --- Kullanıcı doğrulama ve çağrı verisi yükleme ---
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
      // Kullanıcı çağrı katılımcısı mı?
      if (firebaseUser.uid !== callInfo.callerUid && firebaseUser.uid !== callInfo.calleeUid) {
        router.push("/unauthorized");
        return;
      }

      setCallData({ ...callInfo, id: callDoc.id });

      if (!callInfo.accepted) {
        setCallStatus("ringing");
      } else if (callInfo.endedAt) {
        setCallStatus("ended");
      } else {
        setCallStatus("accepted");
      }

      setAuthorized(true);
    });

    return () => unsubscribe();
  }, [callId, router]);

  // --- WebRTC ve signaling setup ---
  useEffect(() => {
    if (!callAccepted || !user || !callData) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = pc;

    // Local medya stream al
    async function startLocalStream() {
      try {
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

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Stream parçalarını RTCPeerConnection'a ekle
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } catch (err) {
        console.error("Media stream alınırken hata:", err);
      }
    }

    startLocalStream();

    // Remote stream gösterme
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Firestore dokümanları referansları
    const callDocRef = doc(db, "calls", callData.id);
    const callerCandidatesCollection = collection(callDocRef, "callerCandidates");
    const calleeCandidatesCollection = collection(callDocRef, "calleeCandidates");

    // ICE candidate oluşunca Firestore'a ekle
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.toJSON();
        if (user && callData && user.uid === callData.callerUid) {
          addDoc(callerCandidatesCollection, candidate);
        } else {
          addDoc(calleeCandidatesCollection, candidate);
        }
      }
    };

    // Tek seferlik signaling fonksiyonu
    async function signaling() {
      if (user && callData && user.uid === callData.callerUid) {
        // Caller: Offer oluştur ve Firestore'a yaz
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await updateDoc(callDocRef, { offer: { type: offer.type, sdp: offer.sdp } });

        // Answer ve callee ICE candidate'ları dinle
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
      } else {
        // Callee: Offer'ı Firestore'dan al, Answer oluştur, Firestore'a yaz
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

    // Cleanup
    return () => {
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      localStreamRef.current = null;
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
    }, 1000);

    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [callStatus]);

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

  // Veri kullanımı tahmini
  const bitrateKbps = resolution.bitrate;
  const dataPerMinuteMB = estimateDataUsage(bitrateKbps, 60);
  const dataPerHourMB = dataPerMinuteMB * 60;

  // Süre formatlama (mm:ss)
  function formatDuration(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  if (!authorized) return null;

  return (
    <div className="call-container" style={{ padding: 20 }}>
      {callStatus === "ringing" && (
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
            <div>
              Tahmini veri kullanımı: {dataPerMinuteMB.toFixed(2)} MB/dakika —{" "}
              {dataPerHourMB.toFixed(2)} MB/saat
            </div>
            <div>Çağrı Süresi: {formatDuration(callDuration)}</div>
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

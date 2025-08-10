"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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
  Timestamp,
  query,
  where,
} from "firebase/firestore";
import type { CallRecord, UserProfile } from "@/lib/types";
import { useRouter } from "next/navigation";

/**
 * CallContext: tüm çağrı/sinyal işlemlerini burada toplayacağız.
 * StartCall -> hemen offer oluşturur ve call dokümanı yazar.
 * Callee popup -> layout tarafı / provider query ile dinler (calleeUid == currentUser).
 * AcceptCall -> callee, offer'ı alır, answer üretir ve yazdırır.
 * ICE candidate'lar callerCandidates / calleeCandidates koleksiyonlarına yazılır.
 */

type CallStatus = "idle" | "calling" | "ringing" | "accepted" | "ended";

type CallContextType = {
  user: UserProfile | null;
  callData: CallRecord | null;
  callStatus: CallStatus;
  liveBytesSent: number;
  liveBytesReceived: number;
  startCall: (calleeUid: string) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: (callId?: string, bytesSent?: number, bytesReceived?: number ) => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  setVideoEnabled: (b: boolean) => void;
  setAudioEnabled: (b: boolean) => void;
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [callData, setCallData] = useState<CallRecord | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const router = useRouter();

  interface PeerWithCleanup extends RTCPeerConnection {
    _cleanup?: () => void;
  }
  const peerRef = useRef<PeerWithCleanup | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [videoEnabled, _setVideoEnabled] = useState(true);
  const [audioEnabled, _setAudioEnabled] = useState(true);

  const [liveBytesSent, setLiveBytesSent] = useState(0);
  const [liveBytesReceived, setLiveBytesReceived] = useState(0);

  // auth -> user yükle
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        return;
      }
      const ud = await getDoc(doc(db, "users", u.uid));
      if (!ud.exists()) {
        setUser(null);
        return;
      }
      setUser({ ...(ud.data() as UserProfile), uid: u.uid });
    });
    return () => unsub();
  }, []);

  // Helper: Peer oluşturma (stun + cleanup)
  function createPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // remote stream
    if (!remoteRef.current) remoteRef.current = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remoteRef.current!.addTrack(t));
      setRemoteStream(remoteRef.current);
    };

    return pc;
  }

  // startCall: caller tarafı. ÖNEMLİ: offer hemen yazılır.
  async function startCall(calleeUid: string) {
    if (!user) throw new Error("Not authenticated");
    try {
      // 1) create call doc (without offer yet) -> we will update it with offer
      const newCall: Partial<CallRecord> = {
        callerUid: user.uid,
        calleeUid,
        accepted: false,
        startedAt: serverTimestamp() as Timestamp,
      };
      const callRef = await addDoc(collection(db, "calls"), newCall);

      // Update local state
      setCallData({ ...(newCall as CallRecord), id: callRef.id });
      setCallStatus("calling"); // calling = çağrı başlatıldı (ringer bekleniyor)

      // 2) create RTCPeerConnection and local stream
      const pc = createPeerConnection();
      peerRef.current = pc;

      try {
        if (localRef.current) localRef.current.getTracks().forEach((t) => t.stop());
        const s = await navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: audioEnabled });
        localRef.current = s;
        setLocalStream(s);
        s.getTracks().forEach((t) => pc.addTrack(t, s));
      } catch (err) {
        console.error("getUserMedia failed", err);
        // optionally update call doc to failed
        return;
      }

      // candidate koleksiyonları referansları
      const callDocRef = doc(db, "calls", callRef.id);
      const callerCandidates = collection(callDocRef, "callerCandidates");
      const calleeCandidates = collection(callDocRef, "calleeCandidates");

      // ICE -> callerCandidates
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        console.log("Caller ICE candidate oluşturuldu:", ev.candidate);
        addDoc(callerCandidates, ev.candidate.toJSON())
          .then(() => console.log("Caller ICE candidate Firestore'a eklendi"))
          .catch((err) => console.warn("Caller ICE candidate eklenirken hata:", err));
      };

      // 3) create offer and write to call doc
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await updateDoc(callDocRef, {
        offer: { type: offer.type, sdp: offer.sdp },
      });

      // 4) listen for answer and callee candidates
      const unsubCall = onSnapshot(callDocRef, (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.answer && pc && !pc.currentRemoteDescription) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.warn);
        }
        // If callee accepted flag changes, update status
        if (data.accepted) setCallStatus("accepted");
        if (data.endedAt) setCallStatus("ended");
      });

      const unsubCalleeCandidates = onSnapshot(collection(callDocRef, "calleeCandidates"), (snap) => {
        snap.docChanges().forEach((chg) => {
          if (chg.type === "added") {
            const cand = chg.doc.data();
            pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
          }
        });
      });

      // stats updater
      const statsInterval = setInterval(async () => {
        try {
          const stats = await pc.getStats();
          let s = 0,
            r = 0;
          stats.forEach((report) => {
            if (report.type === "outbound-rtp" && "bytesSent" in report && typeof report.bytesSent === "number")
              s += report.bytesSent;
            if (report.type === "inbound-rtp" && "bytesReceived" in report && typeof report.bytesReceived === "number")
              r += report.bytesReceived;
          });
          setLiveBytesSent(s);
          setLiveBytesReceived(r);
        } catch (e) { }
      }, 2000);

      // cleanup on end
      const cleanup = () => {
        unsubCall();
        unsubCalleeCandidates();
        clearInterval(statsInterval);
      };
      (pc as PeerWithCleanup)._cleanup = cleanup;

      // Başarılı olursa yönlendir
      router.push(`/call/${callRef.id}`);
    } catch (err) {
      console.error("startCall failed:", err);
      // İstersen burada kullanıcıya hata mesajı gösterebilirsin
    }
  }

  async function endCall(callId?: string, bytesSent?: number, bytesReceived?: number) {
    // PeerConnection ve bağlantılı işlemleri temizle
    try {
      // Eğer cleanup fonksiyonu varsa çağır (abonelikler, interval temizliği vs.)
      peerRef.current?._cleanup?.();
      try {
        (peerRef.current as PeerWithCleanup)?._cleanup?.();
      } catch { }
      // PeerConnection varsa kapat ve referansı temizle
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
    } catch (err) {
      console.warn("endCall error closing peer connection", err);
    }

    // Local media stream'i durdur ve tamamen serbest bırak
    if (localRef.current) {
      localRef.current.getTracks().forEach((track) => {
        track.stop();
        // Ayrıca track referanslarını ayırmak için track'i stream'den çıkarabilirsin:
        if (localRef.current?.removeTrack) {
          localRef.current.removeTrack(track);
        }
      });
      localRef.current = null;
      setLocalStream(null);
    }

    // Remote media stream'i durdur ve tamamen serbest bırak
    if (remoteRef.current) {
      remoteRef.current.getTracks().forEach((track) => {
        track.stop();
        if (remoteRef.current?.removeTrack) {
          remoteRef.current.removeTrack(track);
        }
      });
      remoteRef.current = null;
      setRemoteStream(null);
    }

    // Firestore çağrı dokümanını güncelle, burada bytes bilgilerini de ekle
    try {
      if (callId || callData?.id) {
        const id = callId || callData!.id;
        await updateDoc(doc(db, "calls", id), {
          endedAt: serverTimestamp(),
          bytesSent: bytesSent ?? 0,
          bytesReceived: bytesReceived ?? 0,
        });
      }
    } catch (err) {
      console.warn("endCall error updating Firestore", err);
    } finally {
      setCallStatus("ended");
      setCallData(null);
    }
  }





  // Listen for incoming calls (anywhere in app/layout we can also rely on this)
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "calls"),
      where("calleeUid", "==", user.uid),
      where("accepted", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const activeCalls = snap.docs.filter(doc => !doc.data().endedAt);
      if (activeCalls.length > 0) {
        const docSnap = activeCalls[0];
        const data = docSnap.data() as CallRecord;
        setCallData({ ...data, id: docSnap.id });
        setCallStatus("ringing");
      } else {
        if (callStatus === "ringing") {
          setCallData(null);
          setCallStatus("idle");
        }
      }
    }, (err) => {
      console.error("incoming call snapshot error:", err);
    });

    return () => unsub();
  }, [user]);

  // cleanup on unmount/reload — tries to mark ended if there's an active call started by this client
  useEffect(() => {
    const handler = async () => {
      if (callData && !callData.endedAt) {
        await updateDoc(doc(db, "calls", callData.id), { endedAt: serverTimestamp(), wasAutoEnded: true }).catch(() => { });
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [callData]);

  // acceptCall: callee tarafı (kabul ettiğinde çalıştırılır)
  async function acceptCall(callId: string) {
    if (!user) throw new Error("Not authenticated");

    try {
      const callRef = doc(db, "calls", callId);
      const callSnap = await getDoc(callRef);
      if (!callSnap.exists()) throw new Error("Call doc not found");
      const data = callSnap.data() as CallRecord;

      // mark accepted
      await updateDoc(callRef, { accepted: true, acceptedAt: serverTimestamp() });

      // build pc
      const pc = createPeerConnection();
      peerRef.current = pc;

      try {
        if (localRef.current) localRef.current.getTracks().forEach((t) => t.stop());
        const s = await navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: audioEnabled });
        localRef.current = s;
        setLocalStream(s);
        s.getTracks().forEach((t) => pc.addTrack(t, s));
      } catch (err) {
        console.error("getUserMedia failed for callee", err);
        return;
      }

      const callerCandidates = collection(callRef, "callerCandidates");
      const calleeCandidates = collection(callRef, "calleeCandidates");

      // ICE -> calleeCandidates
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        console.log("Callee ICE candidate oluşturuldu:", ev.candidate);
        addDoc(calleeCandidates, ev.candidate.toJSON())
          .then(() => console.log("Callee ICE candidate Firestore'a eklendi"))
          .catch((err) => console.warn("Callee ICE candidate eklenirken hata:", err));
      };

      // set remote description from offer
      if (!data.offer) {
        console.error("No offer in call doc");
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      // create answer, setLocalDescription, write answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(callRef, { answer: { type: answer.type, sdp: answer.sdp } });

      // listen for callerCandidates and add them
      const unsubCallerCandidates = onSnapshot(callerCandidates, (snap) => {
        snap.docChanges().forEach((chg) => {
          if (chg.type === "added") {
            pc.addIceCandidate(new RTCIceCandidate(chg.doc.data())).catch(console.warn);
          }
        });
      });

      // Also listen for call doc changes
      const unsubCall = onSnapshot(callRef, (snap) => {
        const d = snap.data();
        if (!d) return;
        if (d.endedAt) setCallStatus("ended");
        if (d.accepted) setCallStatus("accepted");
      });

      // stats
      const statsInterval = setInterval(async () => {
        try {
          const stats = await pc.getStats();
          let s = 0,
            r = 0;
          stats.forEach((report) => {
            if (report.type === "outbound-rtp" && "bytesSent" in report && typeof report.bytesSent === "number")
              s += report.bytesSent;
            if (report.type === "inbound-rtp" && "bytesReceived" in report && typeof report.bytesReceived === "number")
              r += report.bytesReceived;
          });
          setLiveBytesSent(s);
          setLiveBytesReceived(r);
        } catch (e) { }
      }, 2000);

      const cleanup = () => {
        unsubCallerCandidates();
        unsubCall();
        clearInterval(statsInterval);
      };
      (pc as PeerWithCleanup)._cleanup = cleanup;

      // Başarılı olursa yönlendir
      router.push(`/call/${callId}`);
    } catch (err) {
      console.error("acceptCall failed:", err);
      // İstersen burada kullanıcıya hata mesajı gösterebilirsin
    }
  }

  // rejectCall: callee tarafı (çağrıyı reddeder)
  async function rejectCall(callId: string) {
    const callRef = doc(db, "calls", callId);
    await updateDoc(callRef, { endedAt: serverTimestamp(), wasAutoEnded: false, accepted: false });
    setCallStatus("ended");
  }

  return (
    <CallContext.Provider
      value={{
        user,
        callData,
        callStatus,
        liveBytesSent,
        liveBytesReceived,
        startCall: async (calleeUid: string) => {
          await startCall(calleeUid);
        },
        acceptCall: async (callId: string) => await acceptCall(callId),
        rejectCall: async (callId: string) => await rejectCall(callId),
        endCall: async (callId?: string) => await endCall(callId),
        localStream,
        remoteStream,
        setVideoEnabled: (b: boolean) => _setVideoEnabled(b),
        setAudioEnabled: (b: boolean) => _setAudioEnabled(b),
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { CallRecord, UserProfile } from "@/lib/types";

type CallStatus = "ringing" | "accepted" | "ended" | null;

interface CallContextType {
  user: UserProfile | null;
  callData: CallRecord | null;
  callStatus: CallStatus;
  videoEnabled: boolean;
  audioEnabled: boolean;
  startCall: (callId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  setVideoEnabled: (v: boolean) => void;
  setAudioEnabled: (a: boolean) => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }
  return context;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [callData, setCallData] = useState<CallRecord | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Auth dinle
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (!userDoc.exists()) {
        setUser(null);
        return;
      }
      setUser(userDoc.data() as UserProfile);
    });

    return () => unsubscribe();
  }, []);

  // Çağrı başlatma
  async function startCall(callId: string) {
    if (!user) throw new Error("User yok");
    const callDocRef = doc(db, "calls", callId);
    const callDoc = await getDoc(callDocRef);
    if (!callDoc.exists()) throw new Error("Call doc yok");
    const callInfo = callDoc.data() as CallRecord;
    setCallData(callInfo);

    setCallStatus(callInfo.accepted ? "accepted" : "ringing");

    // WebRTC başlat
    await setupWebRTC(callId, callInfo);
  }

  async function setupWebRTC(callId: string, callInfo: CallRecord) {
    if (!user) return;

    // Media stream al
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoEnabled,
      audio: audioEnabled,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = pc;

    // Local stream'i pc'ye ekle
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Remote stream setup
    const remoteStream = new MediaStream();
    setRemoteStream(remoteStream);
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    const callDocRef = doc(db, "calls", callId);
    const callerCandidatesCollection = collection(callDocRef, "callerCandidates");
    const calleeCandidatesCollection = collection(callDocRef, "calleeCandidates");

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.toJSON();
        if (user.uid === callInfo.callerUid) {
          addDoc(callerCandidatesCollection, candidate);
        } else {
          addDoc(calleeCandidatesCollection, candidate);
        }
      }
    };

    if (user.uid === callInfo.callerUid) {
      // Caller
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateDoc(callDocRef, { offer: { type: offer.type, sdp: offer.sdp } });

      // Answer ve callee ICE candidate dinle
      onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && !pc.currentRemoteDescription) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      });

      onSnapshot(calleeCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      });
    } else {
      // Callee
      const callSnapshot = await getDoc(callDocRef);
      const data = callSnapshot.data();
      if (!data?.offer) throw new Error("Offer yok");

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(callDocRef, { answer: { type: answer.type, sdp: answer.sdp } });

      onSnapshot(callerCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      });
    }
  }

  async function acceptCall() {
    if (!callData) return;
    await updateDoc(doc(db, "calls", callData.id), {
      accepted: true,
      acceptedAt: serverTimestamp(),
    });
    setCallStatus("accepted");
  }

  async function rejectCall() {
    if (!callData) return;
    await updateDoc(doc(db, "calls", callData.id), {
      endedAt: serverTimestamp(),
      wasAutoEnded: false,
    });
    cleanupCall();
  }

  async function endCall() {
    if (!callData) return;
    await updateDoc(doc(db, "calls", callData.id), {
      endedAt: serverTimestamp(),
    });
    cleanupCall();
  }

  function cleanupCall() {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    setRemoteStream(null);
    setCallData(null);
    setCallStatus(null);
  }

  return (
    <CallContext.Provider
      value={{
        user,
        callData,
        callStatus,
        videoEnabled,
        audioEnabled,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        setVideoEnabled,
        setAudioEnabled,
        localStream,
        remoteStream,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

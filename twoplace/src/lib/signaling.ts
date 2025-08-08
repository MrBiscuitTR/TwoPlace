import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  Firestore,
  DocumentReference,
  Unsubscribe,
} from "firebase/firestore";
import { addIceCandidate, setRemoteDescription, createAnswer } from "./webrtc";

export const createCall = async (
  db: Firestore,
  callId: string,
  offer: RTCSessionDescriptionInit
): Promise<DocumentReference> => {
  const callRef = doc(db, "calls", callId);
  await setDoc(callRef, { offer });

  return callRef;
};

export const listenForAnswer = (
  db: Firestore,
  callId: string,
  onAnswer: (answer: RTCSessionDescriptionInit) => void
): Unsubscribe => {
  const callRef = doc(db, "calls", callId);
  return onSnapshot(callRef, (snapshot) => {
    const data = snapshot.data();
    if (data?.answer) {
      onAnswer(data.answer);
    }
  });
};

export const answerCall = async (
  db: Firestore,
  callId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> => {
  const callRef = doc(db, "calls", callId);
  await setDoc(callRef, { answer }, { merge: true });
};

export const listenForIceCandidates = (
  db: Firestore,
  callId: string,
  role: "offer" | "answer",
  onCandidate: (candidate: RTCIceCandidateInit) => void
): Unsubscribe => {
  const candidatesRef = collection(
    db,
    "calls",
    callId,
    role === "offer" ? "answerCandidates" : "offerCandidates"
  );

  return onSnapshot(candidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        if (data) {
          onCandidate(data as RTCIceCandidateInit);
        }
      }
    });
  });
};

export const addIceCandidateToCall = async (
  db: Firestore,
  callId: string,
  role: "offer" | "answer",
  candidate: RTCIceCandidateInit
): Promise<void> => {
  const candidatesRef = collection(
    db,
    "calls",
    callId,
    role === "offer" ? "offerCandidates" : "answerCandidates"
  );

  await addDoc(candidatesRef, candidate);
};

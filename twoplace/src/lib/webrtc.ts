import { db } from './firebase'; // senin Firestore bağlantı dosyan
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  deleteField,
  DocumentReference,
} from 'firebase/firestore';

interface CallDocument {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  offerCandidates?: RTCIceCandidateInit[];
  answerCandidates?: RTCIceCandidateInit[];
  status: 'waiting' | 'active' | 'ended';
  createdAt: number;
  endedAt?: number;
  timerSeconds?: number;
}

let peerConnection: RTCPeerConnection;
let localStream: MediaStream;
let remoteStream: MediaStream;

export const createCall = async (timerSeconds?: number): Promise<string> => {
  const callDocRef = doc(collection(db, 'calls'));
  const callId = callDocRef.id;

  peerConnection = createPeerConnection();

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const offerCandidates: RTCIceCandidateInit[] = [];

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      offerCandidates.push(event.candidate.toJSON());
      updateDoc(callDocRef, { offerCandidates });
    }
  };

  const callData: CallDocument = {
    offer,
    status: 'waiting',
    createdAt: Date.now(),
    timerSeconds,
  };

  await setDoc(callDocRef, callData);

  // Answer dinle
  onSnapshot(callDocRef, async (snapshot) => {
    const data = snapshot.data() as CallDocument | undefined;
    if (!data) return;

    if (data.answer && !peerConnection.currentRemoteDescription) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.answerCandidates) {
      for (const candidate of data.answerCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding received ice candidate', err);
        }
      }
    }
  });

  return callId;
};

export const answerCall = async (callId: string): Promise<void> => {
  const callDocRef = doc(db, 'calls', callId);
  const callSnapshot = await getDoc(callDocRef);
  const callData = callSnapshot.data() as CallDocument;

  if (!callData || !callData.offer) {
    throw new Error('No offer found for this call.');
  }

  peerConnection = createPeerConnection();

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  const answerCandidates: RTCIceCandidateInit[] = [];

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      answerCandidates.push(event.candidate.toJSON());
      updateDoc(callDocRef, { answerCandidates });
    }
  };

  await updateDoc(callDocRef, {
    answer,
    status: 'active',
  });

  // Tekrar dinleme, offer tarafına ICE gönderilebilir
  onSnapshot(callDocRef, async (snapshot) => {
    const data = snapshot.data() as CallDocument | undefined;
    if (!data) return;

    if (data.offerCandidates) {
      for (const candidate of data.offerCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding received offer ice candidate', err);
        }
      }
    }
  });
};

export const getLocalStream = () => localStream;
export const getRemoteStream = () => remoteStream;

export const endCall = async (callId: string): Promise<void> => {
  peerConnection?.close();
  localStream?.getTracks().forEach((track) => track.stop());
  remoteStream?.getTracks().forEach((track) => track.stop());

  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, {
    status: 'ended',
    endedAt: Date.now(),
  });
};

// let peerConnection: RTCPeerConnection | null = null;

export const getPeerConnection = () => peerConnection;

export function createPeerConnection(): RTCPeerConnection {
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      // turn server ekleyeceksen buraya yaz
    ],
  });

  return peerConnection;
}

export async function createAnswer(offer: RTCSessionDescriptionInit) {
  if (!peerConnection) throw new Error("PeerConnection not initialized");

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  return answer;
}

export async function setRemoteDescription(desc: RTCSessionDescriptionInit) {
  if (!peerConnection) throw new Error("PeerConnection not initialized");

  await peerConnection.setRemoteDescription(desc);
}

export async function addIceCandidate(candidate: RTCIceCandidateInit) {
  if (!peerConnection) throw new Error("PeerConnection not initialized");

  await peerConnection.addIceCandidate(candidate);
}
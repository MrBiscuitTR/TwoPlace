// lib/call.ts

import { db } from "./firebase";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { CallRecord } from "@/lib/types";

/**
 * Yeni bir çağrı oluşturur ve çağrı ID'sini döner.
 */
export async function createCall(callerUid: string, calleeUid: string): Promise<string> {
  const callId = crypto.randomUUID();

  const callData: CallRecord = {
    id: callId,
    callerUid: callerUid,
    calleeUid: calleeUid,
    startedAt: serverTimestamp() as Timestamp,
    accepted: false,
  };

  await setDoc(doc(db, "calls", callId), callData);
  return callId;
}

/**
 * Var olan bir çağrı belgesini günceller.
 */
export async function updateCallDoc(callId: string, updates: Partial<CallRecord>) {
  const ref = doc(db, "calls", callId);
  await updateDoc(ref, updates);
}

/**
 * Belirtilen çağrı belgesini siler.
 */
export async function deleteCallDoc(callId: string) {
  const ref = doc(db, "calls", callId);
  await deleteDoc(ref);
}

/**
 * Belirli bir çağrıyı dinler (real-time).
 * @returns unsubscribe fonksiyonu (kullanıcı çıkarsa çalışmayı durdurmak için)
 */
export function listenToCall(callId: string, callback: (data: Partial<CallRecord>) => void) {
  const ref = doc(db, "calls", callId);
  return onSnapshot(ref, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as Partial<CallRecord>);
    }
  });
}

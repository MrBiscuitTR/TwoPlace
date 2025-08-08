import { db } from "./firebase"
import { collection, doc, setDoc, onSnapshot, deleteDoc, updateDoc, getDoc } from "firebase/firestore"
import { CallRecord } from "@/lib/types"
// lib/call.ts
export const createCallDoc = async (callId: string, data: Partial<CallRecord>) => {
  await setDoc(doc(db, "calls", callId), {
    ...data,
    startedAt: new Date(),
  })
}

export const updateCallDoc = async (callId: string, updates: Partial<CallRecord>) => {
  await updateDoc(doc(db, "calls", callId), updates)
}

export const deleteCallDoc = async (callId: string) => {
  await deleteDoc(doc(db, "calls", callId))
}

export const listenToCall = (callId: string, callback: (data: Partial<CallRecord>) => void) => {
  return onSnapshot(doc(db, "calls", callId), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as Partial<CallRecord>)
    }
  })
}

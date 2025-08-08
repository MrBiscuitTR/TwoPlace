import { Timestamp } from "firebase/firestore"
// lib/types.ts
export type UserProfile = {
  uid: string
  username: string
  email: string | null
  displayName: string
  photoURL?: string
  createdAt: Timestamp
  friends?: { [uid: string]: true } // sadece UID'leri tutan bir map
}

export type FriendRequest = {
  id: string
  fromUid: string
  fromName: string 
  toUid: string
  toName: string
  status: "pending" | "accepted" | "rejected"
  sentAt: Timestamp
}

export type CallRecord = {
  id: string
  callerUid: string
  calleeUid: string
  startedAt: Timestamp
  accepted: boolean
  bytesSent?: number
  bytesReceived?: number
  endedAt?: Timestamp
  wasAutoEnded?: boolean
  sleepTimerMinutes?: number // if defined, call ends after X minutes
}

export type SearchResult = {
  uid: string
  username: string
  displayName: string
  photoURL?: string
  isAlreadyFriend: boolean
  requestPending: boolean
}

// export type Friend = {
//   uid: string;
//   displayName: string;
//   status: "pending" | "accepted";
// };







import { Timestamp } from "firebase/firestore"
// lib/types.ts
export type UserProfile = {
  uid: string
  username: string
  email: string | null
  displayName: string
  photoURL?: string
  createdAt: Timestamp
  friends?: Friend[] // Optional, if you want to store friends directly in the profile
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
  receiverUid: string
  startedAt: Timestamp
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

export type Friend = {
  userId: string;
  status: "pending" | "accepted";
};
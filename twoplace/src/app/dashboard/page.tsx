"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    updateDoc,
    where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { UserProfile, FriendRequest, CallRecord } from "@/lib/types";
import {
    acceptRequest,
    rejectRequest,
    removeFriend,
    fetchFriendProfiles,
} from "../search/friends";

import { redirect } from "next/navigation";
import Image from "next/image";
import { useCall } from "@/context/Callcontext"; // CallProvider'ı kullanmak için
import { useRouter } from "next/navigation";
// icons
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import CallIcon from '@mui/icons-material/Call';

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [friends, setFriends] = useState<{ [uid: string]: true }>({});
    const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
    const { startCall } = useCall();


    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                redirect("/login");
            }

            // İlk kullanıcı bilgisi çekimi (one-time)
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            if (!userDoc.exists()) return;
            const userData = userDoc.data() as UserProfile;
            setUser(userData);
            setFriends(userData.friends || {});

            // Arkadaş profillerini fetch et
            const profiles = await fetchFriendProfiles(Object.keys(userData.friends || {}));
            setFriendProfiles(profiles);
        });

        return () => unsubscribeAuth();
    }, []);

    //   notif permission
    useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "default") {
                Notification.requestPermission().catch(console.error);
            }
        }
    }, []); // sadece bir kez

    // user değiştiğinde gerçek zamanlı dinleyicileri başlat
    useEffect(() => {
        if (!user?.uid) return;

        // Gelen arkadaşlık istekleri (pending)
        const reqQuery = query(
            collection(db, "friendRequests"),
            where("toUid", "==", user.uid),
            where("status", "==", "pending")
        );

        const unsubscribeRequests = onSnapshot(reqQuery, (snapshot) => {
            const friendReqs = snapshot.docs.map(
                (doc) => ({ id: doc.id, ...doc.data() } as FriendRequest)
            );
            setRequests(friendReqs);
        });

        // Kullanıcının profilini (arkadaş listesi için) gerçek zamanlı dinle
        const userDocRef = doc(db, "users", user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (!docSnap.exists()) return;
            const updatedUser = docSnap.data() as UserProfile;
            setUser(updatedUser);
            setFriends(updatedUser.friends || {});
            // Arkadaş profilleri güncelle
            fetchFriendProfiles(Object.keys(updatedUser.friends || {})).then(setFriendProfiles);
        });

        // Çağrı geçmişini dinle
        const callQuery = query(
            collection(db, "calls"),
            where("callerUid", "==", user.uid)  // Buradaki alan ismi Firestore'daki gerçek isimle aynı olmalı!
        );
        const unsubscribeCalls = onSnapshot(callQuery, (snapshot) => {
            const calls = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CallRecord));
            setCallHistory(calls);
        });

        return () => {
            unsubscribeRequests();
            unsubscribeUser();
            unsubscribeCalls();
        };
    }, [user?.uid]);

    async function handleAcceptRequest(request: FriendRequest) {
        if (!user) return;

        try {
            await acceptRequest(request); // Arkadaşlık ekleme + request güncelleme

            // İstek artık realtime dinleme ile otomatik güncelleneceği için manuel çıkarma yapmaya gerek yok
            // setRequests((prev) => prev.filter((r) => r.id !== request.id));
        } catch (error) {
            console.error("Arkadaşlık kabul edilirken hata oluştu:", error);

            try {
                await updateDoc(doc(db, "friendRequests", request.id), {
                    status: "pending",
                });
            } catch (revertError) {
                console.error("Status 'pending' olarak geri alınırken hata:", revertError);
            }

            alert("Arkadaşlık isteği kabul edilemedi. Lütfen tekrar deneyin.");
        }
    }

    async function handleRejectRequest(requestId: string) {
        await rejectRequest(requestId);
        // İstek reddedilince realtime dinleme bunu otomatik güncelleyecek
    }

    function toDate(ts: { toDate?: () => Date; seconds?: number } | number | string | null): Date | null {
        if (!ts) return null;
        if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
        if (typeof ts === "object" && ts !== null && "seconds" in ts) return new Date((ts as { seconds: number }).seconds * 1000);
        if (typeof ts === "number" || typeof ts === "string") return new Date(ts);
        return null;
    }

    async function handleRemoveFriend(friendUid: string) {
        if (!user) return;
        await removeFriend(user.uid, friendUid);

        // Kullanıcı profilini güncellemek için artık onSnapshot otomatik yapacak, manuel çekme zorunlu değil
        // Ancak istersen aşağıdaki satırı bırakabilirsin:
        // const userDoc = await getDoc(doc(db, "users", user.uid));
        // if (userDoc.exists()) {
        //   const updatedUser = userDoc.data() as UserProfile;
        //   setUser(updatedUser);
        //   setFriends(updatedUser.friends || {});
        //   const profiles = await fetchFriendProfiles(Object.keys(updatedUser.friends || {}));
        //   setFriendProfiles(profiles);
        // }
    }

    return (
        <div className="dashboard-container" style={{ padding: "1rem" }}>
            <h1>Hoşgeldin, {user?.displayName || "..."}</h1>

            <section style={{ marginTop: "2rem" }}>
                <h2>Arkadaşlar</h2>
                {friendProfiles.length === 0 ? (
                    <p>Henüz arkadaşınız yok.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {friendProfiles.map((friend) => (
                            <div
                                key={friend.uid}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "0.5rem 1rem",
                                    borderRadius: 8,
                                    border: "1px solid #ddd",
                                    gap: 16,
                                }}
                            >
                                {friend.photoURL ? (
                                    <Image
                                        src={friend.photoURL}
                                        alt={friend.displayName}
                                        width={50}
                                        height={50}
                                        style={{ borderRadius: "50%" }}
                                        unoptimized={true}
                                    />
                                ) : (
                                    <div
                                        style={{
                                            minWidth: 50,
                                            minHeight: 50,
                                            width: 50,
                                            height: 50,
                                            borderRadius: "50%",
                                            backgroundColor: "rgba(0, 0, 0, 0.8)",
                                        }}
                                    />
                                )}
                                <div style={{ flexGrow: 1 }}>
                                    <div style={{ fontWeight: "600" }}>{friend.displayName}</div>
                                    <div style={{ color: "#666", fontSize: "0.9rem" }}>
                                        @{friend.displayName}
                                    </div>
                                </div>
                                <button style={{
                                    padding: "0.3rem 0.7rem",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    backgroundColor: "#4caf50",
                                    color: "white",
                                    border: "none",
                                }} onClick={() => startCall(friend.uid)}><CallIcon/></button>
                                <button
                                    onClick={() => handleRemoveFriend(friend.uid)}
                                    style={{
                                        backgroundColor: "#f44336",
                                        color: "white",
                                        border: "none",
                                        padding: "0.3rem 0.7rem",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                    }}
                                >
                                    <PersonRemoveIcon/>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section style={{ marginTop: "2rem" }}>
                <h2>Gelen Arkadaş İstekleri</h2>
                {requests.length === 0 && <p>Bekleyen istek yok.</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {requests.map((req) => (
                        <div
                            key={req.id}
                            style={{
                                border: "1px solid #ccc",
                                padding: "1rem",
                                borderRadius: 8,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <div>
                                <strong>{req.fromName}</strong> (@{req.fromUid})
                            </div>
                            <div>
                                <button
                                    onClick={() => handleAcceptRequest(req)}
                                    style={{
                                        marginRight: "0.5rem",
                                        backgroundColor: "#4caf50",
                                        color: "white",
                                        border: "none",
                                        padding: "0.4rem 0.8rem",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                    }}
                                >
                                    Onayla
                                </button>
                                <button
                                    onClick={() => handleRejectRequest(req.id)}
                                    style={{
                                        backgroundColor: "#f44336",
                                        color: "white",
                                        border: "none",
                                        padding: "0.4rem 0.8rem",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                    }}
                                >
                                    Reddet
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section style={{ marginTop: "2rem" }}>
                <h2>Çağrı Geçmişi</h2>
                {callHistory.length === 0 && <p>Henüz çağrı geçmişiniz yok.</p>}
                <ul>
                    {callHistory.map((call) => (
                        <li className="callhistory-widget" key={call.id}>
                            <div>
                                <strong>Aranan:</strong> {call.calleeUid}
                                <br />
                                <small>Başlangıç : {toDate(call.startedAt)?.toLocaleString()}</small>
                                <br />
                                {call.endedAt && (
                                    <small>Bitiş : {toDate(call.endedAt)?.toLocaleString()}</small>
                                )}
                                {call.wasAutoEnded && <div>Otomatik Sonlandı</div>}
                                {call.sleepTimerMinutes && (
                                    <div>Uyku Zamanlayıcı: {call.sleepTimerMinutes} dk</div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

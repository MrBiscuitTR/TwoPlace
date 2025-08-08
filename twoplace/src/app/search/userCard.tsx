"use client";

import { useEffect, useState } from "react";
import { toggleFriendRequest, getFriendRequestStatus } from "./friends";
import type { FriendRequest } from "@/lib/types";

export default function UserCard({
  currentUserUid,
  currentUserName,
  targetUser,
}: {
  currentUserUid: string;
  currentUserName: string;
  targetUser: { uid: string; displayName: string };
}) {
  const [friendRequest, setFriendRequest] = useState<FriendRequest | null>(null);

  useEffect(() => {
    getFriendRequestStatus(currentUserUid, targetUser.uid).then(setFriendRequest);
  }, [currentUserUid, targetUser.uid]);

  const handleClick = async () => {
    await toggleFriendRequest(currentUserUid, currentUserName, targetUser.uid, targetUser.displayName);
    const updated = await getFriendRequestStatus(currentUserUid, targetUser.uid);
    setFriendRequest(updated);
  };

  return (
    <div className="user-card">
      <p>{targetUser.displayName}</p>
      <button onClick={handleClick}>
        {friendRequest?.status === "pending" ? "İsteği Geri Çek" : "İstek Gönder"}
      </button>
    </div>
  );
}

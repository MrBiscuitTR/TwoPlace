// src/app/friends/page.tsx
"use client";

import { useEffect, useState } from "react";
import { fetchFriendProfiles, FriendProfile } from "../search/friends";
import Image from "next/image";

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendProfile[]>([]);

  useEffect(() => {
    const getFriends = async () => {
      const data = await fetchFriendProfiles();
      setFriends(data);
    };
    getFriends();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your Friends</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {friends.map((friend) => (
          <div
            key={friend.userID}
            className="bg-white shadow-md rounded-lg p-4 flex items-center space-x-4"
          >
            {friend.photoURL ? (
              <Image
                src={friend.photoURL}
                alt={friend.displayName}
                width={50}
                height={50}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-[50px] h-[50px] rounded-full bg-gray-300" />
            )}
            <span className="text-lg font-medium">{friend.displayName}</span>
          </div>
        ))}
        {friends.length === 0 && (
          <p className="text-gray-500">You don&apos;t have any friends yet.</p>
        )}
      </div>
    </div>
  );
}

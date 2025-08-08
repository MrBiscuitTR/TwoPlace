"use client";

import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function CallStart() {
  const router = useRouter();

  function startCall() {
    const callId = uuidv4(); // Yeni çağrı ID'si
    router.push(`/call/${callId}`);
  }

  return (
    <div>
      <h1>Yeni Çağrı Başlat</h1>
      <button onClick={startCall}>Çağrıyı Başlat</button>
    </div>
  );
}

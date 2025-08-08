"use client"
// src/app/call/[id]/page.tsx
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { listenToCall } from "@/lib/call"
import { CallRecord } from "@/lib/types"

export default function CallPage({ params }: { params: { id: string } }) {
  const callId = params.id
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [callData, setCallData] = useState<CallRecord | null>(null)
  const router = useRouter()

  useEffect(() => {
    const unsub = listenToCall(callId, (data) => {
      setCallData(data as CallRecord)
    })

    return () => unsub()
  }, [callId])

  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center space-y-4">
      <video ref={localVideoRef} autoPlay muted playsInline className="w-1/3 rounded-xl border border-white" />
      <video ref={remoteVideoRef} autoPlay playsInline className="w-1/3 rounded-xl border border-white" />
      <p className="text-white">Call ID: {callId}</p>
    </div>
  )
}

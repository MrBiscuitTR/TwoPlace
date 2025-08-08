"use client";

import React, { useEffect } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendNotification } from "@/lib/notify";

type CallIncomingModalProps = {
  callerUid: string;
  onAccept: () => void;
  onReject: () => Promise<void>;
};

const CallIncomingModal: React.FC<CallIncomingModalProps> = ({ callerUid, onAccept, onReject }) => {
  const [callerName, setCallerName] = React.useState<string>("Bilinmeyen");

  useEffect(() => {
    const fetchCallerName = async () => {
      const docSnap = await getDoc(doc(db, "users", callerUid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCallerName(data.displayName || "Bilinmeyen");
      }
    };

    fetchCallerName();  

    // Bildirim gönder
    sendNotification({
      title: "Yeni çağrı",
      body: `${callerName} seni arıyor.`,
    });

    // 15 saniye sonra otomatik kapat
    const timeout = setTimeout(() => {
      onReject();
    }, 15000);

    return () => clearTimeout(timeout);
  }, [callerUid]);

  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-300 rounded-md shadow-md p-4 z-50 animate-fade-in">
      <h2 className="text-lg font-bold">Gelen Çağrı</h2>
      <p>{callerName} seni arıyor</p>
      <div className="flex justify-end mt-3 space-x-2">
        <button
          onClick={onReject}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded"
        >
          Reddet
        </button>
        <button
          onClick={onAccept}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded"
        >
          Kabul Et
        </button>
      </div>
    </div>
  );
};

export default CallIncomingModal;

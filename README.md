
# TwoPlace – Private Couple Video Call App

**Author**: Çağan Efe Çalıdağ  
**GitHub**: [https://github.com/MrBiscuitTR](https://github.com/caganefe)  
**Deployment Domain (DEMO) **: [https://app.cagann.dev](https://app.cagann.dev)  
**Initial Commit Date**: 2025-08-08  
**Repository Creation Date**: 2025-08-08  

## 💡 Project Description

**TwoPlace** is a web-based video call app designed **exclusively for couples** who want a **secure, minimal, and intimate** long-distance communication space.

This project was personally initiated and developed by Çağan Efe Çalıdağ. Its goal is to provide a **privacy-focused**, **aesthetic**, and **functional** alternative to mainstream video call platforms.

All source code, structure, and concept were conceived before public publication, as part of a private MVP build for legal priority proof.

---

## 🔐 Key Features

- 🔒 **End-to-End Encrypted** peer-to-peer calls using WebRTC
- 🎥 **Adjustable video resolution** (low bandwidth mode)
- 🌙 **Night glow frame**: emits soft white glow around video to illuminate the room at night
- 💤 **Sleep timer**: ends call after a set period
- ☀️ **Morning auto-reconnect**: notifies/reconnects at a preset time
- 🧑‍🤝‍🧑 **Private**: Only two pre-authorized users can access (demo) -> Firebase Authentication - User accounts, private calls, notifications...
- 📱 **Progressive Web App (PWA)**: Installable on iPhone/iPad without App Store -> maybe an app later (swift? electronjs?)

---

## 📁 Project Structure (demo)

```
twoplace-demo/
├── .env.local           # Your Firebase credentials go here
├── README.md
├── pages/
│   ├── index.tsx        # Landing page
│   └── call.tsx         # Video call screen
├── components/
│   ├── VideoFrame.tsx   # Video with glowing border
│   └── SleepTimer.tsx   # Timer and auto-reconnect
├── lib/
│   ├── firebase.ts      # Firebase setup
│   └── webrtc.ts        # WebRTC logic
└── styles/
    └── globals.css      # Styling and night frame glow
```

---

## 🛡️ Legal Ownership Statement

This codebase, its core idea (private couple video with end-to-end encryption, dynamic glow lighting, sleep-timer, and auto-reconnect), and implementation belong to **Çağan Efe Çalıdağ**.

Any attempt to clone, rebrand, or commercialize this concept **without permission or license** constitutes **intellectual property violation**.

---

## 📬 Contact

For licensing or collaboration: [efecalidag@gmail.com](mailto:efecalidag@gmail.com)


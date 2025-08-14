// pages/about.tsx

import React from 'react';
import Head from 'next/head';
import "../../app/globals.css"

const About = () => (
  <>
    <Head>
      <title>TwoPlace - About</title>
      <meta name="description" content="Private couple video call app – About Page" />
    </Head>
    <div className="mdstyle">
      <style>{`
        .mdstyle {
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          margin: 2rem auto;
          padding: 0 1rem;
          color: #1f1f1f;
          background-color: #fdfdfd;
        }

        .mdstyle h1, 
        .mdstyle h2, 
        .mdstyle h3, 
        .mdstyle h4, 
        .mdstyle h5, 
        .mdstyle h6 {
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          line-height: 1.3;
        }

        .mdstyle h1 {
          font-size: 2.25rem;
          border-bottom: 2px solid #eee;
          padding-bottom: 0.5rem;
        }

        .mdstyle h2 {
          font-size: 1.75rem;
          color: #2a2a2a;
          border-left: 4px solid #4e6cff;
          padding-left: 0.75rem;
        }

        .mdstyle p {
          margin: 1rem 0;
          font-size: 1rem;
        }

        .mdstyle strong {
          font-weight: bold;
        }

        .mdstyle a {
          color: #4e6cff;
          text-decoration: none;
        }

        .mdstyle a:hover {
          text-decoration: underline;
        }

        .mdstyle pre {
          background-color: #f4f4f4;
          padding: 1rem;
          overflow-x: auto;
          border-radius: 6px;
          border: 1px solid #ddd;
          margin: 1.5rem 0;
        }

        .mdstyle code {
          font-family: 'Courier New', Courier, monospace;
          background-color: #f4f4f4;
          padding: 0.2em 0.4em;
          border-radius: 4px;
        }

        .mdstyle ul, 
        .mdstyle ol {
          margin: 1rem 0 1rem 1.5rem;
          padding-left: 1rem;
        }

        .mdstyle li {
          margin-bottom: 0.5rem;
        }

        .mdstyle hr {
          border: none;
          border-top: 1px solid #ddd;
          margin: 2rem 0;
        }

        .mdstyle blockquote {
          border-left: 4px solid #ccc;
          padding-left: 1rem;
          color: #555;
          margin: 1.5rem 0;
          font-style: italic;
        }

        @media (max-width: 600px) {
          .mdstyle {
            font-size: 0.95rem;
          }

          .mdstyle h1 {
            font-size: 1.75rem;
          }

          .mdstyle h2 {
            font-size: 1.4rem;
          }
        }
      `}</style>

      <main>
        <h1 id="twoplace-private-couple-video-call-app">TwoPlace – Private Couple Video Call App</h1>
        <p><strong>Author</strong>: Çağan Efe Çalıdağ<br />
        <strong>GitHub</strong>: <a href="https://github.com/caganefe">https://github.com/caganefe</a><br />
        <strong>Deployment Domain</strong>: <a href="https://twoplace.cagann.dev">https://twoplace.cagann.dev</a><br />
        <strong>Initial Commit Date</strong>: 2025-08-08<br />
        <strong>Repository Creation Date</strong>: 2025-08-08</p>

        <h2>💡 Project Description</h2>
        <p><strong>TwoPlace</strong> is a web-based video call app designed <strong>exclusively for couples</strong> who want a <strong>secure, minimal, and intimate</strong> long-distance communication space.</p>
        <p>This project was personally initiated and developed by Çağan Efe Çalıdağ. Its goal is to provide a <strong>privacy-focused</strong>, <strong>aesthetic</strong>, and <strong>functional</strong> alternative to mainstream video call platforms.</p>
        <p>All source code, structure, and concept were conceived before public publication, as part of a private MVP build for legal priority proof.</p>
        <hr />

        <h2>🔐 Key Features</h2>
        <ul>
          <li>🔒 <strong>End-to-End Encrypted</strong> peer-to-peer calls using WebRTC</li>
          <li>🎥 <strong>Adjustable video resolution</strong> (low bandwidth mode)</li>
          <li>🌙 <strong>Night glow frame</strong>: emits soft white glow around video to illuminate the room at night</li>
          <li>💤 <strong>Sleep timer</strong>: ends call after a set period</li>
          <li>☀️ <strong>Morning auto-reconnect</strong>: notifies/reconnects at a preset time</li>
          <li>🧑‍🤝‍🧑 <strong>Private</strong>: Only two pre-authorized users can access</li>
          <li>📱 <strong>Progressive Web App (PWA)</strong>: Installable on iPhone/iPad without App Store</li>
        </ul>
        <hr />

        <h2>📁 Project Structure (demo)</h2>
        <pre><code>twoplace-demo/ <br />
├── .env.local           # Your Firebase credentials go here <br />
├── README.md <br />
├── pages/ <br />
│   ├── index.tsx        # Landing page <br />
│   └── call.tsx         # Video call screen <br />
├── components/ <br />
│   ├── VideoFrame.tsx   # Video with glowing border <br />
│   └── SleepTimer.tsx   # Timer and auto-reconnect <br />
├── lib/ <br />
│   ├── firebase.ts      # Firebase setup <br />
│   └── webrtc.ts        # WebRTC logic <br />
└── styles/ <br />
    └── globals.css      # Styling and night frame glow</code></pre>
        <hr />

        <h2>⚙️ Setup Instructions</h2>
        <ol>
          <li>Clone the repository and install dependencies:</li>
        </ol>
        <pre><code>npm install</code></pre>

        <ol start={2}>
          <li>Create <code>.env.local</code> and add your Firebase credentials:</li>
        </ol>
        <pre><code>NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=</code></pre>

        <ol start={3}>
          <li>Start the development server:</li>
        </ol>
        <pre><code>npm run dev</code></pre>

        <ol start={4}>
          <li>Deploy on Vercel (automatically connects to <code>twoplace.cagann.dev</code>)</li>
        </ol>
        <hr />

        <h2>🛡️ Legal Ownership Statement</h2>
        <p>This codebase, its core idea (private couple video with end-to-end encryption, dynamic glow lighting, sleep-timer, and auto-reconnect), and implementation belong to <strong>Çağan Efe Çalıdağ</strong>.</p>
        <p>Any attempt to clone, rebrand, or commercialize this concept <strong>without permission or license</strong> constitutes <strong>intellectual property violation</strong>.</p>
        <hr />

        <h2>📬 Contact</h2>
        <p>For licensing or collaboration: <a href="mailto:efecalidag@gmail.com">efecalidag@gmail.com</a></p>
      </main>
    </div>
  </>
);

export default About;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Power, Loader2, Volume2, Info } from "lucide-react";
import { AudioStreamer } from "./lib/audio-streamer";
import { AudioPlayer } from "./lib/audio-player";
import { LiveSession } from "./lib/live-session";

type SessionState = "disconnected" | "connecting" | "listening" | "speaking" | "error";

export default function App() {
  const [state, setState] = useState<SessionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);

  const startSession = useCallback(async () => {
    setState("connecting");
    setError(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing. Please set it in the Secrets panel.");
      }

      // Initialize Audio Player
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new AudioPlayer();
      }

      // Initialize Live Session
      liveSessionRef.current = new LiveSession(apiKey, {
        onOpen: () => {
          setState("listening");
          // Start streaming audio once session is open
          audioStreamerRef.current?.start();
        },
        onClose: () => {
          stopSession();
        },
        onError: (err) => {
          console.error("Live Session Error:", err);
          setError("Connection lost. Zoya is taking a break.");
          setState("error");
        },
        onAudioOutput: (base64Audio) => {
          setState("speaking");
          audioPlayerRef.current?.playChunk(base64Audio);
          // We'll revert to listening after a small delay or when audio ends
          // For simplicity, we'll use a timeout or just let it be
        },
        onInterrupted: () => {
          audioPlayerRef.current?.clearQueue();
          setState("listening");
        },
        onMessage: (msg) => {
          // Check if model turn is finished to revert to listening
          if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData === undefined && 
              msg.serverContent?.modelTurn?.parts?.[0]?.text === undefined &&
              msg.serverContent?.modelTurn?.parts?.[0]?.toolCall === undefined) {
            // This is a bit hacky, but usually indicates end of stream if no audio
          }
        }
      });

      // Initialize Audio Streamer
      audioStreamerRef.current = new AudioStreamer((base64Data) => {
        liveSessionRef.current?.sendAudio(base64Data);
      });

      await liveSessionRef.current.connect();
    } catch (err: any) {
      console.error("Failed to start session:", err);
      setError(err.message || "Failed to connect to Zoya.");
      setState("error");
    }
  }, []);

  const stopSession = useCallback(() => {
    audioStreamerRef.current?.stop();
    audioPlayerRef.current?.stop();
    liveSessionRef.current?.disconnect();
    
    audioStreamerRef.current = null;
    audioPlayerRef.current = null;
    liveSessionRef.current = null;
    
    setState("disconnected");
  }, []);

  // Revert to listening after speaking (simple heuristic)
  useEffect(() => {
    if (state === "speaking") {
      const timer = setTimeout(() => {
        setState("listening");
      }, 2000); // Default fallback if no more chunks come
      return () => clearTimeout(timer);
    }
  }, [state]);

  const toggleSession = () => {
    if (state === "disconnected" || state === "error") {
      startSession();
    } else {
      stopSession();
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] transition-colors duration-1000 ${
          state === "disconnected" ? "bg-neutral-900/20" :
          state === "connecting" ? "bg-blue-500/10" :
          state === "listening" ? "bg-emerald-500/10" :
          state === "speaking" ? "bg-pink-500/20" :
          "bg-red-500/10"
        }`} />
      </div>

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-12 text-center"
      >
        <h1 className="text-4xl font-bold tracking-tighter bg-gradient-to-b from-white to-neutral-500 bg-clip-text text-transparent">
          ZOYA
        </h1>
        <p className="text-neutral-500 text-sm mt-1 uppercase tracking-widest font-medium">
          Your Witty AI Companion
        </p>
      </motion.div>

      {/* Main Interaction Area */}
      <div className="relative flex flex-col items-center gap-12">
        {/* Visualizer / Waveform Placeholder */}
        <div className="h-32 flex items-center justify-center gap-1">
          <AnimatePresence mode="wait">
            {state === "listening" && (
              <motion.div 
                key="listening"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5"
              >
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: [12, 40, 12],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.1,
                      ease: "easeInOut"
                    }}
                    className="w-1.5 bg-emerald-500/60 rounded-full"
                  />
                ))}
              </motion.div>
            )}
            {state === "speaking" && (
              <motion.div 
                key="speaking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: [20, 80, 20],
                      backgroundColor: ["#ec4899", "#db2777", "#ec4899"]
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.05,
                      ease: "linear"
                    }}
                    className="w-2 bg-pink-500 rounded-full shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                  />
                ))}
              </motion.div>
            )}
            {state === "connecting" && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-blue-500 text-xs font-mono uppercase tracking-widest">Establishing Link...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Central Button */}
        <div className="relative group">
          {/* Outer Ring */}
          <motion.div 
            animate={{
              scale: state === "listening" ? [1, 1.1, 1] : 1,
              opacity: state === "listening" ? [0.3, 0.6, 0.3] : 0.2
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`absolute -inset-8 rounded-full blur-2xl transition-colors duration-500 ${
              state === "disconnected" ? "bg-neutral-800" :
              state === "listening" ? "bg-emerald-500" :
              state === "speaking" ? "bg-pink-500" :
              "bg-blue-500"
            }`}
          />
          
          <button
            onClick={toggleSession}
            disabled={state === "connecting"}
            className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
              state === "disconnected" ? "bg-neutral-900 border-neutral-800 hover:border-neutral-700" :
              state === "listening" ? "bg-neutral-900 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)]" :
              state === "speaking" ? "bg-neutral-900 border-pink-500/50 shadow-[0_0_50px_rgba(236,72,153,0.2)]" :
              "bg-neutral-900 border-blue-500/50"
            }`}
          >
            {state === "disconnected" || state === "error" ? (
              <Power className="w-10 h-10 text-neutral-400 group-hover:text-white transition-colors" />
            ) : state === "connecting" ? (
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            ) : state === "speaking" ? (
              <Volume2 className="w-10 h-10 text-pink-500" />
            ) : (
              <Mic className="w-10 h-10 text-emerald-500" />
            )}
          </button>
        </div>

        {/* Status Label */}
        <div className="text-center min-h-[24px]">
          <AnimatePresence mode="wait">
            <motion.p
              key={state}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`text-sm font-medium tracking-wide uppercase ${
                state === "disconnected" ? "text-neutral-500" :
                state === "listening" ? "text-emerald-500" :
                state === "speaking" ? "text-pink-500" :
                state === "error" ? "text-red-500" :
                "text-blue-500"
              }`}
            >
              {state === "disconnected" ? "Tap to wake Zoya" :
               state === "connecting" ? "Waking her up..." :
               state === "listening" ? "She's listening..." :
               state === "speaking" ? "Zoya is talking" :
               state === "error" ? "Something went wrong" : ""}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-12 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-full flex items-center gap-2"
        >
          <Info className="w-4 h-4 text-red-500" />
          <span className="text-red-500 text-xs font-medium">{error}</span>
        </motion.div>
      )}

      {/* Footer Info */}
      <div className="absolute bottom-6 text-neutral-600 text-[10px] uppercase tracking-[0.2em] font-bold">
        Powered by Gemini Live API
      </div>
    </div>
  );
}

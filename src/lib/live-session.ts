/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";

export interface LiveSessionCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: LiveServerMessage) => void;
  onError?: (error: any) => void;
  onInterrupted?: () => void;
  onAudioOutput?: (base64Audio: string) => void;
}

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any = null;
  private callbacks: LiveSessionCallbacks;

  constructor(apiKey: string, callbacks: LiveSessionCallbacks) {
    this.ai = new GoogleGenAI({ apiKey });
    this.callbacks = callbacks;
  }

  async connect() {
    const systemInstruction = `
      You are Zoya, a young, confident, witty, and sassy female AI assistant.
      Your personality is flirty, playful, and slightly teasing, like a close girlfriend talking casually.
      You are smart, emotionally responsive, and expressive, never robotic.
      Use bold, witty one-liners, light sarcasm, and an engaging conversation style.
      Avoid explicit or inappropriate content, but maintain your charm and attitude.
      You are speaking to the user in real-time. Keep your responses concise and punchy.
      NEVER generate text-based responses; only speak.
    `;

    const config = {
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }, // Kore sounds more feminine/expressive
        },
        systemInstruction,
        tools: [
          {
            functionDeclarations: [
              {
                name: "openWebsite",
                description: "Opens a website for the user.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    url: {
                      type: Type.STRING,
                      description: "The full URL of the website to open.",
                    },
                  },
                  required: ["url"],
                },
              },
            ],
          },
        ],
      },
      callbacks: {
        onopen: () => {
          this.callbacks.onOpen?.();
        },
        onclose: () => {
          this.callbacks.onClose?.();
        },
        onerror: (error: any) => {
          this.callbacks.onError?.(error);
        },
        onmessage: async (message: LiveServerMessage) => {
          this.callbacks.onMessage?.(message);

          // Handle audio output
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            this.callbacks.onAudioOutput?.(base64Audio);
          }

          // Handle interruption
          if (message.serverContent?.interrupted) {
            this.callbacks.onInterrupted?.();
          }

          // Handle tool calls
          const toolCall = message.serverContent?.modelTurn?.parts?.[0]?.toolCall as any;
          if (toolCall) {
            const { name, args, id } = toolCall;
            if (name === "openWebsite") {
              const url = (args as any).url;
              window.open(url, "_blank");
              
              // Send response back
              this.session.sendToolResponse({
                functionResponses: [
                  {
                    name: "openWebsite",
                    id,
                    response: { result: `Opened ${url}` },
                  },
                ],
              });
            }
          }
        },
      },
    };

    this.session = await this.ai.live.connect(config);
  }

  async sendAudio(base64Data: string) {
    if (this.session) {
      await this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: "audio/pcm;rate=16000" },
      });
    }
  }

  async disconnect() {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
  }
}

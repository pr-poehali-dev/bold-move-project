import { useState, useRef } from "react";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default function useVoiceInput(setInput: (value: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const toggleVoice = () => {
    if (isListening) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      r?.stop();
      setIsListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Ваш браузер не поддерживает голосовой ввод. Используйте Chrome.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(transcript);
    };

    // При continuous=true перезапускаем если остановился не по кнопке
    recognition.onend = () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { setIsListening(false); }
      }
    };
    recognition.onerror = (e) => {
      console.error("[Voice] error:", e.error);
      if (e.error === "not-allowed") {
        alert("Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.");
      }
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.error("[Voice] start failed:", e);
    }
  };

  const hasSpeech = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  return { isListening, hasSpeech, toggleVoice };
}
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
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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
    // На мобильных continuous не работает — используем разовый режим
    recognition.continuous = !isMobile;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = "";
      // Берём только результаты начиная с resultIndex — только новые
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput((prev: string) => {
        // Если interim — заменяем последнее слово, если final — добавляем
        if (e.results[e.results.length - 1]?.isFinal) {
          return (prev + " " + transcript).trim();
        }
        return transcript;
      });
    };

    recognition.onend = () => {
      if (!recognitionRef.current) return;
      // На мобильных НЕ перезапускаем — один раз сказал, поле заполнено
      if (!isMobile) {
        try { recognitionRef.current.start(); } catch { setIsListening(false); }
      } else {
        setIsListening(false);
        recognitionRef.current = null;
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.error("[Voice] error:", e.error);
      if (e.error === "not-allowed") {
        alert("Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.");
        recognitionRef.current = null;
      }
      // aborted / no-speech — не сбрасываем, просто ждём onend для перезапуска
      if (e.error !== "aborted" && e.error !== "no-speech") {
        setIsListening(false);
        recognitionRef.current = null;
      }
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
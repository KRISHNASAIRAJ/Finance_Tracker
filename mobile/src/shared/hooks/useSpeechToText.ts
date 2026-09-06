/**
 * useSpeechToText — shared hook for speech-to-text (speech recognition).
 * Uses expo-speech-recognition with English (en-IN preferred, falls back en-US).
 * Handles permission request, start/stop, partial + final transcript.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionResultEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';

export interface SpeechToTextState {
  /** True while the mic is live */
  listening: boolean;
  /** Live partial transcript while speaking */
  partial: string;
  /** Final transcript of the last utterance (set when recognition finishes) */
  result: string | null;
  /** Error message suitable for display, or null */
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Clear result/partial/error (call after consuming) */
  reset: () => void;
}

export function useSpeechToText(lang = 'en-IN'): SpeechToTextState {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const startedRef = useRef(false);

  // Detect unsupported devices (e.g. Android without a recognition service)
  useEffect(() => {
    ExpoSpeechRecognitionModule.getStateAsync?.()
      .then((state: string) => setAvailable(state !== 'unavailable'))
      .catch(() => setAvailable(true));
  }, []);

  useSpeechRecognitionEvent('start', () => {
    startedRef.current = true;
    setPartial('');
    setResult(null);
    setError(null);
    setListening(true);
  });

  useSpeechRecognitionEvent('result', (e: ExpoSpeechRecognitionResultEvent) => {
    const transcript = e.results?.[0]?.transcript ?? '';
    if (e.isFinal) {
      setResult(transcript.trim() || null);
      setPartial('');
    } else {
      setPartial(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (e: ExpoSpeechRecognitionErrorEvent) => {
    startedRef.current = false;
    setListening(false);
    setPartial('');
    setError(friendlyError(e.error, e.message));
  });

  useSpeechRecognitionEvent('end', () => {
    startedRef.current = false;
    setListening(false);
    setPartial('');
  });

  const start = useCallback(async () => {
    if (listening || startedRef.current) return;
    setError(null);
    setResult(null);
    setPartial('');
    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms?.granted) {
        setError('Microphone / speech permission denied');
        return;
      }
      if (!available) {
        setError('Speech recognition unavailable on this device');
        return;
      }
      startedRef.current = true;
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (e: any) {
      startedRef.current = false;
      setError(e?.message ? `Voice error: ${e.message}` : 'Voice input failed');
    }
  }, [listening, available, lang]);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      startedRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setPartial('');
    setError(null);
  }, []);

  return { listening, partial, result, error, start, stop, reset };
}

function friendlyError(code: string, message?: string): string {
  switch (code) {
    case 'no-speech':
      return 'No speech detected — try again';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission needed';
    case 'audio-capture':
      return 'No microphone found';
    case 'busy':
      return 'Recognizer busy — try again';
    case 'language-not-supported':
      return 'Language not supported';
    case 'aborted':
      return ''; // user cancelled — silent
    default:
      return message ? `Voice error: ${message}` : 'Voice input failed';
  }
}

export type { ExpoSpeechRecognitionResultEvent, ExpoSpeechRecognitionErrorEvent };

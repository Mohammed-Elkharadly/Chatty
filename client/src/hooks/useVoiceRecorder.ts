import { useCallback, useEffect, useRef, useState } from "react";

const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    audioContextRef.current?.close();
    audioContextRef.current = null;

    setIsRecording(false);
    setSeconds(0);
    setAudioLevel(0);
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    try {
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      streamRef.current = stream;
      recorderRef.current = recorder;

      // Start recording immediately.
      recorder.start();
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;

      const data = new Uint8Array(analyser.fftSize);
      let lastUpdate = 0;

      const updateWaveform = (time: number) => {
        analyser.getByteTimeDomainData(data);

        // Measure the microphone's volume.
        let sum = 0;

        for (const value of data) {
          const normalized = (value - 128) / 128;
          sum += normalized * normalized;
        }

        const volume = Math.sqrt(sum / data.length);

        // Update React state at most 20 times per second.
        if (time - lastUpdate >= 50) {
          setAudioLevel(Math.min(1, volume * 5));
          lastUpdate = time;
        }

        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };

      animationFrameRef.current = requestAnimationFrame(updateWaveform);

      setIsRecording(true);
      setSeconds(0);

      timerRef.current = window.setInterval(() => {
        setSeconds((second) => second + 1);
      }, 1000);
    } catch (error) {
      cleanup();
      stream.getTracks().forEach((t) => t.stop());
      throw error;
    }
  }, [cleanup]);

  const stop = useCallback(
    () =>
      new Promise<File | null>((resolve, reject) => {
        const recorder = recorderRef.current;

        if (!recorder || recorder.state === "inactive") {
          resolve(null);
          return;
        }

        recorder.onstop = () => {
          const type = recorder.mimeType || "audio/webm";
          const extension = type.split("/")[1]?.split(";")[0] || "webm";
          const blob = new Blob(chunksRef.current, { type });

          cleanup();

          if (blob.size === 0) {
            resolve(null);
            return;
          }

          resolve(
            new File([blob], `voice-${Date.now()}.${extension}`, { type }),
          );
        };

        recorder.onerror = () => {
          cleanup();
          reject(new Error("Audio recording failed"));
        };

        recorder.stop();
      }),
    [cleanup],
  );

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    cleanup();
  }, [cleanup]);

  useEffect(() => cancel, [cancel]);

  return { isRecording, seconds, start, stop, cancel, audioLevel };
};

export default useVoiceRecorder;

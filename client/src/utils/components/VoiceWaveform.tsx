
interface VoiceWaveformProps {
  level: number;
}

const VoiceWaveform = ({ level }: VoiceWaveformProps) => {
  const bars = [0.45, 0.8, 0.6, 1, 0.7, 0.9, 0.5, 0.75, 0.4];

  return (
    <div
      className="flex h-10 flex-1 items-center justify-center gap-1"
      role="img"
      aria-label="Microphone audio waveform"
    >
      {bars.map((factor, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-red-500"
          style={{
            height: `${Math.max(4, level * 36 * factor)}px`,
            transition: "height 60ms linear",
          }}
        />
      ))}
    </div>
  );
};

export default VoiceWaveform;

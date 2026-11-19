export default function AudioWaveform({ active = false, label = '' }) {
  if (!active) return null;

  return (
    <div className="audio-waveform-container" role="status" aria-label={label || 'Audio active'}>
      <div className="waveform-bars">
        <span className="waveform-bar bar-1" />
        <span className="waveform-bar bar-2" />
        <span className="waveform-bar bar-3" />
        <span className="waveform-bar bar-4" />
        <span className="waveform-bar bar-5" />
        <span className="waveform-bar bar-6" />
        <span className="waveform-bar bar-7" />
        <span className="waveform-bar bar-8" />
      </div>
      {label && <span className="waveform-label">{label}</span>}
    </div>
  );
}

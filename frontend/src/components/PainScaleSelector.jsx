const PAIN_LEVELS = [
  { score: 0, en: 'No Hurt', hi: 'कोई दर्द नहीं', color: '#10b981', bg: '#ecfdf5', emoji: '😄' },
  { score: 2, en: 'Hurts Little Bit', hi: 'हल्का दर्द', color: '#14b8a6', bg: '#f0fdfa', emoji: '🙂' },
  { score: 4, en: 'Hurts Little More', hi: 'थोड़ा और दर्द', color: '#eab308', bg: '#fefce8', emoji: '😐' },
  { score: 6, en: 'Hurts Even More', hi: 'काफ़ी दर्द', color: '#f97316', bg: '#fff7ed', emoji: '🙁' },
  { score: 8, en: 'Hurts Whole Lot', hi: 'बहुत तेज़ दर्द', color: '#ef4444', bg: '#fef2f2', emoji: '😣' },
  { score: 10, en: 'Hurts Worst', hi: 'असहनीय दर्द', color: '#be123c', bg: '#fff1f2', emoji: '😭' },
];

export default function PainScaleSelector({ language = 'en', value = 5, onChange }) {
  const isHindi = language === 'hi';
  const numValue = Number(value ?? 5);

  const getActiveLevel = (val) => {
    if (val <= 1) return PAIN_LEVELS[0];
    if (val <= 3) return PAIN_LEVELS[1];
    if (val <= 5) return PAIN_LEVELS[2];
    if (val <= 7) return PAIN_LEVELS[3];
    if (val <= 9) return PAIN_LEVELS[4];
    return PAIN_LEVELS[5];
  };

  const activeLevel = getActiveLevel(numValue);

  return (
    <div className="pain-scale-container">
      {/* Visual Face Cards */}
      <div className="pain-faces-grid">
        {PAIN_LEVELS.map((item) => {
          const isSelected = activeLevel.score === item.score;
          return (
            <button
              key={item.score}
              type="button"
              className={`pain-face-card ${isSelected ? 'active-face' : ''}`}
              style={{
                borderColor: isSelected ? item.color : '#e2e8f0',
                backgroundColor: isSelected ? item.bg : '#ffffff',
                boxShadow: isSelected ? `0 8px 20px ${item.color}25` : 'none',
              }}
              onClick={() => onChange(item.score)}
            >
              <span className="pain-emoji" role="img" aria-label={item.en}>
                {item.emoji}
              </span>
              <strong className="pain-score-badge" style={{ color: item.color }}>
                {item.score}
              </strong>
              <small className="pain-desc">{isHindi ? item.hi : item.en}</small>
            </button>
          );
        })}
      </div>

      {/* Interactive Range Slider */}
      <div className="pain-slider-wrap">
        <div className="pain-slider-header">
          <span>{isHindi ? '0 = कोई तकलीफ़ नहीं' : '0 = Mild / No pain'}</span>
          <div
            className="pain-active-indicator"
            style={{ color: activeLevel.color, backgroundColor: activeLevel.bg }}
          >
            <span className="pain-current-score">{numValue} / 10</span>
            <span className="pain-current-text">{isHindi ? activeLevel.hi : activeLevel.en}</span>
          </div>
          <span>{isHindi ? '10 = अत्यधिक असहनीय' : '10 = Severe pain'}</span>
        </div>

        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={numValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="custom-pain-slider"
          style={{
            accentColor: activeLevel.color,
          }}
          aria-label="Pain severity from 0 to 10"
        />

        <div className="pain-slider-ticks">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => (
            <span
              key={t}
              className={`pain-tick ${t === numValue ? 'active-tick' : ''}`}
              onClick={() => onChange(t)}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';

const BODY_REGIONS = [
  {
    id: 'head',
    labelEn: 'Head & Face',
    labelHi: 'सिर और चेहरा',
    subEn: ['Forehead', 'Temples', 'Behind eyes', 'Scalp / Entire head', 'Jaw / Teeth'],
    subHi: ['माथा', 'कनपटी', 'आँखों के पीछे', 'पूरा सिर', 'जबड़ा / दाँत'],
    svgX: 100,
    svgY: 32,
    radius: 20,
  },
  {
    id: 'throat',
    labelEn: 'Neck & Throat',
    labelHi: 'गर्दन और गला',
    subEn: ['Throat / Difficulty swallowing', 'Front of neck', 'Back of neck / Cervical', 'Sides of neck'],
    subHi: ['गला / निगलने में तकलीफ़', 'गर्दन का अगला हिस्सा', 'गर्दन का पिछला हिस्सा', 'गर्दन के दोनों ओर'],
    svgX: 100,
    svgY: 64,
    radius: 12,
  },
  {
    id: 'chest',
    labelEn: 'Chest & Lungs',
    labelHi: 'छाती और फेफड़े',
    subEn: ['Center chest heaviness', 'Left side chest', 'Right side chest', 'Rib cage / Side'],
    subHi: ['छाती के बीच में भारीपन', 'बाईं तरफ छाती', 'दाईं तरफ छाती', 'पसलियों में दर्द'],
    svgX: 100,
    svgY: 102,
    radius: 22,
  },
  {
    id: 'abdomen',
    labelEn: 'Abdomen & Stomach',
    labelHi: 'पेट और पाचन',
    subEn: ['Upper stomach / Acidity', 'Around navel', 'Lower right abdomen', 'Lower left abdomen', 'General cramps'],
    subHi: ['ऊपरी पेट / गैस', 'नाभि के पास', 'निचले दाएं पेट', 'निचले बाएं पेट', 'पूरे पेट में मरोड़'],
    svgX: 100,
    svgY: 148,
    radius: 22,
  },
  {
    id: 'pelvis',
    labelEn: 'Pelvis & Hips',
    labelHi: 'श्रोणि और कूल्हे',
    subEn: ['Lower pelvis', 'Right hip joint', 'Left hip joint', 'Groin area'],
    subHi: ['निचला पेल्विस', 'दायां कूल्हा', 'बायां कूल्हा', 'कमर जोड़'],
    svgX: 100,
    svgY: 188,
    radius: 18,
  },
  {
    id: 'arms',
    labelEn: 'Arms & Shoulders',
    labelHi: 'कंधे और हाथ',
    subEn: ['Right shoulder', 'Left shoulder', 'Right arm / Elbow', 'Left arm / Elbow', 'Wrists / Hands'],
    subHi: ['दायां कंधा', 'बायां कंधा', 'दायां हाथ / कोहनी', 'बायां हाथ / कोहनी', 'कलाई / हाथ'],
    svgX: 50,
    svgY: 110,
    radius: 16,
  },
  {
    id: 'back',
    labelEn: 'Back & Spine',
    labelHi: 'पीठ और रीढ़',
    subEn: ['Upper back between shoulders', 'Mid back', 'Lower back / Lumbar', 'Tailbone'],
    subHi: ['ऊपरी पीठ', 'मध्य पीठ', 'निचली पीठ / कमर दर्द', 'रीढ़ का निचला हिस्सा'],
    svgX: 150,
    svgY: 110,
    radius: 16,
  },
  {
    id: 'legs',
    labelEn: 'Knees & Legs',
    labelHi: 'घुटने और पैर',
    subEn: ['Both knees (bilateral)', 'Right knee joint', 'Left knee joint', 'Calf muscles / Shin', 'Ankle & Foot'],
    subHi: ['दोनों घुटने', 'दायां घुटना', 'बायां घुटना', 'पिंडलियां', 'टखना और तलवा'],
    svgX: 100,
    svgY: 245,
    radius: 24,
  },
  {
    id: 'generalized',
    labelEn: 'Whole Body / Skin',
    labelHi: 'पूरा शरीर / त्वचा',
    subEn: ['Generalized body ache', 'Skin rash / Itching all over', 'Joint stiffness throughout'],
    subHi: ['पूरे शरीर में दर्द', 'त्वचा में खुजली / चकत्ते', 'सभी जोड़ों में अकड़न'],
    svgX: 100,
    svgY: 305,
    radius: 14,
  },
];

export default function BodyMapSelector({ language = 'en', value = '', onChange }) {
  const isHindi = language === 'hi';
  const [selectedRegionId, setSelectedRegionId] = useState(() => {
    const match = BODY_REGIONS.find((r) =>
      value && (value.toLowerCase().includes(r.labelEn.toLowerCase()) || value.includes(r.labelHi))
    );
    return match ? match.id : 'head';
  });

  const selectedRegion = BODY_REGIONS.find((r) => r.id === selectedRegionId) || BODY_REGIONS[0];

  const handleSelectRegion = (region) => {
    setSelectedRegionId(region.id);
    const primaryName = isHindi ? region.labelHi : region.labelEn;
    onChange(primaryName);
  };

  const handleSelectSub = (sub) => {
    const primaryName = isHindi ? selectedRegion.labelHi : selectedRegion.labelEn;
    const combined = `${primaryName}: ${sub}`;
    onChange(combined);
  };

  return (
    <div className="bodymap-wrapper">
      <div className="bodymap-instructions">
        <span className="bodymap-hint">
          <Sparkles size={14} />
          {isHindi
            ? 'शरीर के उस हिस्से पर टैप करें जहाँ तकलीफ़ है:'
            : 'Tap the body part where you feel discomfort:'}
        </span>
      </div>

      <div className="bodymap-split">
        {/* Left Side: Interactive Anatomical Graphic */}
        <div className="bodymap-canvas-card">
          <svg
            className="bodymap-svg"
            viewBox="0 0 200 330"
            preserveAspectRatio="xMidYMid meet"
            aria-label="Human anatomy body map"
          >
            <defs>
              <linearGradient id="bodyBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e2edf5" />
                <stop offset="100%" stopColor="#cbdbe8" />
              </linearGradient>
              <linearGradient id="activeRegionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#0d9488" />
              </linearGradient>
              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0d9488" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Stylized Human Body Silhouette */}
            <g className="body-silhouette" fill="url(#bodyBaseGrad)" stroke="#b2c6d7" strokeWidth="1.2">
              {/* Head */}
              <circle cx="100" cy="32" r="18" />
              {/* Neck */}
              <rect x="94" y="49" width="12" height="14" rx="3" />
              {/* Torso & Shoulders */}
              <path d="M 68 64 C 82 58, 118 58, 132 64 C 144 70, 142 110, 134 140 C 130 156, 128 175, 126 195 L 74 195 C 72 175, 70 156, 66 140 C 58 110, 56 70, 68 64 Z" />
              {/* Left Arm (viewer right) */}
              <path d="M 132 66 C 145 78, 150 110, 154 135 C 156 148, 158 165, 155 178 C 153 182, 147 182, 146 176 C 144 162, 142 135, 136 112" />
              {/* Right Arm (viewer left) */}
              <path d="M 68 66 C 55 78, 50 110, 46 135 C 44 148, 42 165, 45 178 C 47 182, 53 182, 54 176 C 56 162, 58 135, 64 112" />
              {/* Legs */}
              <path d="M 76 195 L 74 250 C 73 270, 72 290, 68 310 C 67 314, 76 316, 78 312 C 84 285, 87 255, 90 220 L 96 198" />
              <path d="M 124 195 L 126 250 C 127 270, 128 290, 132 310 C 133 314, 124 316, 122 312 C 116 285, 113 255, 110 220 L 104 198" />
            </g>

            {/* Clickable hotspots */}
            {BODY_REGIONS.slice(0, 8).map((region) => {
              const isSelected = selectedRegionId === region.id;
              return (
                <g
                  key={region.id}
                  className={`bodymap-hotspot ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelectRegion(region)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={region.svgX}
                    cy={region.svgY}
                    r={region.radius}
                    fill={isSelected ? 'url(#activeRegionGrad)' : 'rgba(20, 184, 166, 0.15)'}
                    stroke={isSelected ? '#0f766e' : '#14b8a6'}
                    strokeWidth={isSelected ? '2.5' : '1.2'}
                    strokeDasharray={isSelected ? 'none' : '3 3'}
                    filter={isSelected ? 'url(#glowEffect)' : 'none'}
                  />
                  <circle
                    cx={region.svgX}
                    cy={region.svgY}
                    r="4"
                    fill={isSelected ? '#ffffff' : '#0d9488'}
                  />
                </g>
              );
            })}
          </svg>
          <div className="bodymap-active-badge">
            <span className="live-dot" />
            <b>{isHindi ? selectedRegion.labelHi : selectedRegion.labelEn}</b>
          </div>
        </div>

        {/* Right Side: Quick Sub-regions and Chips */}
        <div className="bodymap-regions-list">
          <div className="bodymap-category-pills">
            {BODY_REGIONS.map((region) => {
              const isSelected = selectedRegionId === region.id;
              return (
                <button
                  key={region.id}
                  type="button"
                  className={`bodymap-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectRegion(region)}
                >
                  {isSelected && <Check size={13} className="chip-check" />}
                  {isHindi ? region.labelHi : region.labelEn}
                </button>
              );
            })}
          </div>

          <div className="bodymap-sub-section">
            <span className="bodymap-sub-title">
              {isHindi ? 'विस्तृत स्थान चुनें (वैकल्पिक):' : 'Specific area (tap to add detail):'}
            </span>
            <div className="bodymap-sub-chips">
              {(isHindi ? selectedRegion.subHi : selectedRegion.subEn).map((sub) => {
                const isCurrent = value && value.includes(sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    className={`bodymap-sub-chip ${isCurrent ? 'selected-sub' : ''}`}
                    onClick={() => handleSelectSub(sub)}
                  >
                    {isCurrent && <Check size={12} />}
                    {sub}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

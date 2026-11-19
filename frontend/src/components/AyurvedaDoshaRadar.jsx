import { Sparkles, Wind, Flame, Droplets } from 'lucide-react';

const DOSHA_CONFIG = {
  vata: {
    nameEn: 'Vata (वात)',
    elements: 'Ether + Air (आकाश + वायु)',
    attributes: 'Dry, light, cold, rough, mobile',
    color: '#0284c7', // Sky blue
    icon: Wind,
  },
  pitta: {
    nameEn: 'Pitta (पित्त)',
    elements: 'Fire + Water (अग्नि + जल)',
    attributes: 'Hot, sharp, light, liquid, spreading',
    color: '#ea580c', // Orange Fire
    icon: Flame,
  },
  kapha: {
    nameEn: 'Kapha (कफ)',
    elements: 'Water + Earth (जल + पृथ्वी)',
    attributes: 'Heavy, slow, cool, oily, smooth, dense',
    color: '#0d9488', // Emerald Earth/Water
    icon: Droplets,
  },
};

export default function AyurvedaDoshaRadar({ prakriti = 'not_assessed', vikriti = 'not_assessed' }) {
  // Compute approximate % representation based on selected prakriti
  const getDoshaPercentages = (type) => {
    switch (type) {
      case 'vata': return { vata: 65, pitta: 20, kapha: 15 };
      case 'pitta': return { vata: 20, pitta: 65, kapha: 15 };
      case 'kapha': return { vata: 15, pitta: 20, kapha: 65 };
      case 'vata_pitta': return { vata: 45, pitta: 45, kapha: 10 };
      case 'vata_kapha': return { vata: 45, pitta: 10, kapha: 45 };
      case 'pitta_kapha': return { vata: 10, pitta: 45, kapha: 45 };
      case 'sama': return { vata: 33, pitta: 33, kapha: 34 };
      default: return { vata: 33, pitta: 33, kapha: 34 };
    }
  };

  const prakritiValues = getDoshaPercentages(prakriti);
  const vikritiValues = getDoshaPercentages(vikriti);

  return (
    <div className="ayurveda-radar-card">
      <div className="radar-head">
        <Sparkles size={16} className="text-teal" />
        <div>
          <b>Tri-Dosha Balance Visualization</b>
          <small>Fundamental biological energies governing physical and mental processes</small>
        </div>
      </div>

      <div className="dosha-gauges-grid">
        {/* Vata Gauge */}
        <div className="dosha-gauge-item">
          <div className="gauge-header">
            <span className="gauge-icon" style={{ color: DOSHA_CONFIG.vata.color, backgroundColor: `${DOSHA_CONFIG.vata.color}15` }}>
              <Wind size={15} />
            </span>
            <div>
              <strong>{DOSHA_CONFIG.vata.nameEn}</strong>
              <small>{DOSHA_CONFIG.vata.elements}</small>
            </div>
            <span className="gauge-percent" style={{ color: DOSHA_CONFIG.vata.color }}>
              {prakritiValues.vata}%
            </span>
          </div>

          <div className="gauge-bar-track">
            <div
              className="gauge-bar-fill"
              style={{
                width: `${prakritiValues.vata}%`,
                backgroundColor: DOSHA_CONFIG.vata.color,
              }}
            />
          </div>
          <span className="gauge-foot">{DOSHA_CONFIG.vata.attributes}</span>
        </div>

        {/* Pitta Gauge */}
        <div className="dosha-gauge-item">
          <div className="gauge-header">
            <span className="gauge-icon" style={{ color: DOSHA_CONFIG.pitta.color, backgroundColor: `${DOSHA_CONFIG.pitta.color}15` }}>
              <Flame size={15} />
            </span>
            <div>
              <strong>{DOSHA_CONFIG.pitta.nameEn}</strong>
              <small>{DOSHA_CONFIG.pitta.elements}</small>
            </div>
            <span className="gauge-percent" style={{ color: DOSHA_CONFIG.pitta.color }}>
              {prakritiValues.pitta}%
            </span>
          </div>

          <div className="gauge-bar-track">
            <div
              className="gauge-bar-fill"
              style={{
                width: `${prakritiValues.pitta}%`,
                backgroundColor: DOSHA_CONFIG.pitta.color,
              }}
            />
          </div>
          <span className="gauge-foot">{DOSHA_CONFIG.pitta.attributes}</span>
        </div>

        {/* Kapha Gauge */}
        <div className="dosha-gauge-item">
          <div className="gauge-header">
            <span className="gauge-icon" style={{ color: DOSHA_CONFIG.kapha.color, backgroundColor: `${DOSHA_CONFIG.kapha.color}15` }}>
              <Droplets size={15} />
            </span>
            <div>
              <strong>{DOSHA_CONFIG.kapha.nameEn}</strong>
              <small>{DOSHA_CONFIG.kapha.elements}</small>
            </div>
            <span className="gauge-percent" style={{ color: DOSHA_CONFIG.kapha.color }}>
              {prakritiValues.kapha}%
            </span>
          </div>

          <div className="gauge-bar-track">
            <div
              className="gauge-bar-fill"
              style={{
                width: `${prakritiValues.kapha}%`,
                backgroundColor: DOSHA_CONFIG.kapha.color,
              }}
            />
          </div>
          <span className="gauge-foot">{DOSHA_CONFIG.kapha.attributes}</span>
        </div>
      </div>

      <div className="dosha-comparison-notes">
        <div className="comparison-badge">
          <span>Natural Baseline (Prakriti):</span>
          <b>{prakriti.replaceAll('_', ' ').toUpperCase()}</b>
        </div>
        <div className="comparison-badge">
          <span>Active Imbalance (Vikriti):</span>
          <b className={vikriti !== 'not_assessed' && vikriti !== prakriti ? 'text-amber' : ''}>
            {vikriti.replaceAll('_', ' ').toUpperCase()}
          </b>
        </div>
      </div>
    </div>
  );
}

/**
 * Drug-Drug and Herb-Drug Interaction Warning Service.
 * Evaluates pairs of medications for known critical, major, and moderate interactions.
 * Covers conventional clinical pharmaceuticals and AYUSH herbal formulations.
 */

const KNOWN_INTERACTIONS = [
  // Anticoagulant + Antiplatelet / NSAID
  {
    drugs: ['aspirin', 'warfarin'],
    severity: 'critical',
    description: 'Concurrent use of Aspirin and Warfarin significantly increases the risk of severe gastrointestinal and systemic bleeding.',
    actionRequired: 'Avoid combination unless strictly monitored; consider gastroprotection and adjust INR targets.',
  },
  {
    drugs: ['ibuprofen', 'warfarin'],
    severity: 'critical',
    description: 'Ibuprofen competitively inhibits platelet aggregation and may cause gastric mucosal damage, severely elevating bleeding risk with Warfarin.',
    actionRequired: 'Avoid NSAIDs; use alternative analgesics like paracetamol if appropriate.',
  },
  {
    drugs: ['aspirin', 'ibuprofen'],
    severity: 'major',
    description: 'Ibuprofen may interfere with the cardioprotective antiplatelet effect of low-dose Aspirin and increases GI ulceration risk.',
    actionRequired: 'Separate administration times or use alternative pain management.',
  },
  {
    drugs: ['clopidogrel', 'aspirin'],
    severity: 'moderate',
    description: 'Dual antiplatelet therapy increases bleeding risks; requires close clinical supervision.',
    actionRequired: 'Monitor for clinical signs of active bleeding.',
  },

  // Cardiovascular & Hypertensive interactions
  {
    drugs: ['sildenafil', 'nitroglycerin'],
    severity: 'critical',
    description: 'Co-administration causes severe, potentially fatal vasodilation and hypotension.',
    actionRequired: 'Strictly contraindicated. Do not administer nitrates within 24–48 hours of PDE5 inhibitors.',
  },
  {
    drugs: ['tadalafil', 'nitroglycerin'],
    severity: 'critical',
    description: 'Co-administration causes profound and potentially fatal hypotension.',
    actionRequired: 'Strictly contraindicated.',
  },
  {
    drugs: ['spironolactone', 'enalapril'],
    severity: 'critical',
    description: 'Combined potassium-sparing diuretic and ACE inhibitor therapy significantly increases risk of hyperkalemia.',
    actionRequired: 'Monitor serum potassium and renal function closely.',
  },
  {
    drugs: ['spironolactone', 'lisinopril'],
    severity: 'critical',
    description: 'Risk of life-threatening hyperkalemia when combining ACE inhibitors with potassium-sparing diuretics.',
    actionRequired: 'Regular serum potassium monitoring required.',
  },

  // Metabolic & Glycemic interactions
  {
    drugs: ['metformin', 'contrast'],
    severity: 'major',
    description: 'Iodinated radiocontrast with Metformin may precipitate lactic acidosis in cases of renal impairment.',
    actionRequired: 'Withhold metformin 48 hours prior to and following contrast administration.',
  },

  // Central Nervous System & Serotonin Syndrome
  {
    drugs: ['tramadol', 'fluoxetine'],
    severity: 'critical',
    description: 'Risk of Serotonin Syndrome and increased seizure risk.',
    actionRequired: 'Avoid combination; monitor for agitation, tremor, hyperthermia.',
  },
  {
    drugs: ['tramadol', 'sertraline'],
    severity: 'critical',
    description: 'Concomitant administration elevates risk of Serotonin Syndrome.',
    actionRequired: 'Avoid or closely monitor neuromuscular and autonomic symptoms.',
  },

  // Antibiotics & Chelation
  {
    drugs: ['ciprofloxacin', 'antacid'],
    severity: 'moderate',
    description: 'Divalent and trivalent cations in antacids bind Ciprofloxacin, severely reducing bioavailability.',
    actionRequired: 'Administer Ciprofloxacin at least 2 hours before or 6 hours after antacids.',
  },
  {
    drugs: ['levofloxacin', 'iron'],
    severity: 'moderate',
    description: 'Iron supplements chelate fluoroquinolones, substantially reducing systemic antibiotic absorption.',
    actionRequired: 'Separate administration by at least 2 to 4 hours.',
  },

  // AYUSH Herb-Drug Interactions
  {
    drugs: ['ashwagandha', 'diazepam'],
    severity: 'moderate',
    description: 'Ashwagandha has GABA-mimetic activity and may potentiate sedative effects of benzodiazepines.',
    actionRequired: 'Monitor for excessive drowsiness, sedation, or impaired psychomotor function.',
  },
  {
    drugs: ['ashwagandha', 'alprazolam'],
    severity: 'moderate',
    description: 'Additive central nervous system depression when combining Ashwagandha with sedatives.',
    actionRequired: 'Adjust dosage and monitor alertness.',
  },
  {
    drugs: ['ginkgo', 'warfarin'],
    severity: 'major',
    description: 'Ginkgo Biloba exhibits antiplatelet and antithrombotic properties, compounding Warfarin anticoagulation.',
    actionRequired: 'Advise patient to discontinue herbal supplement or perform frequent coagulation checks.',
  },
  {
    drugs: ['ginkgo', 'aspirin'],
    severity: 'major',
    description: 'Additive antiplatelet effects between Ginkgo Biloba and Aspirin elevate spontaneous bleeding risk.',
    actionRequired: 'Avoid concurrent use.',
  },
  {
    drugs: ['licorice', 'enalapril'],
    severity: 'major',
    description: 'Licorice (Yashtimadhu / Glycyrrhizin) promotes pseudoaldosteronism, sodium retention, and antagonizes antihypertensive therapy.',
    actionRequired: 'Avoid excessive licorice consumption in hypertensive patients.',
  },
  {
    drugs: ['licorice', 'digoxin'],
    severity: 'critical',
    description: 'Licorice-induced hypokalemia significantly potentiates Digoxin toxicity and fatal cardiac arrhythmias.',
    actionRequired: 'Avoid combination; monitor serum potassium levels and cardiac rhythm.',
  },
  {
    drugs: ['guggulu', 'atorvastatin'],
    severity: 'moderate',
    description: 'Guggulu may modulate CYP3A4 metabolism and hepatic enzyme transport, altering statin bioavailability.',
    actionRequired: 'Monitor lipid profile response and evaluate liver function enzymes.',
  },
];

function normalizeDrugName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().toLowerCase();
}

/**
 * Checks for drug-drug and herb-drug interactions in a given list of medications.
 * @param {Array<string|object>} medications - Array of drug names or medication objects with a `name` property.
 * @returns {Array<object>} Array of detected interaction warnings.
 */
function checkDrugInteractions(medications = []) {
  if (!Array.isArray(medications) || medications.length < 2) {
    return [];
  }

  const drugNames = medications
    .map((item) => (typeof item === 'string' ? item : item?.name || ''))
    .map(normalizeDrugName)
    .filter(Boolean);

  const detectedWarnings = [];
  const reportedPairs = new Set();

  for (let i = 0; i < drugNames.length; i++) {
    for (let j = i + 1; j < drugNames.length; j++) {
      const drugA = drugNames[i];
      const drugB = drugNames[j];

      for (const interaction of KNOWN_INTERACTIONS) {
        const [ruleDrug1, ruleDrug2] = interaction.drugs;
        const matchesForward = drugA.includes(ruleDrug1) && drugB.includes(ruleDrug2);
        const matchesReverse = drugA.includes(ruleDrug2) && drugB.includes(ruleDrug1);

        if (matchesForward || matchesReverse) {
          const pairKey = [ruleDrug1, ruleDrug2].sort().join('::');
          if (!reportedPairs.has(pairKey)) {
            reportedPairs.add(pairKey);
            detectedWarnings.push({
              severity: interaction.severity,
              drugs: [drugA, drugB],
              matchedRules: [ruleDrug1, ruleDrug2],
              description: interaction.description,
              actionRequired: interaction.actionRequired,
            });
          }
        }
      }
    }
  }

  // Sort by clinical severity: critical > major > moderate > minor
  const severityOrder = { critical: 1, major: 2, moderate: 3, minor: 4 };
  return detectedWarnings.sort((a, b) => (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5));
}

module.exports = {
  KNOWN_INTERACTIONS,
  checkDrugInteractions,
  normalizeDrugName,
};

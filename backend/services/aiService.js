const AI_TIMEOUT_MS = Math.max(1000, Number(process.env.AI_SERVICE_TIMEOUT_MS) || 8000);

const urgentPhrases = [
  'severe chest pain', 'crushing chest pain', 'difficulty breathing', 'trouble breathing',
  "can't breathe", 'cannot breathe', 'slurred speech', 'sudden speech difficulty',
  'face drooping', 'loss of consciousness', 'unconscious', 'severe bleeding',
  'सांस लेने में कठिनाई', 'सांस नहीं ले पा', 'बेहोश', 'बोलने में अचानक', 'बहुत ज्यादा खून बहना', 'सीने में तेज दर्द',
];
const negationPhrases = ['no', 'not', 'never', 'without', 'denies', 'denied', "don't have", 'do not have', "doesn't have", 'does not have', 'नहीं'];

function hasUrgentPhrase(answer) {
  const normalized = String(answer || '').toLocaleLowerCase();
  return urgentPhrases.some((phrase) => {
    const target = phrase.toLocaleLowerCase();
    let position = normalized.indexOf(target);
    while (position !== -1) {
      const prefix = normalized.slice(Math.max(0, position - 35), position).trimEnd();
      const negated = negationPhrases.some((word) => prefix === word || prefix.endsWith(` ${word}`));
      if (!negated) return true;
      position = normalized.indexOf(target, position + target.length);
    }
    return false;
  });
}

function urgentReply(language) {
  return {
    mode: 'guided',
    reply: language === 'hi' ? 'कृपया रुकें और अभी कर्मचारी को बताएं।' : 'Please stop and alert a staff member now.',
    followUpQuestion: null,
    urgent: true,
    urgentMessage: language === 'hi'
      ? 'इस जानकारी पर तुरंत ध्यान देना आवश्यक हो सकता है। चेक-इन पूरा होने की प्रतीक्षा किए बिना अभी कर्मचारी को बताएं।'
      : 'This response may need urgent attention. Please alert a staff member now for immediate human assessment. Do not wait for check-in to finish.',
  };
}

async function requestConversation(payload) {
  if (hasUrgentPhrase(payload.answer)) return urgentReply(payload.language);
  const baseUrl = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/api/v1/conversation/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`AI service returned ${response.status}`);
    return await response.json();
  } catch (_error) {
    return {
      mode: 'guided_fallback',
      reply: payload.language === 'hi'
        ? 'धन्यवाद। अगला प्रश्न आपकी जानकारी को समझने में मदद करेगा।'
        : 'Thank you for sharing. The next question will help your care team understand your experience.',
      followUpQuestion: null,
      urgent: false,
    };
  }
}

async function requestClinicalSummary(payload) {
  const baseUrl = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/api/v1/summary/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Math.max(1000, Number(process.env.AI_SERVICE_TIMEOUT_MS) || 8000)),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (_error) {
    return null;
  }
}

module.exports = { hasUrgentPhrase, requestClinicalSummary, requestConversation, urgentReply };

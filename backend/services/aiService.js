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

function localConversationRuleEngine(payload) {
  const language = payload.language || 'en';
  const field = payload.field;
  const answer = String(payload.answer || '').trim().toLowerCase();
  const followUpAlreadyAsked = Boolean(payload.followUpAnswer);

  if (field === 'chiefComplaint' && !followUpAlreadyAsked) {
    if (['headache', 'head pain', 'migraine', 'सिरदर्द', 'सिर दर्द'].some((t) => answer.includes(t))) {
      return {
        mode: 'demo',
        reply: language === 'hi' ? 'सिरदर्द को बेहतर समझने के लिए मैं एक छोटा सवाल पूछूँगा।' : 'I can ask one brief question to better understand your headache.',
        followUpQuestion: language === 'hi' ? 'सिरदर्द कब शुरू हुआ, और क्या यह लगातार रहता है या आता-जाता है?' : 'When did the headache begin, and has it been constant or come and go?',
        followUpField: 'onset',
        urgent: false,
      };
    }
    const vagueWords = ['pain', 'problem', 'unwell', 'not well', 'issue', 'discomfort', 'दर्द', 'तकलीफ', 'परेशानी'];
    if (vagueWords.some((w) => answer === w || answer.includes(w)) || answer.length < 12) {
      return {
        mode: 'demo',
        reply: language === 'hi' ? 'आपकी परेशानी को बेहतर समझने के लिए मैं एक और प्रश्न पूछूंगा।' : 'I can ask one more question to make sure we understand your concern.',
        followUpQuestion: language === 'hi' ? 'कृपया अपनी मुख्य परेशानी के बारे में अपने शब्दों में थोड़ा और बताएं।' : 'Could you describe the main concern in a little more detail, in your own words?',
        followUpField: 'character',
        urgent: false,
      };
    }
  }

  return {
    mode: 'demo',
    reply: language === 'hi' ? 'जानकारी साझा करने के लिए धन्यवाद। जिस प्रश्न का उत्तर न पता हो, उसे छोड़ सकते हैं।' : 'Thank you for sharing. You can skip any question you are unsure about.',
    followUpQuestion: null,
    urgent: false,
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
    return localConversationRuleEngine(payload);
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

import { Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import './patient-feedback-modal.css';

const ratings = [1, 2, 3, 4, 5];

const copy = {
  en: {
    title: 'Rate your experience',
    description: 'Choose a rating for your kiosk check-in.',
    rating: 'Kiosk experience rating',
    starLabel: (rating) => rating === 1 ? '1 star' : rating + ' stars',
    unavailable: 'Feedback submission is currently unavailable.',
    invalid: 'Choose a rating from 1 to 5 stars.',
    submitting: 'Submitting your rating…',
    success: 'Thank you for rating your experience.',
    error: 'Your rating could not be submitted. Please try again.',
    close: 'Close',
    done: 'Done',
    submit: 'Submit rating',
    retry: 'Try again',
  },
  hi: {
    title: 'अपने अनुभव को रेटिंग दें',
    description: 'कियोस्क पर चेक-इन के अपने अनुभव को रेटिंग दें।',
    rating: 'कियोस्क अनुभव की रेटिंग',
    starLabel: (rating) => rating + ' स्टार',
    unavailable: 'अभी प्रतिक्रिया भेजने की सुविधा उपलब्ध नहीं है।',
    invalid: '1 से 5 स्टार में से कोई रेटिंग चुनें।',
    submitting: 'आपकी रेटिंग भेजी जा रही है…',
    success: 'रेटिंग देने के लिए धन्यवाद।',
    error: 'आपकी रेटिंग नहीं भेजी जा सकी। कृपया फिर कोशिश करें।',
    close: 'बंद करें',
    done: 'हो गया',
    submit: 'रेटिंग भेजें',
    retry: 'फिर कोशिश करें',
  },
};

export default function PatientFeedbackModal({ language = 'en', onClose, onSubmitRating }) {
  const t = copy[language] || copy.en;
  const dialogRef = useRef(null);
  const doneButton = useRef(null);
  const [rating, setRating] = useState(null);
  const [status, setStatus] = useState('idle');
  const available = typeof onSubmitRating === 'function';
  const submitting = status === 'submitting';
  const submitted = status === 'success';
  const error = status === 'invalid' ? t.invalid : status === 'error' ? t.error : '';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (submitted) doneButton.current?.focus();
  }, [submitted]);

  const submit = async (event) => {
    event.preventDefault();
    if (!available || submitting || submitted) return;
    if (!ratings.includes(rating)) {
      setStatus('invalid');
      return;
    }

    setStatus('submitting');
    try {
      await onSubmitRating(rating);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="patient-feedback-dialog"
      lang={language === 'hi' ? 'hi' : 'en'}
      aria-labelledby="patient-feedback-title"
      aria-describedby={submitted ? 'patient-feedback-status' : 'patient-feedback-description'}
      onClose={onClose}
      onCancel={(event) => { if (submitting) event.preventDefault(); }}
    >
      <form noValidate onSubmit={submit}>
        <h2 id="patient-feedback-title">{t.title}</h2>
        <p id="patient-feedback-description" hidden={submitted}>{t.description}</p>
        {!submitted && (
          <>
            <fieldset className="patient-feedback-stars" disabled={submitting}>
              <legend className="sr-only">{t.rating}</legend>
              {ratings.map((score) => (
                <label className="patient-feedback-star" key={score}>
                  <input
                    className="sr-only"
                    type="radio"
                    name="patient-feedback-rating"
                    value={score}
                    checked={score === rating}
                    onChange={() => { setRating(score); setStatus('idle'); }}
                    aria-label={t.starLabel(score)}
                    required
                  />
                  <span className={score <= rating ? 'rated' : undefined} aria-hidden="true">
                    <Star size={23} />
                    {score}
                  </span>
                </label>
              ))}
            </fieldset>
            {!available && <p className="patient-feedback-message">{t.unavailable}</p>}
            {error && <p className="patient-feedback-error" role="alert">{error}</p>}
          </>
        )}
        <p id="patient-feedback-status" className="patient-feedback-message" role="status">
          {submitting ? t.submitting : submitted ? t.success : ''}
        </p>
        <div className="patient-feedback-actions">
          <button
            ref={doneButton}
            className={submitted ? 'button button-primary' : 'button button-secondary'}
            type="button"
            onClick={() => dialogRef.current.close()}
            disabled={submitting}
          >
            {submitted ? t.done : t.close}
          </button>
          {!submitted && (
            <button className="button button-primary" type="submit" disabled={!available || submitting}>
              {status === 'error' ? t.retry : t.submit}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

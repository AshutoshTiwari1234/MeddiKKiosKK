import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, Check, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ayurvedaAssessmentSchema } from '../schemas/ayurvedaAssessmentSchema.js';
import { api } from '../services/api.js';
import AyurvedaDoshaRadar from './AyurvedaDoshaRadar.jsx';
import { useToast } from './ToastProvider.jsx';

const defaults = { prakriti: 'not_assessed', vikriti: 'not_assessed', sara: '', samhanana: '', pramana: '', satmya: '', sattva: '', aharaShakti: '', vyayamaShakti: '', vaya: 'not_assessed', agni: 'not_assessed', koshtha: 'not_assessed', nidana: '' };
const constitutionOptions = [['not_assessed', 'Not assessed'], ['vata', 'Vata'], ['pitta', 'Pitta'], ['kapha', 'Kapha'], ['vata_pitta', 'Vata–Pitta'], ['vata_kapha', 'Vata–Kapha'], ['pitta_kapha', 'Pitta–Kapha'], ['sama', 'Sama / balanced']];

function SelectField({ name, label, options, register }) {
  return <label className="ayurveda-field" htmlFor={`ayu-${name}`}><span>{label}</span><select id={`ayu-${name}`} {...register(name)}>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>;
}

function TextField({ name, label, register, rows = 2 }) {
  return <label className="ayurveda-field" htmlFor={`ayu-${name}`}><span>{label}</span><textarea id={`ayu-${name}`} rows={rows} maxLength={name === 'nidana' ? 3000 : 1000} {...register(name)} /></label>;
}

export default function AyurvedaAssessmentForm({ patient, onUpdated }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const assessment = patient.ayurvedaAssessment || {};
  const { register, handleSubmit, reset, watch } = useForm({ resolver: zodResolver(ayurvedaAssessmentSchema), defaultValues: { ...defaults, ...assessment } });

  const watchPrakriti = watch('prakriti') || 'not_assessed';
  const watchVikriti = watch('vikriti') || 'not_assessed';

  useEffect(() => { reset({ ...defaults, ...(patient.ayurvedaAssessment || {}) }); }, [patient, reset]);

  const save = async (values) => {
    setSaving(true);
    try {
      await api.patch(`/patients/${encodeURIComponent(patient.patientId)}/ayurveda`, values);
      toast.success('Ayurveda assessment saved.');
      await onUpdated();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || 'Could not save the Ayurveda assessment.');
    } finally { setSaving(false); }
  };

  const vayaOptions = [['not_assessed', 'Not assessed'], ['bala', 'Bala · childhood'], ['madhya', 'Madhya · adulthood'], ['vriddha', 'Vriddha · older age']];
  const agniOptions = [['not_assessed', 'Not assessed'], ['sama', 'Sama'], ['vishama', 'Vishama'], ['tikshna', 'Tikshna'], ['manda', 'Manda']];
  const koshthaOptions = [['not_assessed', 'Not assessed'], ['mridu', 'Mridu'], ['madhyama', 'Madhyama'], ['krura', 'Krura']];

  return <section className="panel ayurveda-panel"><div className="panel-heading"><div><h2><Activity size={16} /> Ayurveda assessment</h2><p>Dashavidha Pariksha and related assessment · clinician entered</p></div><span className={`review-status ${assessment.assessedAt ? 'approved' : 'pending'}`}>{assessment.assessedAt ? 'Assessment saved' : 'Not assessed'}</span></div>
    <AyurvedaDoshaRadar prakriti={watchPrakriti} vikriti={watchVikriti} />
    <form onSubmit={handleSubmit(save)}>
      <h3 className="ayurveda-section-title">Dashavidha Pariksha</h3><div className="ayurveda-grid">
        <SelectField name="prakriti" label="Prakriti" options={constitutionOptions} register={register} />
        <SelectField name="vikriti" label="Vikriti" options={constitutionOptions} register={register} />
        <TextField name="sara" label="Sara" register={register} />
        <TextField name="samhanana" label="Samhanana" register={register} />
        <TextField name="pramana" label="Pramana" register={register} />
        <TextField name="satmya" label="Satmya" register={register} />
        <TextField name="sattva" label="Sattva" register={register} />
        <TextField name="aharaShakti" label="Ahara Shakti" register={register} />
        <TextField name="vyayamaShakti" label="Vyayama Shakti" register={register} />
        <SelectField name="vaya" label="Vaya" options={vayaOptions} register={register} />
      </div>
      <h3 className="ayurveda-section-title additional-title">Additional assessment</h3><div className="ayurveda-grid">
        <SelectField name="agni" label="Agni" options={agniOptions} register={register} />
        <SelectField name="koshtha" label="Koshtha" options={koshthaOptions} register={register} />
        <TextField name="nidana" label="Nidana and relevant clinical assessment" register={register} rows={3} />
      </div>
      {assessment.assessedAt && <small className="ayurveda-last-saved">Last saved {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(assessment.assessedAt))}.</small>}
      <div className="ayurveda-actions"><span>Save only clinician-assessed findings. This form does not generate a diagnosis.</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle size={14} className="spin" /> : <Check size={15} />} Save assessment</button></div>
    </form>
  </section>;
}

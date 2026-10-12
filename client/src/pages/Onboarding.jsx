import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from '../api.js';
import Badge from '../components/Badge.jsx';
import Notice from '../components/Notice.jsx';

const DOCUMENTS = [
  ['ID_PROOF', 'Identity proof'],
  ['ADDRESS_PROOF', 'Address proof'],
  ['SELFIE', 'Selfie'],
];

const blank = {
  fullName: '',
  dob: '',
  pan: '',
  country: 'IN',
  occupation: '',
  annualIncome: '',
  expectedMonthlyVolume: '',
  isPep: false,
};

export default function Onboarding() {
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async (id) => {
    const data = await api.get(`/kyc/applications/${id}`);
    setApplication(data.application);
    setDocuments(data.documents);
  }, []);

  useEffect(() => {
    api
      .get('/kyc/applications')
      .then(async (list) => {
        if (list.items.length) await refresh(list.items[0]._id);
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false));
  }, [refresh]);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await api.post('/kyc/applications', {
        ...form,
        annualIncome: Number(form.annualIncome),
        expectedMonthlyVolume: Number(form.expectedMonthlyVolume),
      });
      await refresh(created.application._id);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind, file) {
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = new FormData();
      data.append('kind', kind);
      data.append('file', file);
      await api.upload(`/kyc/applications/${application._id}/documents`, data);
      await refresh(application._id);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function process() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/kyc/applications/${application._id}/process`);
      await refresh(application._id);
      setMessage('Your application has been checked.');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading</p>;

  if (!application) {
    return (
      <>
        <header className="page-head">
          <h2>Open your account</h2>
          <p className="muted">Tell us about yourself. You will upload documents on the next step.</p>
        </header>
        <Notice error={error} />
        <form className="form-grid" onSubmit={submit}>
          <label>Full name<input value={form.fullName} onChange={update('fullName')} required minLength={3} /></label>
          <label>Date of birth<input type="date" value={form.dob} onChange={update('dob')} required /></label>
          <label>PAN<input value={form.pan} onChange={update('pan')} required pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" title="Five letters, four digits, one letter" /></label>
          <label>Country of residence<input value={form.country} onChange={update('country')} required maxLength={2} minLength={2} /></label>
          <label>Occupation<input value={form.occupation} onChange={update('occupation')} required /></label>
          <label>Annual income<input type="number" min="0" value={form.annualIncome} onChange={update('annualIncome')} required /></label>
          <label>Expected monthly transactions<input type="number" min="0" value={form.expectedMonthlyVolume} onChange={update('expectedMonthlyVolume')} required /></label>
          <label className="check"><input type="checkbox" checked={form.isPep} onChange={update('isPep')} />I hold or recently held a prominent public position</label>
          <button className="primary" disabled={busy}>Continue</button>
        </form>
      </>
    );
  }

  const uploaded = new Set(documents.map((d) => d.kind));
  const editable = application.state === 'SUBMITTED';

  return (
    <>
      <header className="page-head">
        <h2>Your application <Badge value={application.state} /></h2>
      </header>
      <Notice error={error} message={message} />

      {application.state === 'APPROVED' && <p className="notice">Your account is open. You can now start banking with us.</p>}
      {application.state === 'MANUAL_REVIEW' && <p className="notice">A compliance officer is reviewing your application. We will update this page when a decision is made.</p>}
      {application.state === 'REJECTED' && <p className="notice error">We could not open an account with the information provided.</p>}

      <section className="panel">
        <h3>Documents</h3>
        <ul className="docs">
          {DOCUMENTS.map(([kind, label]) => (
            <li key={kind}>
              <span>{label}</span>
              {uploaded.has(kind) && <Badge value="uploaded" />}
              {editable && (
                <input type="file" accept="image/png,image/jpeg,application/pdf" disabled={busy} onChange={(e) => upload(kind, e.target.files[0])} />
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <button className="primary" disabled={busy || uploaded.size < DOCUMENTS.length} onClick={process}>
            Submit for verification
          </button>
        )}
      </section>

      <section className="panel">
        <h3>Progress</h3>
        <ol className="timeline">
          {application.history.map((entry, index) => (
            <li key={index}>
              <Badge value={entry.to} /> <span className="muted small">{new Date(entry.at).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

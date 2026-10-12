import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, describeError } from '../api.js';
import { isOfficer, useAuth } from '../auth.jsx';
import Badge from '../components/Badge.jsx';
import Notice from '../components/Notice.jsx';

const NEXT_STATUS = {
  OPEN: [['INVESTIGATING', 'Start investigation'], ['CLOSED', 'Close case']],
  INVESTIGATING: [['ESCALATED', 'Escalate'], ['CLOSED', 'Close case']],
  ESCALATED: [['INVESTIGATING', 'Return to investigation'], ['CLOSED', 'Close case']],
};

export default function CaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [note, setNote] = useState('');
  const [strText, setStrText] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/cases/${id}`);
      setItem(data);
      setStrText(data.strDraft?.text || '');
    } catch (err) {
      setError(describeError(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(label, fn, success) {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      await fn();
      if (success) setMessage(success);
      await load();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy('');
    }
  }

  async function ask(event) {
    event.preventDefault();
    setBusy('ask');
    setError('');
    try {
      setAnswer(await api.post('/ai/ask', { question, caseId: id }));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy('');
    }
  }

  if (!item) return error ? <Notice error={error} /> : <p className="muted">Loading case</p>;

  const closed = item.status === 'CLOSED' || item.status === 'STR_FILED';
  const draft = item.strDraft;

  return (
    <>
      <header className="page-head">
        <h2>{item.reference} <Badge value={item.status} /></h2>
        <p className="muted mono">{item.accountId}</p>
      </header>
      <Notice error={error} message={message} />

      <section className="grid two">
        <div className="panel">
          <h3>Customer</h3>
          {item.customer ? (
            <>
              <p>{item.customer.occupation}, {item.customer.country}{item.customer.isPep ? ', politically exposed' : ''}</p>
              <p>Risk <Badge value={item.customer.riskLevel} /> score {item.customer.riskScore}</p>
              {item.customer.riskExplanation && <p className="muted">{item.customer.riskExplanation}</p>}
            </>
          ) : (
            <p className="muted">No customer record found for this account.</p>
          )}
        </div>
        <div className="panel">
          <h3>Actions</h3>
          <div className="row">
            {(NEXT_STATUS[item.status] || []).map(([status, label]) => (
              <button key={status} disabled={Boolean(busy)} onClick={() => run(status, () => api.patch(`/cases/${id}/status`, { status }), 'Status updated')}>
                {label}
              </button>
            ))}
            {closed && <span className="muted">This case is final.</span>}
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Alerts in this case</h3>
        <table className="table compact">
          <thead><tr><th>Severity</th><th>Rule</th><th>Details</th><th>Raised</th></tr></thead>
          <tbody>
            {item.alerts.map((alert) => (
              <tr key={alert._id}>
                <td><Badge value={alert.severity} /></td>
                <td>{alert.ruleName}</td>
                <td className="mono small">{JSON.stringify(alert.details)}</td>
                <td>{new Date(alert.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Investigation brief</h3>
          <button disabled={Boolean(busy)} onClick={() => run('summary', () => api.post(`/cases/${id}/summary`), 'Brief generated')}>
            {busy === 'summary' ? 'Generating' : item.summary ? 'Regenerate' : 'Generate brief'}
          </button>
        </div>
        {item.summary ? (
          <>
            <p className="prose">{item.summary.text}</p>
            <p className="muted small">Generated {new Date(item.summary.generatedAt).toLocaleString()} by {item.summary.model}. Check it against the alerts before relying on it.</p>
          </>
        ) : (
          <p className="muted">Create a short brief from the alerts and recent activity.</p>
        )}
      </section>

      <section className="panel">
        <h3>Ask the policy assistant</h3>
        <form className="toolbar" onSubmit={ask}>
          <input className="wide" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What should I check when deposits cluster just under the limit?" minLength={5} required />
          <button disabled={busy === 'ask'}>{busy === 'ask' ? 'Thinking' : 'Ask'}</button>
        </form>
        {answer && (
          <>
            <p className="prose">{answer.answer}</p>
            <ul className="sources">
              {answer.sources.map((source) => <li key={source.title}>{source.title}</li>)}
            </ul>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Suspicious transaction report {draft && <Badge value={draft.status} />}</h3>
          {draft?.status !== 'APPROVED' && !closed && (
            <button disabled={Boolean(busy)} onClick={() => run('str', () => api.post(`/cases/${id}/str`), 'Draft generated')}>
              {busy === 'str' ? 'Drafting' : draft ? 'Redraft' : 'Draft report'}
            </button>
          )}
        </div>
        {draft ? (
          <>
            <textarea rows="14" value={strText} onChange={(e) => setStrText(e.target.value)} disabled={draft.status === 'APPROVED'} />
            {draft.status === 'DRAFT' && (
              <div className="row">
                <button disabled={Boolean(busy) || strText === draft.text} onClick={() => run('save', () => api.put(`/cases/${id}/str`, { text: strText }), 'Draft saved')}>Save edits</button>
                {isOfficer(user) && (
                  <button className="primary" disabled={Boolean(busy) || strText !== draft.text} onClick={() => run('approve', () => api.post(`/cases/${id}/str/approve`), 'Report approved and filed')}>
                    Approve and file
                  </button>
                )}
              </div>
            )}
            {draft.status === 'APPROVED' && <p className="muted small">Approved {new Date(draft.approvedAt).toLocaleString()}</p>}
          </>
        ) : (
          <p className="muted">No draft yet. A compliance officer must approve any report before it is filed.</p>
        )}
      </section>

      <section className="panel">
        <h3>Notes</h3>
        <ul className="notes">
          {item.notes.map((entry, index) => (
            <li key={index}>
              <strong>{entry.author?.name || 'Unknown'}</strong> <span className="muted small">{new Date(entry.at).toLocaleString()}</span>
              <p>{entry.text}</p>
            </li>
          ))}
          {!item.notes.length && <li className="muted">No notes yet.</li>}
        </ul>
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); run('note', async () => { await api.post(`/cases/${id}/notes`, { text: note }); setNote(''); }); }}>
          <input className="wide" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" minLength={2} required />
          <button disabled={Boolean(busy)}>Add note</button>
        </form>
      </section>
    </>
  );
}

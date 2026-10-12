import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from '../api.js';
import { isOfficer, useAuth } from '../auth.jsx';
import Badge from '../components/Badge.jsx';
import Notice from '../components/Notice.jsx';
import Pager from '../components/Pager.jsx';

export default function Applications() {
  const { user } = useAuth();
  const [state, setState] = useState('MANUAL_REVIEW');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pages: 1 });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page });
    if (state) params.set('state', state);
    try {
      setResult(await api.get(`/kyc/applications?${params}`));
      setError('');
    } catch (err) {
      setError(describeError(err));
    }
  }, [state, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id, decision) {
    const note = window.prompt(decision === 'APPROVED' ? 'Why is this customer approved?' : 'Why is this application rejected?');
    if (!note || note.trim().length < 3) return;
    try {
      await api.post(`/kyc/applications/${id}/decision`, { decision, note });
      setMessage(`Application ${decision.toLowerCase()}`);
      await load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <>
      <header className="page-head">
        <h2>KYC applications</h2>
      </header>
      <div className="toolbar">
        <select value={state} onChange={(e) => { setPage(1); setState(e.target.value); }}>
          <option value="">Any state</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="MANUAL_REVIEW">Manual review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      <Notice error={error} message={message} />
      <table className="table">
        <thead>
          <tr><th>Applicant</th><th>State</th><th>Risk</th><th>Country</th><th>Occupation</th><th>Submitted</th><th /></tr>
        </thead>
        <tbody>
          {result.items.map((item) => (
            <tr key={item._id}>
              <td>{item.customer?.fullName}</td>
              <td><Badge value={item.state} /></td>
              <td>{item.customer?.riskLevel ? <><Badge value={item.customer.riskLevel} /> {item.customer.riskScore}</> : '-'}</td>
              <td>{item.customer?.country}</td>
              <td>{item.customer?.occupation}</td>
              <td>{new Date(item.createdAt).toLocaleDateString()}</td>
              <td className="actions">
                {item.state === 'MANUAL_REVIEW' && isOfficer(user) && (
                  <>
                    <button onClick={() => decide(item._id, 'APPROVED')}>Approve</button>
                    <button onClick={() => decide(item._id, 'REJECTED')}>Reject</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {!result.items.length && <tr><td colSpan="7" className="empty">Nothing in this queue.</td></tr>}
        </tbody>
      </table>
      <Pager page={result.page || 1} pages={result.pages} onChange={setPage} />
    </>
  );
}

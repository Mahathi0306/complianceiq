import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, describeError } from '../api.js';
import Badge from '../components/Badge.jsx';
import Notice from '../components/Notice.jsx';
import Pager from '../components/Pager.jsx';

export default function Cases() {
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pages: 1 });
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page });
    if (status) params.set('status', status);
    if (mine) params.set('assignee', 'me');
    api
      .get(`/cases?${params}`)
      .then((data) => {
        setResult(data);
        setError('');
      })
      .catch((err) => setError(describeError(err)));
  }, [status, mine, page]);

  return (
    <>
      <header className="page-head">
        <h2>Cases</h2>
      </header>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Any status</option>
          <option value="OPEN">Open</option>
          <option value="INVESTIGATING">Investigating</option>
          <option value="ESCALATED">Escalated</option>
          <option value="CLOSED">Closed</option>
          <option value="STR_FILED">Report filed</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => { setPage(1); setMine(e.target.checked); }} />
          Assigned to me
        </label>
      </div>
      <Notice error={error} />
      <table className="table">
        <thead>
          <tr><th>Reference</th><th>Status</th><th>Account</th><th>Alerts</th><th>Owner</th><th>Opened</th></tr>
        </thead>
        <tbody>
          {result.items.map((item) => (
            <tr key={item._id}>
              <td><Link to={`/cases/${item._id}`}>{item.reference}</Link></td>
              <td><Badge value={item.status} /></td>
              <td className="mono">{item.accountId}</td>
              <td>{item.alerts.length}</td>
              <td>{item.assignee?.name || '-'}</td>
              <td>{new Date(item.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {!result.items.length && <tr><td colSpan="6" className="empty">No cases yet. Select alerts to open one.</td></tr>}
        </tbody>
      </table>
      <Pager page={result.page || 1} pages={result.pages} onChange={setPage} />
    </>
  );
}

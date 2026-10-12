import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, describeError } from '../api.js';
import Badge from '../components/Badge.jsx';
import Notice from '../components/Notice.jsx';
import Pager from '../components/Pager.jsx';

function summarise(alert) {
  const d = alert.details || {};
  switch (alert.ruleType) {
    case 'THRESHOLD': return `Amount ${Number(d.amount).toLocaleString('en-IN')} reached the limit`;
    case 'STRUCTURING': return `${d.count} deposits just under the limit in ${d.windowHours}h`;
    case 'VELOCITY': return `${d.count} transactions in ${d.windowSeconds}s`;
    case 'DORMANT': return `Active again after ${d.inactiveDays} idle days`;
    case 'CIRCULAR': return `Loop of ${d.hops} transfers`;
    default: return '';
  }
}

export default function Alerts() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ status: 'OPEN', severity: '', assignedTo: '' });
  const [query, setQuery] = useState('');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pages: 1 });
  const [interpreted, setInterpreted] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      let data;
      if (query) {
        data = await api.get(`/alerts/search?q=${encodeURIComponent(query)}&page=${page}`);
        setInterpreted(data.interpreted);
      } else {
        const params = new URLSearchParams({ page });
        Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
        data = await api.get(`/alerts?${params}`);
        setInterpreted(null);
      }
      setResult(data);
      setError('');
    } catch (err) {
      setError(describeError(err));
    }
  }, [filters, page, query]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function act(fn, success) {
    try {
      await fn();
      setMessage(success);
      setSelected(new Set());
      await load();
    } catch (err) {
      setMessage('');
      setError(describeError(err));
    }
  }

  const openCase = async () => {
    try {
      const created = await api.post('/cases', { alertIds: [...selected] });
      navigate(`/cases/${created._id}`);
    } catch (err) {
      setError(describeError(err));
    }
  };

  const dismiss = (id) => {
    const reason = window.prompt('Reason for dismissing this alert');
    if (reason && reason.trim().length >= 5) act(() => api.post(`/alerts/${id}/dismiss`, { reason }), 'Alert dismissed');
  };

  return (
    <>
      <header className="page-head">
        <h2>Alerts</h2>
        <p className="muted">Highest severity first, oldest first within each level</p>
      </header>

      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(searchText.trim());
        }}
      >
        <input
          className="wide"
          placeholder="Search in plain words, for example critical circular alerts from the last week"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <button>Search</button>
        {query && (
          <button type="button" onClick={() => { setQuery(''); setSearchText(''); setPage(1); }}>Clear</button>
        )}
      </form>

      {!query && (
        <div className="toolbar">
          <select value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}>
            <option value="">Any status</option>
            <option value="OPEN">Open</option>
            <option value="IN_CASE">In a case</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
          <select value={filters.severity} onChange={(e) => { setPage(1); setFilters({ ...filters, severity: e.target.value }); }}>
            <option value="">Any severity</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select value={filters.assignedTo} onChange={(e) => { setPage(1); setFilters({ ...filters, assignedTo: e.target.value }); }}>
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
          </select>
        </div>
      )}

      {interpreted && (
        <p className="muted">
          Showing {Object.entries(interpreted).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || 'all alerts'}
        </p>
      )}

      <Notice error={error} message={message} />

      <div className="bar">
        <span>{selected.size} selected</span>
        <button className="primary" disabled={!selected.size} onClick={openCase}>Open case from selection</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th />
            <th>Severity</th>
            <th>Rule</th>
            <th>What happened</th>
            <th>Account</th>
            <th>Raised</th>
            <th>Owner</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {result.items.map((alert) => (
            <tr key={alert._id} className={alert.slaBreached ? 'late' : ''}>
              <td>
                {alert.status === 'OPEN' && (
                  <input type="checkbox" checked={selected.has(alert._id)} onChange={() => toggle(alert._id)} />
                )}
              </td>
              <td><Badge value={alert.severity} /></td>
              <td>{alert.ruleName}</td>
              <td>{summarise(alert)}</td>
              <td className="mono">{alert.accountId}</td>
              <td>{new Date(alert.createdAt).toLocaleString()}{alert.slaBreached && <em> overdue</em>}</td>
              <td>{alert.assignedTo?.name || '-'}</td>
              <td className="actions">
                {alert.status === 'OPEN' && (
                  <>
                    <button onClick={() => act(() => api.patch(`/alerts/${alert._id}/assign`, {}), 'Alert assigned to you')}>Take</button>
                    <button onClick={() => dismiss(alert._id)}>Dismiss</button>
                  </>
                )}
                {alert.status !== 'OPEN' && <Badge value={alert.status} />}
              </td>
            </tr>
          ))}
          {!result.items.length && (
            <tr><td colSpan="8" className="empty">No alerts match these filters.</td></tr>
          )}
        </tbody>
      </table>
      <Pager page={result.page || 1} pages={result.pages} onChange={setPage} />
    </>
  );
}

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, describeError } from '../api.js';
import Notice from '../components/Notice.jsx';

const SEVERITY_COLORS = { LOW: '#6b8f71', MEDIUM: '#c9a227', HIGH: '#d9822b', CRITICAL: '#b3261e' };
const RISK_COLORS = { LOW: '#6b8f71', MEDIUM: '#c9a227', HIGH: '#b3261e' };

const toRows = (map, order) =>
  order.map((name) => ({ name, value: map?.[name] || 0 }));

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get('/reports/summary')
        .then((result) => active && setData(result))
        .catch((err) => active && setError(describeError(err)));
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (error) return <Notice error={error} />;
  if (!data) return <p className="muted">Loading figures</p>;

  const openAlerts = Object.values(data.openAlertsBySeverity).reduce((a, b) => a + b, 0);
  const activeCases = ['OPEN', 'INVESTIGATING', 'ESCALATED'].reduce((sum, k) => sum + (data.casesByStatus[k] || 0), 0);

  return (
    <>
      <header className="page-head">
        <h2>Overview</h2>
        <p className="muted">Refreshes every 15 seconds</p>
      </header>

      <section className="stats">
        <div className="stat"><span>{openAlerts}</span>Open alerts</div>
        <div className={data.slaBreached ? 'stat warn' : 'stat'}><span>{data.slaBreached}</span>Past their deadline</div>
        <div className="stat"><span>{activeCases}</span>Active cases</div>
        <div className="stat"><span>{data.strFiled}</span>Reports filed</div>
        <div className="stat"><span>{data.applicationsByState.MANUAL_REVIEW || 0}</span>Awaiting KYC review</div>
      </section>

      <section className="grid two">
        <div className="panel">
          <h3>Open alerts by severity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={toRows(data.openAlertsBySeverity, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((name) => (
                  <Cell key={name} fill={SEVERITY_COLORS[name]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h3>Customer risk distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={toRows(data.riskDistribution, ['LOW', 'MEDIUM', 'HIGH'])}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {['LOW', 'MEDIUM', 'HIGH'].map((name) => (
                  <Cell key={name} fill={RISK_COLORS[name]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h3>Alerts raised, last 14 days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.alertTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#1f4e5f" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h3>Age of active cases</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={Object.entries(data.caseAging).map(([name, value]) => ({ name, value }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#1f4e5f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}

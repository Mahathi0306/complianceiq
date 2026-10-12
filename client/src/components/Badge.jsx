export default function Badge({ value, kind }) {
  if (!value) return null;
  const tone = String(value).toLowerCase().replace(/_/g, '-');
  return <span className={`badge ${kind || 'tone'} ${tone}`}>{String(value).replace(/_/g, ' ').toLowerCase()}</span>;
}

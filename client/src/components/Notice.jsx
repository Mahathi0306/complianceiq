export default function Notice({ error, message }) {
  if (!error && !message) return null;
  return <div className={error ? 'notice error' : 'notice'}>{error || message}</div>;
}

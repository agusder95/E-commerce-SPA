export default function Tabs({ label, options, value, disabled = false, onChange }) {
  return <div className="purchases-tabs" role="group" aria-label={label}>
    {options.map(([key, text]) => <button type="button" key={key}
      className={`purchases-tab ${value === key ? 'active' : ''}`} aria-pressed={value === key}
      disabled={disabled} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}

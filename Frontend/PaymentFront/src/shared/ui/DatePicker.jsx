import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCalendar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { expirationISO, formatDate } from '../utils/date.js';

const weekdays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const monthLabel = date => date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

export default function DatePicker({ id, value, onChange, disabled = false, required = false, allowClear = false, allowPast = false, maxDate }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const control = useRef(null);
  const input = useRef(null);
  const panel = useRef(null);
  const focusedDay = useRef(null);
  const calendarId = useId();
  const titleId = useId();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedISO = expirationISO(value);
  const selected = selectedISO ? new Date(selectedISO) : null;
  const maximum = maxDate ? new Date(`${maxDate}T00:00:00`) : null;
  const year = month.getFullYear();
  const monthNumber = month.getMonth();
  const offset = (new Date(year, monthNumber, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, monthNumber + 1, 0).getDate();

  function close() { setOpen(false); input.current?.focus(); }
  function show() {
    if (disabled) return;
    setMonth(selected && (allowPast || selected >= today) ? selected : today);
    setOpen(true);
  }
  function choose(date) { onChange(formatDate(date)); close(); }

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const bounds = control.current.getBoundingClientRect();
      const popup = panel.current.getBoundingClientRect();
      setPosition({ left: Math.max(16, Math.min(bounds.left, window.innerWidth - popup.width - 16)),
        top: Math.max(16, Math.min(bounds.bottom + 8, window.innerHeight - popup.height - 16)) });
    }
    place(); focusedDay.current?.focus();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, year, monthNumber]);

  useEffect(() => {
    if (!open) return;
    function outside(event) {
      if (!control.current.contains(event.target) && !panel.current.contains(event.target)) setOpen(false);
    }
    function escape(event) {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); input.current?.focus(); }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  return <div className="date-picker" ref={control}>
    <input ref={input} id={id} type="text" value={value} readOnly required={required} disabled={disabled} placeholder="dd/mm/yyyy"
      role="combobox" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? calendarId : undefined}
      onClick={show} onKeyDown={event => {
        if (['Enter', ' ', 'ArrowDown'].includes(event.key)) { event.preventDefault(); show(); }
      }} />
    <button type="button" className="date-picker-toggle" disabled={disabled} aria-label="Abrir calendario" aria-haspopup="dialog"
      aria-expanded={open} aria-controls={open ? calendarId : undefined} onClick={() => open ? close() : show()}><IconCalendar size={20} aria-hidden="true" /></button>
    {open && createPortal(<div ref={panel} id={calendarId} className="date-calendar" role="dialog" aria-labelledby={titleId} style={position}>
      <div className="date-calendar-heading">
        <button type="button" aria-label="Mes anterior" disabled={!allowPast && year === today.getFullYear() && monthNumber <= today.getMonth()}
          onClick={() => setMonth(new Date(year, monthNumber - 1, 1))}><IconChevronLeft size={18} aria-hidden="true" /></button>
        <strong id={titleId}>{monthLabel(month)}</strong>
        <button type="button" aria-label="Mes siguiente" disabled={Boolean(maximum && new Date(year, monthNumber + 1, 1) > maximum)} onClick={() => setMonth(new Date(year, monthNumber + 1, 1))}><IconChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <div className="date-calendar-grid">
        {weekdays.map(day => <span className="date-calendar-weekday" key={day} aria-hidden="true">{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}
        {Array.from({ length: dayCount }, (_, index) => {
          const date = new Date(year, monthNumber, index + 1);
          const current = date.getTime() === today.getTime();
          const picked = formatDate(date) === value;
          return <button type="button" key={index + 1} disabled={(!allowPast && date < today) || Boolean(maximum && date > maximum)} aria-label={formatDate(date)} aria-pressed={picked}
            aria-current={current ? 'date' : undefined} ref={picked || (!selected && current) ? focusedDay : undefined}
            onClick={() => choose(date)}>{index + 1}</button>;
        })}
      </div>
      <div className="date-calendar-footer">
        <button type="button" disabled={Boolean(maximum && today > maximum)} onClick={() => choose(today)}>Hoy: {formatDate(today)}</button>
        {allowClear && <button type="button" onClick={() => { onChange(''); close(); }}>Sin fecha</button>}
        <button type="button" onClick={close}>Cerrar</button>
      </div>
    </div>, document.body)}
  </div>;
}

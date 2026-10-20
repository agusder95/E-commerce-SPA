import { IconArrowsSort, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { nextTableSort, normalizeTableSort } from '../model/tableSort';

export default function SortableHeader({ column, children, sort, busy, onSort, className }) {
  const active = normalizeTableSort(sort);
  const direction = active === `${column}-asc` ? 'ascending' : active === `${column}-desc` ? 'descending' : 'none';
  const Icon = direction === 'ascending' ? IconArrowUp : direction === 'descending' ? IconArrowDown : IconArrowsSort;
  return <th scope="col" className={className} aria-sort={direction}><button type="button" className="product-sort-button" disabled={busy}
    onClick={() => onSort(nextTableSort(sort, column))} title={direction === 'ascending' ? 'Ordenar de mayor a menor' : 'Ordenar de menor a mayor'}>
    {children}<Icon size={15} aria-hidden="true" /></button></th>;
}

import { IconArrowsSort, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { nextTableSort } from '../../../shared/utils/tableSort.js';

const columns = [['id', 'Compra'], ['created', 'Fecha'], ['status', 'Estado'], ['total', 'Total']];

export default function PurchaseSort({ sort, onSort }) {
  return <div className="purchase-sort" role="group" aria-label="Ordenar mis compras">
    <span>Ordenar por</span>
    {columns.map(([column, label]) => {
      const ascending = sort === `${column}-asc`;
      const active = ascending || sort === `${column}-desc`;
      const Icon = !active ? IconArrowsSort : ascending ? IconArrowUp : IconArrowDown;
      return <button key={column} type="button" aria-pressed={active}
        aria-label={`${label}: ${active ? `orden ${ascending ? 'ascendente' : 'descendente'}. ` : ''}Ordenar de ${ascending ? 'mayor a menor' : 'menor a mayor'}`}
        onClick={() => onSort(nextTableSort(sort, column))}>
        {label}<Icon size={15} aria-hidden="true" />
      </button>;
    })}
  </div>;
}

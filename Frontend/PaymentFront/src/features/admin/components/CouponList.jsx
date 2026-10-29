import { couponStatus, couponStatusLabels, couponScope } from '../model/offers.js';
import { formatDate } from '../../../shared/utils/date.js';
import { IconPencil } from '@tabler/icons-react';
import SortableHeader from './SortableHeader';

export default function CouponList({ manager: m }) {
  return <section className="offers-section coupon-list-panel" aria-labelledby="coupon-list-title"><div className="commerce-section-heading"><h3 id="coupon-list-title">Lista de cupones</h3><p>Consultá la vigencia y las condiciones de cada código.</p></div>
    <div className="admin-filters product-list-filters">
      <label>Mostrar cupones<select value={m.couponFilter} disabled={m.busy} onChange={event => m.setCouponFilter(event.target.value)}>
        <option value="active">Activos</option><option value="expired">Vencidos</option><option value="inactive">Inactivos</option><option value="all">Todos</option>
      </select></label>
    </div>
    <div className="table-scroll"><table><thead><tr>
      <SortableHeader column="code" sort={m.couponSort} busy={m.busy} onSort={m.setCouponSort}>Código</SortableHeader><th scope="col">Acciones</th>
      {[['discount', 'Porcentaje'], ['status', 'Estado'], ['scope', 'Alcance'], ['cumulative', 'Acumula con ofertas'], ['expiration', 'Expiración'], ['created', 'Creación']].map(([column, label]) =>
        <SortableHeader key={column} column={column} sort={m.couponSort} busy={m.busy} onSort={m.setCouponSort}>{label}</SortableHeader>)}
    </tr></thead>
      <tbody>{m.visibleCoupons.map(coupon => <tr key={coupon.idCoupon}>
        <td><strong className="coupon-code-value">{coupon.code}</strong></td>
        <td><button type="button" className="btn-secondary" disabled={m.busy} aria-label={`Editar cupón ${coupon.code}`} onClick={() => m.editCoupon(coupon)}><IconPencil size={15} aria-hidden="true" />Editar</button></td>
        <td className="coupon-discount-value">{coupon.discount}%</td><td><span className={`commerce-status coupon-status-${couponStatus(coupon)}`}>{couponStatusLabels[couponStatus(coupon)]}</span></td><td>{couponScope(coupon)}</td>
        <td>{coupon.cumulative ? 'Sí' : 'No'}</td><td>{formatDate(coupon.expirationDate) || 'Sin vencimiento'}</td><td>{formatDate(coupon.createdAt) || 'Sin registro'}</td>
      </tr>)}</tbody></table></div>
    {!m.visibleCoupons.length && <p className="commerce-empty">No hay cupones con estos filtros.</p>}
  </section>;
}

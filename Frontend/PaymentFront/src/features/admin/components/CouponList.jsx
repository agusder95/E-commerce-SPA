import { couponStatus } from '../model/offers.js';
import { formatDate } from '../../../shared/utils/date.js';

const labels = { active: 'Activo', expired: 'Vencido', inactive: 'Inactivo' };
export default function CouponList({ manager: m }) {
  return <section className="offers-section" aria-labelledby="coupon-list-title"><h3 id="coupon-list-title">Lista de cupones</h3>
    <div className="admin-filters product-list-filters">
      <label>Mostrar cupones<select value={m.couponFilter} disabled={m.busy} onChange={event => m.setCouponFilter(event.target.value)}>
        <option value="active">Activos</option><option value="expired">Vencidos</option><option value="inactive">Inactivos</option><option value="all">Todos</option>
      </select></label>
      <label>Ordenar cupones<select value={m.couponSort} disabled={m.busy} onChange={event => m.setCouponSort(event.target.value)}>
        <option value="expiration-asc">Expiración (más próxima)</option><option value="expiration-desc">Expiración (más lejana)</option>
        <option value="created-desc">Creación (más nuevos)</option><option value="created-asc">Creación (más viejos)</option>
      </select></label>
    </div>
    <div className="table-scroll"><table><thead><tr><th scope="col">Código</th><th scope="col">Porcentaje</th><th scope="col">Alcance</th><th scope="col">Acumula con ofertas</th><th scope="col">Expiración</th><th scope="col">Creación</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
      <tbody>{m.visibleCoupons.map(coupon => <tr key={coupon.idCoupon}>
        <td>{coupon.code}</td><td>{coupon.discount}%</td><td>{coupon.productType ? coupon.productType === 'PHYSICAL' ? 'Físico' : 'Digital' : 'Todos los tipos'}{coupon.tags.length ? ` · ${coupon.tags.join(', ')}` : ' · Todos los tags'}</td>
        <td>{coupon.cumulative ? 'Sí' : 'No'}</td><td>{formatDate(coupon.expirationDate) || 'Sin vencimiento'}</td><td>{formatDate(coupon.createdAt) || 'Sin registro'}</td><td>{labels[couponStatus(coupon)]}</td>
        <td><button type="button" className="btn-secondary" disabled={m.busy} aria-label={`Editar cupón ${coupon.code}`} onClick={() => m.editCoupon(coupon)}>Editar</button></td>
      </tr>)}</tbody></table></div>
    {!m.visibleCoupons.length && <p>No hay cupones con estos filtros.</p>}
  </section>;
}

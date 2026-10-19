import ProductCover from '../../catalog/components/ProductCover.jsx';
import { money } from '../../../shared/utils/format.js';
import { Link } from 'react-router-dom';

export default function CartItem({ item, couponItem, onIncrement, onDecrement, onRemove }) {
  const price = couponItem?.finalUnitPrice ?? item.price;
  return (
    <div className="cart-item">
      <Link className="cart-item-link" to={`/products/${item.id}`} aria-label={`Ver detalles de ${item.name} (${item.type === 'PHYSICAL' ? 'Físico' : 'Digital'})`} />
      <div className="cart-item-image"><ProductCover product={item} /></div>
      <div className="cart-item-info">
        <h3>{item.name}</h3>
        <p>{item.type === "PHYSICAL" ? "Físico" : "Digital"}</p>
        <div className="unit-price">{money(price, 2)} c/u</div>
        {couponItem?.couponStatus === 'APPLIED' && <p className="cart-coupon-item">Cupón aplicado: −{money(couponItem.couponDiscount, 2)}</p>}
        {couponItem?.couponStatus === 'OFFER_EXCLUDED' && <p className="cart-coupon-item">Se conserva la oferta. El cupón no se acumula.</p>}
        {couponItem?.couponStatus === 'OUT_OF_SCOPE' && <p className="cart-coupon-item">Este producto no está alcanzado por el cupón.</p>}
      </div>
      <div className="cart-item-controls">
        {item.type === "PHYSICAL" && <button type="button" disabled={item.quantity <= 1} aria-label={`Quitar una unidad de ${item.name}`} onClick={() => onDecrement(item.id)}>-</button>}
        <span className="qty">{item.quantity}</span>
        {item.type === "PHYSICAL" && <button type="button" aria-label={`Agregar una unidad de ${item.name}`} disabled={item.quantity >= item.stock} onClick={() => onIncrement(item.id)}>+</button>}
      </div>
      <div className="cart-item-subtotal">
        <span>Subtotal</span>
        {money(price * item.quantity, 2)}
      </div>
      <button className="cart-item-remove" onClick={() => onRemove(item.id)} aria-label={`Eliminar ${item.name}`} title="Eliminar">
        ✕
      </button>
    </div>
  );
}

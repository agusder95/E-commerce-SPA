export default function CartItem({ item, onIncrement, onDecrement, onRemove }) {
  return (
    <div className="cart-item">
      <div className="cart-item-info">
        <h3>{item.name}</h3>
        <div className="unit-price">${item.price.toLocaleString("es-AR")} c/u</div>
      </div>
      <div className="cart-item-controls">
        <button onClick={() => onDecrement(item.id)}>-</button>
        <span className="qty">{item.quantity}</span>
        <button onClick={() => onIncrement(item.id)}>+</button>
      </div>
      <div className="cart-item-subtotal">
        ${(item.price * item.quantity).toLocaleString("es-AR")}
      </div>
      <button className="cart-item-remove" onClick={() => onRemove(item.id)} title="Eliminar">
        ✕
      </button>
    </div>
  );
}

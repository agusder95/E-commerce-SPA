export default function ProductCard({ product, onAdd, added }) {
  return (
    <div className="product-card">
      <div className="product-card-icon">{product.icon}</div>
      <h3>{product.name}</h3>
      <div className="price">
        ${product.price.toLocaleString("es-AR")} <span>ARS</span>
      </div>
      {added ? (
        <button className="btn-added" disabled>Agregado exitosamente</button>
      ) : (
        <button className="btn-add" onClick={() => onAdd(product)}>
          Agregar al carrito
        </button>
      )}
    </div>
  );
}

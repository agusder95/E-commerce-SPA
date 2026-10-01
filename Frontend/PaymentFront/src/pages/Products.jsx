import { useState, useEffect } from "react";
import { useCart } from "../context/useCart";
import ProductCard from "../components/ProductCard";

const PRODUCTS = [
  { id: 1, name: "Curso de React",       price: 4999,  icon: "⚛️" },
  { id: 2, name: "Pack de Iconos UI",     price: 2499,  icon: "🎨" },
  { id: 3, name: "Ebook CSS Avanzado",    price: 3499,  icon: "📘" },
  { id: 4, name: "Template Dashboard",    price: 5999,  icon: "📊" },
  { id: 5, name: "Kit de Ilustraciones",  price: 1999,  icon: "✏️" },
  { id: 6, name: "Curso de Node.js",      price: 5499,  icon: "🟢" },
];

export default function Products() {
  const { addToCart } = useCart();
  const [toast, setToast] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleAdd(product) {
    addToCart(product);
    setAddedIds((prev) => new Set(prev).add(product.id));
    setToast(`${product.name} agregado al carrito`);
  }

  return (
    <div className="page">
      <h1 className="page-title">Productos</h1>
      <div className="product-grid">
        {PRODUCTS.map((p) => (
          <ProductCard key={p.id} product={p} onAdd={handleAdd} added={addedIds.has(p.id)} />
        ))}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

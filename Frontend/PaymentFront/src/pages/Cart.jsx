import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";
import CartItem from "../components/CartItem";
import { createOrder } from "../api/api";

export default function Cart() {
  const { cart, increment, decrement, remove } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function handleCheckout() {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    const orderData = {
      idCustomer: parseInt(JSON.parse(atob(localStorage.getItem("token").split(".")[1])).idCustomer, 10),
      items: cart.map((item) => ({
        productName: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
      })),
    };

    try {
      const res = await createOrder(orderData);
      window.open(res.initPointUrl, "_blank");
      navigate(`/checkout/result?orderId=${res.orderId}`);
    } catch (err) {
      alert("Error al crear la orden: " + err.message);
    }
  }

  if (cart.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Carrito</h1>
        <div className="cart-empty">
          <p>Tu carrito está vacío.</p>
          <button className="btn-primary" style={{ width: "auto", display: "inline-block" }} onClick={() => navigate("/")}>
            Ver productos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Carrito</h1>
      <div className="cart-list">
        {cart.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onIncrement={increment}
            onDecrement={decrement}
            onRemove={remove}
          />
        ))}
      </div>
      <div className="cart-footer">
        <div className="cart-total">
          Total: <span>${total.toLocaleString("es-AR")}</span>
        </div>
        <button className="btn-checkout" onClick={handleCheckout}>
          {isAuthenticated ? "Pagar con Mercado Pago" : "Iniciar sesión para comprar"}
        </button>
      </div>
    </div>
  );
}

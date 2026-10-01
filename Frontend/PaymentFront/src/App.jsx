import { Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import Navbar from "./components/Navbar";
import Products from "./pages/Products";
import Cart from "./pages/Cart";
import Auth from "./pages/Auth";
import CheckoutResult from "./pages/CheckoutResult";
import MyPurchases from "./pages/MyPurchases";
import "./App.css";

function App() {
  return (
    <CartProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<Products />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/checkout/result" element={<CheckoutResult />} />
        <Route path="/my-purchases" element={<MyPurchases />} />
      </Routes>
    </CartProvider>
  );
}

export default App;

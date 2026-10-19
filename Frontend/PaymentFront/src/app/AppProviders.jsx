import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { CartProvider } from '../features/cart/context/CartContext';
import CartPaymentSync from '../features/cart/components/CartPaymentSync.jsx';

export default function AppProviders({ children }) {
  return <BrowserRouter><AuthProvider><CartProvider><CartPaymentSync />{children}</CartProvider></AuthProvider></BrowserRouter>;
}

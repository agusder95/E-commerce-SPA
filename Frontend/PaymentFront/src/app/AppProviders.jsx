import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { CartProvider } from '../features/cart/context/CartContext';
import { PaymentTrackingProvider } from '../features/orders/context/PaymentTrackingContext.jsx';

export default function AppProviders({ children }) {
  return <BrowserRouter><AuthProvider><CartProvider><PaymentTrackingProvider>{children}</PaymentTrackingProvider></CartProvider></AuthProvider></BrowserRouter>;
}

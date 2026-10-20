import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ProductGallery from "../components/ProductGallery.jsx";
import { useCart } from "../../cart/context/useCart.js";
import AddedToCartModal from "../../cart/components/AddedToCartModal.jsx";
import { useAuth } from "../../auth/context/useAuth.js";
import useProductDetail from "../hooks/useProductDetail";
import RichTextContent from "../../../shared/rich-text/RichTextContent";
import { money } from "../../../shared/utils/format.js";
import { hasRouteAccess, CUSTOMER_ROLES } from "../../auth/model/access";
import { IconArrowLeft, IconCheck, IconDownload, IconPackage, IconShoppingBag } from "@tabler/icons-react";
import "../catalog.css";
import "../product-detail.css";

export default function ProductDetail() {
    const { id } = useParams();
    return <ProductDetailContent key={id} id={id} />;
}

function ProductDetailContent({ id }) {
    const { product, detail, variants, selectVariant, error, loading } =
        useProductDetail(id);
    const [showAddedModal, setShowAddedModal] = useState(false);
    const closeAddedModal = useCallback(() => setShowAddedModal(false), []);
    const { cart, addToCart, getAvailableStock } = useCart();
    const auth = useAuth();
    const navigate = useNavigate();
    if (error)
        return (
            <div className="page">
                <p role="alert">{error}</p>
                <Link to="/"> Volver a productos</Link>
            </div>
        );
    if (loading || !product)
        return (
            <div className="loading" role="status">
                Cargando producto…
            </div>
        );
    const stock = getAvailableStock(product);
    const unavailable = product.type === "PHYSICAL" && stock <= 0;
    const added = cart.some((item) => item.id === product.id);
    const digitalInCart = product.type === "DIGITAL" && added;
    return (
        <div className="page product-detail-page">
            <Link to="/" className="back-link">
                <IconArrowLeft size={17} aria-hidden="true" /> Volver a productos
            </Link>
            <section className="product-detail" aria-labelledby="product-detail-title">
                <ProductGallery product={detail} />
                <div className="detail-copy">
                    <h1 id="product-detail-title">{detail.name}</h1>
                    {detail.tags.length > 0 && (
                        <ul className="detail-tags" aria-label="Tags del producto">
                            {detail.tags.map((tag) => <li key={tag}>{tag}</li>)}
                        </ul>
                    )}
                    <div className="detail-price">
                        {product.discounted && (
                            <div className="detail-price-offer">
                                <del aria-label="Precio original">{money(product.unitPrice)}</del>
                                <span className="product-discount">Con descuento</span>
                            </div>
                        )}
                        <div className="detail-price-current">{money(product.price)} <span>ARS</span></div>
                    </div>
                    <div
                        className="product-format-picker"
                        role="group"
                        aria-label="Elegir formato"
                    >
                        <p>Elegí el formato</p>
                        <div>
                            {variants.map((variant) => (
                                <button
                                    type="button"
                                    className={`product-format ${variant.id === product.id ? "is-selected" : ""}`}
                                    key={variant.id}
                                    onClick={() => selectVariant(variant.id)}
                                    aria-pressed={variant.id === product.id}
                                >
                                    <span className="detail-format-heading">
                                        {variant.type === "PHYSICAL" ? <IconPackage size={19} aria-hidden="true" /> : <IconDownload size={19} aria-hidden="true" />}
                                        <strong>
                                            {variant.type === "PHYSICAL"
                                                ? "Físico"
                                                : "Digital"}
                                        </strong>
                                        <span className="detail-format-indicator" aria-hidden="true">{variant.id === product.id && <IconCheck size={12} />}</span>
                                    </span>
                                    <span className="detail-format-price">{money(variant.price)}</span>
                                    {variant.discounted && (
                                        <small>Con descuento</small>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className={`detail-availability${unavailable ? ' is-unavailable' : ''}`} aria-live="polite">
                        {product.type === "PHYSICAL" ? <IconPackage size={18} aria-hidden="true" /> : <IconDownload size={18} aria-hidden="true" />}
                        <span>
                        {product.type === "PHYSICAL"
                            ? `Stock disponible: ${stock}.`
                            : "Descarga disponible una vez aprobado el pago."}
                        </span>
                    </p>
                    <div className="detail-purchase-actions">
                        <button
                            className="btn-primary"
                            disabled={unavailable || digitalInCart}
                            onClick={() => {
                                if (!auth.isAuthenticated) {
                                    navigate("/auth", {
                                        state: { from: `/products/${id}` },
                                    });
                                    return;
                                }
                                if (!hasRouteAccess(auth, CUSTOMER_ROLES)) {
                                    navigate("/");
                                    return;
                                }
                                addToCart({
                                    ...product,
                                    name: detail.name,
                                    thumbnail: detail.thumbnail,
                                });
                                setShowAddedModal(true);
                            }}
                        >
                            <IconShoppingBag size={20} aria-hidden="true" />
                            {unavailable
                                ? "Sin stock"
                                : digitalInCart
                                  ? "Ya está en el carrito"
                                  : added
                                    ? "Agregar otra unidad"
                                    : "Agregar al carrito"}
                        </button>
                        {(added || digitalInCart) && (
                            <Link className="btn-secondary" to="/cart">
                                Ver carrito
                            </Link>
                        )}
                    </div>
                </div>
            </section>
            <section className="detail-description" aria-labelledby="detail-description-title">
                <h2 id="detail-description-title">Sobre este producto</h2>
                <RichTextContent value={detail.description} />
            </section>
            {showAddedModal && (
                <AddedToCartModal
                    productName={product.name}
                    onClose={closeAddedModal}
                    onGoToCart={() => navigate("/cart")}
                />
            )}
        </div>
    );
}

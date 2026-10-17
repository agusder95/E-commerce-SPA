export default function ProductCover({ product, hero = false }) {
  if (!product) return null;
  return <div className={`product-cover ${hero ? 'cover-hero' : ''}`}>
    {product.thumbnail
      ? <img src={product.thumbnail} alt={product.name} loading={hero ? 'eager' : 'lazy'} />
      : <span className="product-image-empty">Sin imagen</span>}
  </div>;
}

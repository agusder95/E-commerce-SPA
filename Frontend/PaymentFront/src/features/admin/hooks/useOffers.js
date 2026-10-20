import { useEffect, useState } from 'react';
import { getCoupons, saveCoupon, getAdminProducts, getTags, saveProductOffers } from '../api/admin';
import { couponErrors, couponPayload, discountErrors, filterCoupons, filterOfferProducts, freshCoupon, simulatedPrice, paginateOfferProducts } from '../model/offers.js';
import { formatDate, expirationISO } from '../../../shared/utils/date.js';
import { tagKey } from '../products/model/productForm.js';

export default function useOffers() {
  const [section, setSection] = useState('offers');
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [tags, setTags] = useState([]);
  const [selected, setSelected] = useState([]);
  const [productTags, setProductTags] = useState([]);
  const [productSort, setProductSort] = useState('alphabetical');
  const [productSearch, setProductSearch] = useState('');
  const [offerStatus, setOfferStatus] = useState('all');
  const [productPage, setProductPage] = useState(1);
  const [discount, setDiscount] = useState('');
  const [expiration, setExpiration] = useState('');
  const [couponForm, setCouponForm] = useState(freshCoupon);
  const [couponFilter, setCouponFilter] = useState('active');
  const [couponSort, setCouponSort] = useState('expiration-asc');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([getAdminProducts(false, options), getCoupons(options), getTags(options)])
      .then(([products, coupons, tags]) => { if (active) { setProducts(products); setCoupons(coupons); setTags(tags); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const productsPagination = paginateOfferProducts(filterOfferProducts(products, productTags, productSort, offerStatus, undefined, productSearch, discount), productPage);
  const visibleProducts = productsPagination.items;
  const selectedProducts = products.filter(product => selected.includes(product.id));
  const visibleCoupons = filterCoupons(coupons, couponFilter, couponSort);
  const offerErrors = discountErrors(discount, expiration);
  const formErrors = couponErrors(couponForm);
  const validPrices = selectedProducts.every(product => {
    const price = simulatedPrice(product.unitPrice, discount);
    return price > 0 && price < product.unitPrice;
  });

  function toggleProduct(id) { setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]); }
  function selectVisible(checked) {
    setSelected(previous => checked ? [...new Set([...previous, ...visibleProducts.map(product => product.id)])]
      : previous.filter(id => !visibleProducts.some(product => product.id === id)));
  }
  function toggleTag(name) { setProductTags(previous => previous.includes(name) ? previous.filter(tag => tag !== name) : [...previous, name]); setProductPage(1); }
  function couponField(field, value) { setCouponForm(previous => ({ ...previous, [field]: value })); }
  function toggleCouponTag(id) { setCouponForm(previous => ({ ...previous, tagIds: previous.tagIds.includes(id)
    ? previous.tagIds.filter(value => value !== id) : [...previous.tagIds, id] })); }
  function requestOffer(remove) {
    if (busy || !selectedProducts.length || (!remove && (offerErrors.length || !validPrices))) return;
    setConfirmation({ remove, products: selectedProducts, payload: { ids: selectedProducts.map(product => product.id), remove, discount: Number(discount), expirationDate: expirationISO(expiration) } });
  }
  async function confirmOffer() {
    if (!confirmation || busy) return;
    setBusy(true); setError(''); setNotice('');
    let saved = false;
    try {
      await saveProductOffers(confirmation.payload); saved = true;
      setConfirmation(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (!confirmation.remove) { setDiscount(''); setExpiration(''); setSelected([]); }
      setProducts(await getAdminProducts());
      setNotice(confirmation.remove ? 'Ofertas eliminadas de los productos seleccionados.' : 'Ofertas guardadas en los productos seleccionados.');
    } catch (e) { setError(saved ? 'La operación se guardó, pero no se pudo actualizar la lista. Recargá la página.' : e.message); }
    finally { setBusy(false); setConfirmation(null); }
  }
  async function submitCoupon(event) {
    event.preventDefault();
    if (busy || formErrors.length) return;
    setBusy(true); setError(''); setNotice('');
    let saved = false;
    try {
      await saveCoupon(couponPayload(couponForm), couponForm.id); saved = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCoupons(await getCoupons());
      setNotice(couponForm.id ? 'Cupón actualizado.' : 'Cupón creado.');
      setCouponForm(freshCoupon());
    } catch (e) { setError(saved ? 'El cupón se guardó, pero no se pudo actualizar la lista. Recargá la página.' : e.message); }
    finally { setBusy(false); }
  }
  function editCoupon(coupon) {
    setError(''); setNotice('');
    setCouponForm({ id: coupon.idCoupon, code: coupon.code, discount: String(coupon.discount), expiration: formatDate(coupon.expirationDate),
      productType: coupon.productType || '', isActive: coupon.isActive, cumulative: Boolean(coupon.cumulative),
      tagIds: tags.filter(tag => coupon.tags.some(name => tagKey(name) === tagKey(tag.name))).map(tag => tag.idTag) });
  }

  return { section, setSection, tags, loading, busy, error, notice, discount, setDiscount, expiration, setExpiration,
    productTags, toggleTag, productSort, setProductSort: sort => { setProductSort(sort); setProductPage(1); },
    productSearch, setProductSearch: value => { setProductSearch(value); setProductPage(1); },
    offerStatus, setOfferStatus: value => { setOfferStatus(value); setProductPage(1); },
    productsPagination, setProductPage, visibleProducts, selected, selectedProducts, toggleProduct, selectVisible,
    canSaveOffer: selectedProducts.length > 0 && !offerErrors.length && validPrices,
    canRemoveOffer: selectedProducts.some(product => product.discountPrice > 0), offerErrors,
    priceError: selectedProducts.length > 0 && !offerErrors.length && !validPrices ? 'El descuento debe dejar un precio positivo menor al original en todos los productos seleccionados.' : '',
    requestOffer, confirmation, confirmOffer, cancelConfirmation: () => setConfirmation(null),
    couponForm, couponField, toggleCouponTag, submitCoupon, editCoupon, resetCoupon: () => setCouponForm(freshCoupon()),
    formErrors, canSaveCoupon: !formErrors.length, couponFilter, setCouponFilter, couponSort, setCouponSort, visibleCoupons };
}

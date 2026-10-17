import { useEffect, useRef, useState } from 'react';
import { getAdminProducts, saveProduct, changeProductStatus, getTags, createTag, deleteTags } from '../../api/admin';
import useProductMedia from './useProductMedia';
import { freshForm, tagKey, canonicalTag, validateTag, similarTags, productFormErrors, paginateAdminProducts,
  productNameForSave, changeProductType, toProductPayload, filterAdminProducts } from '../model/productForm';

export default function useAdminProducts() {
  const [section, setSection] = useState('new');
  const [products, setProducts] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [form, setForm] = useState(freshForm);
  const [sort, setSort] = useState('alphabetical');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('current');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [successModal, setSuccessModal] = useState('');
  const mediaEditor = useProductMedia({ busy, setBusy, setError, setNotice, setForm, digitalFiles: form?.digitalFiles || [] });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([getAdminProducts(true, options), getTags(options)]).then(([data, availableTags]) => {
      if (active) { setProducts(data); setTags(availableTags); setTagsLoaded(true); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!successModal) return;
    const timeout = setTimeout(() => setSuccessModal(''), 5000);
    return () => clearTimeout(timeout);
  }, [successModal]);

  function changeSection(next) {
    setSection(next); setSelected([]); setPage(1); setError(''); setNotice(''); mediaEditor.reset();
    setNewTag(''); setTagManagerOpen(false); setForm(next === 'new' ? freshForm() : null);
  }
  function edit(product) {
    const gallery = [...new Set([...(product.gallery || []), ...(product.thumbnail ? [product.thumbnail] : [])])];
    setError(''); setNotice(''); mediaEditor.reset(); setNewTag(''); setTagManagerOpen(false);
    setForm({ ...freshForm(), ...product, originalType: product.type, gallery, tagIds: tags.filter(tag => product.tags.some(name => tagKey(name) === tagKey(tag.name))).map(tag => tag.idTag),
      discountPrice: product.discountPrice ?? '', discountEndDate: product.discountEndDate?.slice(0, 10) || '' });
  }
  function field(key, value) { setForm(previous => ({ ...previous, [key]: value })); }
  const filtered = filterAdminProducts(products, section, status, sort, search);
  const pagination = paginateAdminProducts(filtered, page);
  const visible = pagination.items;
  const selectedProducts = filtered.filter(product => selected.includes(product.id));
  function toggle(id) { setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]); }
  function requestSave(event) {
    event.preventDefault();
    if (busy || !form) return;
    setError('');
    const errors = productFormErrors(form);
    if (errors.length) { setConfirmation({ kind: 'validation', errors }); return; }
    setConfirmation({ kind: 'save', product: { ...form, productName: productNameForSave(form), gallery: [...form.gallery] } });
  }
  async function confirm() {
    if (busy || submitting.current || !confirmation || confirmation.kind === 'validation') return;
    submitting.current = true; setBusy(true); setError(''); setNotice('');
    const action = confirmation;
    let completed = false;
    try {
      if (action.kind === 'tag') {
        const tag = await createTag(action.name); completed = true;
        setTags(previous => [...previous, tag].sort((a, b) => a.name.localeCompare(b.name, 'es')));
        setForm(previous => ({ ...previous, tagIds: [...previous.tagIds, tag.idTag] }));
        setNewTag(''); setNotice('Tag creado y seleccionado.');
      } else if (action.kind === 'deleteTags') {
        await deleteTags(action.tags.map(tag => tag.idTag)); completed = true;
        const ids = new Set(action.tags.map(tag => tag.idTag));
        const keys = new Set(action.tags.map(tag => tagKey(tag.name)));
        setTags(previous => previous.filter(tag => !ids.has(tag.idTag)));
        setForm(previous => ({ ...previous, tagIds: previous.tagIds.filter(id => !ids.has(id)) }));
        setProducts(previous => previous.map(product => ({ ...product, tags: product.tags.filter(name => !keys.has(tagKey(name))) })));
        setNotice('Tags eliminados y quitados de los productos que los contenían.');
      } else if (action.kind === 'save') {
        const product = action.product;
        await saveProduct(product.id, toProductPayload(product)); completed = true;
        setForm(section === 'new' ? freshForm() : null); mediaEditor.reset(); setNewTag(''); setTagManagerOpen(false);
        const message = product.id ? product.type === 'BOTH' ? 'Cambios guardados y variante faltante creada.' : 'Cambios guardados.'
          : product.type === 'BOTH' ? 'Variantes física y digital creadas.' : 'Producto creado correctamente.';
        if (product.id) setNotice(message); else setSuccessModal(message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        await changeProductStatus(action.products.map(product => product.id), action.deleted); completed = true;
        setSelected([]);
        setNotice(action.deleted ? 'Productos eliminados. Podés restaurarlos desde Eliminados.' : 'Productos restaurados.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setConfirmation(null);
      if (action.kind !== 'tag') setProducts(await getAdminProducts(true));
    } catch (e) {
      setConfirmation(null);
      setError(completed ? 'La operación se guardó, pero no se pudo actualizar la lista. Recargá la página.' : e.message);
    } finally { setBusy(false); submitting.current = false; }
  }
  function changeType(type) { setForm(previous => changeProductType(previous, type)); }
  function backToList() { setForm(null); setError(''); setTagManagerOpen(false); }
  function changeStatus(next) { setStatus(next); setPage(1); setSelected([]); setError(''); setNotice(''); }
  function requestStatus() { if (!busy && selectedProducts.length) setConfirmation({ kind: 'status', deleted: status === 'current', products: selectedProducts }); }
  function requestCreateTag() {
    if (busy) return;
    const name = canonicalTag(newTag);
    const validation = validateTag(name, tags);
    if (validation) { setError(validation); return; }
    setError(''); setConfirmation({ kind: 'tag', name, similar: similarTags(name, tags) });
  }
  function requestDeleteTags() {
    const selectedTags = tags.filter(tag => form.tagIds.includes(tag.idTag) && !['FISICO', 'DIGITAL'].includes(tagKey(tag.name)));
    if (!busy && selectedTags.length) setConfirmation({ kind: 'deleteTags', tags: selectedTags });
  }
  return {
    section, form, sort, search, status, selected, busy, loading, error, notice, visible, confirmation, pagination, setPage,
    setSearch: value => { setSearch(value); setPage(1); },
    selectedCount: selectedProducts.length, successModal, dismissSuccess: () => setSuccessModal(''),
    changeSection, edit, field, changeType, backToList, changeStatus,
    setSort: next => { setSort(next); setPage(1); }, toggle,
    selectAll: checked => setSelected(previous => checked ? [...new Set([...previous, ...visible.map(product => product.id)])]
      : previous.filter(id => !visible.some(product => product.id === id))),
    requestStatus, requestSave, confirm, cancelConfirmation: () => { if (!busy) setConfirmation(null); },
    tagEditor: { tags, loaded: tagsLoaded, newTag, onNewTag: setNewTag, onCreate: requestCreateTag,
      managementOpen: tagManagerOpen, onToggleManagement: () => setTagManagerOpen(value => !value), onDelete: requestDeleteTags },
    mediaEditor,
  };
}

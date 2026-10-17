import { useId } from 'react';
import { formatType, tagKey } from '../model/productForm';

export default function ProductTags({ tags, selectedIds, type, loaded, newTag, onNewTag, onSelection, onCreate,
  managementOpen, onToggleManagement, onDelete }) {
  const panelId = useId();
  const available = tags.filter(tag => !['FISICO', 'DIGITAL'].includes(tagKey(tag.name)));
  const selectedCount = available.filter(tag => selectedIds.includes(tag.idTag)).length;
  return <div className="form-group">
    <div className="product-tags-heading"><h4>Tags</h4><button type="button" className="tag-manager-toggle" disabled={!loaded}
      aria-label={managementOpen ? 'Cerrar gestión de tags' : 'Administrar tags'} aria-expanded={managementOpen} aria-controls={panelId} onClick={onToggleManagement}>{managementOpen ? '−' : '+'}</button></div>
    <p>Automáticos (no seleccionables): {type === 'BOTH' ? 'Físico · Digital' : formatType(type)}</p>
    <div className="product-tag-list">{available.map(tag => <label key={tag.idTag}>
      <input type="checkbox" checked={selectedIds.includes(tag.idTag)} onChange={event => onSelection(event.target.checked ? [...selectedIds, tag.idTag] : selectedIds.filter(id => id !== tag.idTag))} /> {tag.name}
    </label>)}</div>
    {loaded && !available.length && <p>No hay tags personalizados. Abrí “+” para crear uno.</p>}
    {managementOpen && <div id={panelId} className="tag-manager-panel">
      <label htmlFor="new-tag">Nuevo tag (máximo 15 caracteres)</label>
      <input id="new-tag" maxLength={15} value={newTag} onChange={event => onNewTag(event.target.value.normalize('NFC'))} placeholder="Ej. Diseño" />
      <button type="button" className="btn-secondary" disabled={!loaded || !newTag.trim()} onClick={onCreate}>Crear tag</button>
      <p>Para eliminar tags, marcalos en la lista de arriba. Se quitarán también de todos los productos que los contengan.</p>
      <button type="button" className="btn-secondary" disabled={!loaded || !selectedCount} onClick={onDelete}>Eliminar tags seleccionados ({selectedCount})</button>
      <p>Físico y Digital se conservan siempre.</p>
    </div>}
  </div>;
}

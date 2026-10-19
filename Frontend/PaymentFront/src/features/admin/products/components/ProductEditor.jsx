import ProductTags from './ProductTags';
import ProductMedia from './ProductMedia';
import RichTextEditor from '../../../../shared/rich-text/RichTextEditor';

export default function ProductEditor({ section, form, busy, tagEditor, mediaEditor, onField, onChangeType, onSubmit, onBack }) {
  return <form className="product-editor" onSubmit={onSubmit} noValidate>
      <fieldset className="product-editor-fields" disabled={busy}>
        <h3>{section === 'new' ? 'Nuevo producto' : `Editar: ${form.productName}`}</h3>
        <p>{section === 'new' ? 'Ambas crea dos productos separados, con precios propios y stock sólo para el físico.' :
          'Ambas conserva la variante original y crea la faltante, con precios propios y stock sólo para el físico. Si la otra variante ya existe, editala por separado.'}</p>
        <div className="product-form-grid">
          <div className="form-group"><label htmlFor="product-name">Nombre del producto</label><input id="product-name" required maxLength={150} value={form.productName} onChange={event => onField('productName', event.target.value)} /></div>
          <div className="form-group"><label htmlFor="product-price">{form.type === 'BOTH' ? 'Precio físico (ARS)' : 'Precio (ARS)'}</label><input id="product-price" type="number" min="0.01" step="0.01" required value={form.unitPrice} onChange={event => onField('unitPrice', event.target.value)} /></div>
          {form.type === 'BOTH' && <div className="form-group"><label htmlFor="product-digital-price">Precio digital (ARS)</label><input id="product-digital-price" type="number" min="0.01" step="0.01" required value={form.digitalUnitPrice} onChange={event => onField('digitalUnitPrice', event.target.value)} /></div>}
          <div className="form-group"><label htmlFor="product-type">Tipo</label><select id="product-type" value={form.type} onChange={event => {
            onChangeType(event.target.value);
          }}><option value="PHYSICAL">Físico</option><option value="DIGITAL">Digital</option><option value="BOTH">Ambas</option></select></div>
          <div className="form-group"><label htmlFor="product-stock">Stock físico · unidades</label><input id="product-stock" type="number" min="0" step="1" disabled={form.type === 'DIGITAL'} required={form.type !== 'DIGITAL'} value={form.type !== 'DIGITAL' ? form.stock : ''} placeholder={form.type === 'DIGITAL' ? 'No aplica' : '0'} onChange={event => onField('stock', event.target.value)} />{/* <p>{form.type === 'DIGITAL' ? 'Los productos digitales no requieren stock.' : 'Cantidad de unidades físicas disponibles para comprar.'}</p> */}</div>
        </div>
        <div className="form-group"><label htmlFor="product-description">Descripción (opcional)</label><RichTextEditor id="product-description" value={form.description}
          disabled={busy} onChange={value => onField('description', value)} /></div>
        <ProductTags {...tagEditor} type={form.type} selectedIds={form.tagIds} onSelection={ids => onField('tagIds', ids)} />
        <ProductMedia {...mediaEditor} form={form} busy={busy} onThumbnail={url => onField('thumbnail', url)} />
        
        <div className="product-editor-actions">{section === 'edit' && <button type="button" className="btn-secondary" onClick={onBack}>Volver a la lista</button>}
          <button type="submit" className="btn-primary" disabled={!tagEditor.loaded}>
            {section === 'new' ? 'Crear producto' : 'Guardar cambios'}</button>
        </div>
      </fieldset>
      {busy && <p role="status">Procesando…</p>}
    </form>;
}

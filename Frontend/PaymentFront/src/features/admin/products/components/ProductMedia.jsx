import { IconLink, IconTrash, IconFile, IconUpload } from '@tabler/icons-react';
import { useState } from 'react';

export default function ProductMedia({ form, busy, imageUrl, dragging, uploadingImages, uploadingDigital, onImageUrl, onDragging,
  onUploadImages, onImportUrl, onUploadDigital, onRemoveImage, onRemoveDigital, onOpenDigital, onThumbnail }) {
  const [digitalDragging, setDigitalDragging] = useState(false);
  return <>
        <div className={`product-image-dropzone ${dragging ? 'is-dragging' : ''}`} aria-busy={uploadingImages}
          onDragOver={event => { event.preventDefault(); if (!busy) onDragging(true); }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) onDragging(false); }}
          onDrop={event => { event.preventDefault(); onDragging(false); if (!busy) onUploadImages(Array.from(event.dataTransfer.files)); }}>
          <label htmlFor="product-gallery"><IconUpload size={27} stroke={1.5} aria-hidden="true" /><strong>Galería de imágenes</strong><span>Arrastrá tus imágenes acá o importalas desde tu dispositivo.</span></label>
          <input id="product-gallery" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => {
            onUploadImages(Array.from(event.target.files)); event.target.value = '';
          }} />
          <p>JPG, PNG, WebP o GIF · Hasta 10 MB por imagen. La primera imagen será la miniatura.</p>
        </div>
        {uploadingImages && <div className="product-media-upload-status" role="status"><span className="product-upload-spinner" aria-hidden="true" />Subiendo imágenes…</div>}
        <div className="form-group product-image-url"><label htmlFor="product-image-url">Importar imagen desde URL</label><div>
          <input id="product-image-url" type="url" value={imageUrl} onChange={event => onImageUrl(event.target.value)} placeholder="https://…" />
          <button type="button" className="btn-secondary" disabled={!imageUrl.trim()} onClick={onImportUrl}><IconLink size={18} aria-hidden="true" />Importar</button>
        </div></div>
        <div className="product-gallery-manager">{form.gallery.map((url, index) => <article className={`product-gallery-item ${form.thumbnail === url ? 'is-thumbnail' : ''}`} key={url}>
          <img src={url} alt={`Imagen ${index + 1} de ${form.productName || 'producto'}`} />
          <label><input type="radio" name="product-thumbnail" checked={form.thumbnail === url} onChange={() => onThumbnail(url)} />Miniatura</label>
          <button type="button" className="resend-button media-action" onClick={() => onRemoveImage(url)} aria-label={`Quitar imagen ${index + 1}`}><IconTrash size={18} aria-hidden="true" />Quitar</button>
        </article>)}</div>
        {form.type !== 'PHYSICAL' && <div className="form-group product-digital-upload">
          <div className={`product-file-dropzone${digitalDragging ? ' is-dragging' : ''}`} aria-busy={uploadingDigital}
            onDragOver={event => { event.preventDefault(); if (!busy) setDigitalDragging(true); }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDigitalDragging(false); }}
            onDrop={event => { event.preventDefault(); event.stopPropagation(); setDigitalDragging(false); if (!busy) onUploadDigital(Array.from(event.dataTransfer.files)); }}>
          <label htmlFor="product-file"><IconUpload size={27} stroke={1.5} aria-hidden="true" /><strong>Archivos digitales</strong><span>Arrastrá tus archivos acá o seleccionalos desde tu dispositivo.</span></label>
          <input id="product-file" type="file" multiple onChange={event => {
            onUploadDigital(Array.from(event.target.files)); event.target.value = '';
          }} /><p>Hasta 100 MB por archivo · Hasta 50 archivos por producto.</p>
          </div>
          {uploadingDigital && <div className="product-media-upload-status" role="status"><span className="product-upload-spinner" aria-hidden="true" />Subiendo archivos digitales…</div>}
          <p>{form.digitalFiles.length ? `${form.digitalFiles.length} archivos cargados. Podés agregar más o quitar los existentes.` : 'Cargá al menos un archivo digital antes de guardar.'}</p>
          <ul className="digital-file-list">{form.digitalFiles.map(file => <li key={file.key}><button type="button" className="digital-file-name digital-file-preview"
            disabled={busy} aria-label={`Abrir ${file.name} en una nueva pestaña`} onClick={() => onOpenDigital(file)}><IconFile size={18} aria-hidden="true" />{file.name}</button>
            <button type="button" className="resend-button media-action" aria-label={`Quitar archivo ${file.name}`} onClick={() => onRemoveDigital(file.key)}><IconTrash size={18} aria-hidden="true" />Quitar</button>
          </li>)}</ul><p>Hasta 50 archivos. Quitar un archivo del producto no elimina el archivo entregado en compras anteriores.</p>
        </div>}
  </>;
}

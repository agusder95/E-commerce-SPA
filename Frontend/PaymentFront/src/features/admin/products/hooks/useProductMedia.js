import { useState } from 'react';
import { uploadAsset, importImageUrl, getDigitalPreview } from '../../api/admin';

export default function useProductMedia({ busy, setBusy, setError, setNotice, setForm, digitalFiles }) {
  const [imageUrl, setImageUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState('');
  function addImage(url) {
    setForm(previous => ({ ...previous, gallery: [...new Set([...previous.gallery, url])],
      thumbnail: previous.thumbnail || url }));
  }
  function removeImage(url) {
    setForm(previous => {
      const gallery = previous.gallery.filter(image => image !== url);
      return { ...previous, gallery, thumbnail: previous.thumbnail === url ? gallery[0] || '' : previous.thumbnail };
    });
  }
  async function uploadImages(files) {
    if (busy || !files.length) return;
    setUploading('images');
    setBusy(true); setError(''); setNotice('');
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024)
          throw new Error('Usá imágenes JPG, PNG, WebP o GIF de hasta 10 MB.');
        const { url } = await uploadAsset(file, 'image');
        addImage(url);
      }
    } catch (e) { setError(e.message); } finally { setUploading(''); setBusy(false); }
  }
  async function importUrl() {
    if (busy || !imageUrl.trim()) return;
    setUploading('images');
    setBusy(true); setError(''); setNotice('');
    try {
      const { url } = await importImageUrl(imageUrl.trim());
      addImage(url); setImageUrl('');
    } catch (e) { setError(e.message); } finally { setUploading(''); setBusy(false); }
  }
  async function uploadDigital(files) {
    if (!files.length || busy) return;
    setUploading('digital');
    setBusy(true); setError(''); setNotice('');
    try {
      if (digitalFiles.length + files.length > 50) throw new Error('Podés cargar hasta 50 archivos por producto.');
      for (const file of files) {
        if (!file.size || file.size > 100 * 1024 * 1024) throw new Error('Cada archivo debe tener entre 1 byte y 100 MB.');
        const { key } = await uploadAsset(file, 'digital');
        setForm(previous => ({ ...previous, digitalFiles: [...previous.digitalFiles, { key, name: file.name }] }));
      }
    } catch (e) { setError(e.message); } finally { setUploading(''); setBusy(false); }
  }
  function removeDigital(key) {
    setForm(previous => ({ ...previous, digitalFiles: previous.digitalFiles.filter(file => file.key !== key) }));
  }

  async function openDigital(file) {
    if (busy) return;
    setError('');
    // Open during the click so popup blockers do not reject the asynchronous URL.
    const preview = window.open('about:blank', '_blank');
    if (!preview) { setError('Permití abrir nuevas pestañas para ver el archivo.'); return; }
    preview.opener = null;
    setBusy(true);
    try {
      const { url } = await getDigitalPreview(file.key);
      preview.location.replace(url);
    } catch (e) {
      preview.close(); setError(e.message);
    } finally { setBusy(false); }
  }


  return { imageUrl, dragging, uploadingImages: uploading === 'images', uploadingDigital: uploading === 'digital',
    onImageUrl: setImageUrl, onDragging: setDragging,
    onUploadImages: uploadImages, onImportUrl: importUrl, onUploadDigital: uploadDigital,
    onRemoveImage: removeImage, onRemoveDigital: removeDigital,
    onOpenDigital: openDigital,
    reset: () => { setImageUrl(''); setDragging(false); } };
}

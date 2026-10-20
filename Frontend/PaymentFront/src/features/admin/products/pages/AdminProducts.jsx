import useAdminProducts from '../hooks/useAdminProducts';
import ProductManagementList from '../components/ProductManagementList';
import ProductEditor from '../components/ProductEditor';
import ProductConfirmation from '../components/ProductConfirmation';
import ProductStockDialog from '../components/ProductStockDialog';
import Feedback from '../../../../shared/ui/Feedback';
import Tabs from '../../../../shared/ui/Tabs';
import ConfirmDialog from '../../../../shared/ui/ConfirmDialog.jsx';
import { IconPackage, IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';
import '../products.css';

const sections = [['new', <><IconPlus size={17} aria-hidden="true" />Nuevo</>],
  ['edit', <><IconPencil size={17} aria-hidden="true" />Editar</>],
  ['delete', <><IconTrash size={17} aria-hidden="true" />Borrar</>]];
export default function AdminProducts() {
  const manager = useAdminProducts();
  return <section className="admin-panel admin-products">
    <header className="admin-products-heading"><span className="admin-products-icon" aria-hidden="true"><IconPackage size={25} /></span>
      <div><h2>Productos</h2><p>Creá y organizá los juegos y recursos de tu tienda.</p></div></header>
    <Tabs label="Secciones de productos" options={sections} value={manager.section}
      disabled={manager.busy || manager.stockEditor.hasChanges} onChange={manager.changeSection} />
    <Feedback error={manager.error} notice={manager.notice} />
    {manager.section !== 'new' && !manager.form && <ProductManagementList
      section={manager.section} status={manager.status} sort={manager.sort} selected={manager.selected}
      loading={manager.loading} busy={manager.busy} products={manager.visible}
      onSort={manager.setSort} onStatus={manager.changeStatus} onEdit={manager.edit}
      search={manager.search} onSearch={manager.setSearch}
      pagination={manager.pagination} onPage={manager.setPage} selectedCount={manager.selectedCount}
      stockEditor={manager.stockEditor}
      onToggle={manager.toggle} onSelectAll={manager.selectAll} onRequestStatus={manager.requestStatus} />}
    {manager.form && <ProductEditor section={manager.section} form={manager.form} busy={manager.busy}
      tagEditor={manager.tagEditor} mediaEditor={manager.mediaEditor} onField={manager.field}
      onChangeType={manager.changeType} onSubmit={manager.requestSave} onBack={manager.backToList} />}
    <ProductConfirmation confirmation={manager.confirmation} busy={manager.busy}
      onCancel={manager.cancelConfirmation} onConfirm={manager.confirm} />
    <ProductStockDialog editor={manager.stockEditor} busy={manager.busy} />
    {manager.successModal && <ConfirmDialog title="Producto guardado" cancelLabel={null} confirmLabel="Entendido"
      onCancel={manager.dismissSuccess} onConfirm={manager.dismissSuccess}>
      <p>{manager.successModal}</p><p>Este mensaje se cerrará automáticamente en 5 segundos.</p>
    </ConfirmDialog>}
  </section>;
}

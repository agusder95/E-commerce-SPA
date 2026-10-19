import ConfirmDialog from "../../../../shared/ui/ConfirmDialog";
import { money } from "../../../../shared/utils/format";
import { formatType } from "../model/productForm";

export default function ProductConfirmation({
    confirmation,
    busy,
    onCancel,
    onConfirm,
}) {
    if (!confirmation) return null;
    if (confirmation.kind === 'validation') return <ConfirmDialog title="Revisá los campos obligatorios" cancelLabel={null}
        confirmLabel="Entendido" onCancel={onCancel} onConfirm={onCancel}>
        <p>Completá o corregí estos campos antes de guardar:</p><ul>{confirmation.errors.map(error => <li key={error}>{error}</li>)}</ul>
      </ConfirmDialog>;
    if (confirmation.kind === 'deleteTags') return <ConfirmDialog title="¿Eliminar los tags seleccionados?" busy={busy}
        confirmLabel="Eliminar tags" onCancel={onCancel} onConfirm={onConfirm}>
        <p>Se eliminarán de la lista de tags y de todos los productos que los contengan, incluidos los productos eliminados. Físico y Digital se conservan.</p>
        <ul>{confirmation.tags.map(tag => <li key={tag.idTag}>{tag.name}</li>)}</ul>
      </ConfirmDialog>;
    return (
        <ConfirmDialog
            busy={busy}
            onCancel={onCancel}
            onConfirm={onConfirm}
            title={
                confirmation.kind === "tag"
                    ? "¿Crear tag?"
                    : confirmation.kind === "save"
                      ? confirmation.product.id
                          ? "¿Guardar cambios?"
                          : "¿Crear producto?"
                      : confirmation.deleted
                        ? "¿Eliminar productos?"
                        : "¿Restaurar productos?"
            }
            confirmLabel={
                confirmation.kind === "tag"
                    ? "Crear tag"
                    : confirmation.kind === "save"
                      ? confirmation.product.id
                          ? "Guardar cambios"
                          : "Crear producto"
                      : confirmation.deleted
                        ? "Eliminar"
                        : "Restaurar"
            }
        >
            {confirmation.kind === "tag" ? (
                <><p>
                    Se guardará como <strong>{confirmation.name}</strong>.
                </p>
                {confirmation.similar?.length > 0 && <><p>Ya existen tags parecidos:</p>
                  <ul>{confirmation.similar.map(tag => <li key={tag.idTag}>{tag.name}</li>)}</ul>
                  <p>¿Querés crear «{confirmation.name}» de todas formas?</p></>}
                </>
            ) : confirmation.kind === "save" ? (
                <>
                    <p>
                        <strong>{confirmation.product.productName}</strong> ·{" "}
                        {formatType(
                            confirmation.product.type === "BOTH"
                                ? "PHYSICAL"
                                : confirmation.product.type,
                        )}{" "}
                        · {money(Number(confirmation.product.unitPrice))}
                    </p>
                    {confirmation.product.type === "BOTH" && (
                        <p>
                            <strong>{confirmation.product.productName}</strong>{" "}
                            · Digital ·{" "}
                            {money(
                                Number(confirmation.product.digitalUnitPrice),
                            )}
                        </p>
                    )}
                    {confirmation.product.id &&
                        confirmation.product.type === "BOTH" && (
                            <p>
                                Se actualizará la variante{" "}
                                {formatType(
                                    confirmation.product.originalType,
                                ).toLowerCase()}{" "}
                                y se creará la variante{" "}
                                {confirmation.product.originalType ===
                                "PHYSICAL"
                                    ? "digital"
                                    : "física"}
                            </p>
                        )}
                    {confirmation.product.type !== "PHYSICAL" && (
                        <>
                            <p>Archivos incluidos:</p>
                            <ul>
                                {confirmation.product.digitalFiles.map(
                                    (file) => (
                                        <li key={file.key}>{file.name}</li>
                                    ),
                                )}
                            </ul>
                        </>
                    )}
                </>
            ) : (
                <>
                    <p>
                        {confirmation.deleted
                            ? "Estos productos dejarán de aparecer en el catálogo. Podés restaurarlos después."
                            : "Estos productos volverán a estar disponibles en el catálogo."}
                    </p>
                    <ul>
                        {confirmation.products.map((product) => (
                            <li key={product.id}>
                                {product.name} · {formatType(product.type)}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </ConfirmDialog>
    );
}

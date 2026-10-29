import ProductTags from "./ProductTags";
import ProductMedia from "./ProductMedia";
import RichTextEditor from "../../../../shared/rich-text/RichTextEditor";
import {
    IconArrowLeft,
    IconCheck,
    IconDeviceFloppy,
    IconInfoCircle,
    IconPhoto,
    IconTags,
} from "@tabler/icons-react";

export default function ProductEditor({
    section,
    form,
    busy,
    tagEditor,
    mediaEditor,
    onField,
    onChangeType,
    onSubmit,
    onBack,
}) {
    return (
        <form className="product-editor" onSubmit={onSubmit} noValidate>
            <fieldset className="product-editor-fields" disabled={busy}>
                <header className="product-editor-heading">
                    <h3>
                        {section === "new"
                            ? "Nuevo producto"
                            : `Editar: ${form.productName}`}
                    </h3>
                    <p>
                        {section === "new"
                            ? "Prepará tu producto para que forme parte del catálogo."
                            : "Actualizá la información, las imágenes y los archivos de este producto."}
                    </p>
                </header>
                <div className="product-editor-grid">
                    <div className="product-editor-main">
                        <section
                            className="product-editor-section"
                            aria-labelledby="product-info-title"
                        >
                            <div className="product-section-heading">
                                <h4 id="product-info-title">
                                    Información del producto
                                </h4>
                                <p>Nombre, formato, precio y disponibilidad.</p>
                            </div>
                            <div className="product-form-grid">
                                <div className="form-group product-name-field">
                                    <label htmlFor="product-name">
                                        Nombre del producto
                                    </label>
                                    <input
                                        id="product-name"
                                        required
                                        maxLength={150}
                                        value={form.productName}
                                        onChange={(event) =>
                                            onField(
                                                "productName",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="form-group product-type-field">
                                    <label htmlFor="product-type">Tipo</label>
                                    <select
                                        id="product-type"
                                        value={form.type}
                                        onChange={(event) => {
                                            onChangeType(event.target.value);
                                        }}
                                    >
                                        <option value="PHYSICAL">Físico</option>
                                        <option value="DIGITAL">Digital</option>
                                        <option value="BOTH">Ambas</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="product-price">
                                        {form.type === "BOTH"
                                            ? "Precio físico (ARS)"
                                            : "Precio (ARS)"}
                                    </label>
                                    <input
                                        id="product-price"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        required
                                        value={form.unitPrice}
                                        onChange={(event) =>
                                            onField(
                                                "unitPrice",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                {form.type === "BOTH" && (
                                    <div className="form-group">
                                        <label htmlFor="product-digital-price">
                                            Precio digital (ARS)
                                        </label>
                                        <input
                                            id="product-digital-price"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            required
                                            value={form.digitalUnitPrice}
                                            onChange={(event) =>
                                                onField(
                                                    "digitalUnitPrice",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label htmlFor="product-stock">
                                        Stock físico · unidades
                                    </label>
                                    <input
                                        id="product-stock"
                                        type="number"
                                        min="0"
                                        step="1"
                                        disabled={form.type === "DIGITAL"}
                                        required={form.type !== "DIGITAL"}
                                        value={
                                            form.type !== "DIGITAL"
                                                ? form.stock
                                                : ""
                                        }
                                        placeholder={
                                            form.type === "DIGITAL"
                                                ? "No aplica"
                                                : "0"
                                        }
                                        onChange={(event) =>
                                            onField("stock", event.target.value)
                                        }
                                    />
                                    {/* <p>{form.type === 'DIGITAL' ? 'Los productos digitales no requieren stock.' : 'Cantidad de unidades físicas disponibles para comprar.'}</p> */}
                                </div>
                            </div>
                            {/* {form.type === "BOTH" && (
                                <p className="product-format-help">
                                    <IconInfoCircle
                                        size={18}
                                        aria-hidden="true"
                                    />
                                    <span>
                                        {section === "new"
                                            ? "Ambas crea dos productos separados, con precios propios y stock sólo para el físico."
                                            : "Ambas conserva la variante original y crea la faltante, con precios propios y stock sólo para el físico. Si la otra variante ya existe, editala por separado."}
                                    </span>
                                </p>
                            )} */}
                        </section>
                        <section
                            className="product-editor-section"
                            aria-labelledby="product-description-title"
                        >
                            <div className="product-section-heading">
                                <h4 id="product-description-title">
                                    Descripción
                                </h4>
                                <p>
                                    Contá de qué se trata y qué incluye el
                                    producto.
                                </p>
                            </div>
                            <div className="form-group product-description-field">
                                <label htmlFor="product-description">
                                    Descripción (opcional)
                                </label>
                                <RichTextEditor
                                    id="product-description"
                                    value={form.description}
                                    disabled={busy}
                                    onChange={(value) =>
                                        onField("description", value)
                                    }
                                />
                            </div>
                        </section>
                        <section
                            className="product-editor-section"
                            aria-label="Etiquetas del producto"
                        >
                            <div className="product-section-heading">
                                <h4>
                                    <IconTags size={18} aria-hidden="true" />
                                    Etiquetas del catálogo
                                </h4>
                                <p>
                                    Ayudá a encontrar este producto por sus
                                    temas.
                                </p>
                            </div>
                            <ProductTags
                                {...tagEditor}
                                type={form.type}
                                selectedIds={form.tagIds}
                                onSelection={(ids) => onField("tagIds", ids)}
                            />
                        </section>
                    </div>
                    <aside
                        className="product-editor-section product-editor-media"
                        aria-labelledby="product-media-title"
                    >
                        <div className="product-section-heading">
                            <h4 id="product-media-title">
                                <IconPhoto size={18} aria-hidden="true" />
                                Imágenes y archivos
                            </h4>
                            <p>
                                Prepará la galería y el contenido del producto.
                            </p>
                        </div>
                        <ProductMedia
                            {...mediaEditor}
                            form={form}
                            busy={busy}
                            onThumbnail={(url) => onField("thumbnail", url)}
                        />
                    </aside>
                </div>
                <div className="product-editor-actions">
                    {section === "edit" && (
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={onBack}
                        >
                            <IconArrowLeft size={17} aria-hidden="true" />
                            Volver a la lista
                        </button>
                    )}
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={!tagEditor.loaded}
                    >
                        {section === "new" ? (
                            <IconCheck size={18} aria-hidden="true" />
                        ) : (
                            <IconDeviceFloppy size={18} aria-hidden="true" />
                        )}
                        {section === "new"
                            ? "Crear producto"
                            : "Guardar cambios"}
                    </button>
                </div>
            </fieldset>
            {busy && <p role="status">Procesando…</p>}
        </form>
    );
}

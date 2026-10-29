import usePurchases from "../hooks/usePurchases";
import PurchaseCard from "../components/PurchaseCard";
import PurchaseSort from "../components/PurchaseSort";
import Tabs from "../../../shared/ui/Tabs";
import Feedback from "../../../shared/ui/Feedback";
import { Link } from "react-router-dom";
import {
    IconShoppingBag,
    IconArrowLeft,
    IconReceipt,
    IconLoader2,
} from "@tabler/icons-react";
import "../my-purchases.css";

const tabs = [
    ["approved", "Aprobadas"],
    ["pending", "Pendientes y otras"],
];
export default function MyPurchases() {
    const {
        activeTab,
        purchases,
        pagination,
        setPage,
        sort,
        changeSort,
        loading,
        error,
        downloadError,
        switchTab,
        download,
        downloadTicket,
        ticketDownloading,
    } = usePurchases();
    return (
        <div className="page my-purchases-page">
            <Link to="/" className="purchases-back-link">
                <IconArrowLeft size={17} aria-hidden="true" />
                Volver a productos
            </Link>
            <header className="purchases-heading">
                <div>
                    <div className = "purchases-heading-container">
                        <span
                            className="purchases-heading-icon"
                            aria-hidden="true"
                        >
                            <IconShoppingBag size={27} stroke={1.6} />
                        </span>
                        <h1>Mis compras</h1>
                    </div>
                    <p>Tus juegos, descargas y comprobantes, en un solo lugar.</p>
                </div>
            </header>
            <section
                className="purchases-history"
                aria-label="Historial de compras"
            >
                <div className="purchases-history-toolbar">
                    <Tabs
                        label="Estado de las compras"
                        options={tabs}
                        value={activeTab}
                        onChange={switchTab}
                    />
                    {!loading && !error && (
                        <span className="purchases-result-count" role="status">
                            {purchases.length}{" "}
                            {purchases.length === 1 ? "compra" : "compras"}
                        </span>
                    )}
                </div>
                <Feedback error={error || downloadError} />
                {loading ? (
                    <div className="purchases-loading" role="status">
                        <IconLoader2 size={25} aria-hidden="true" />
                        Cargando compras…
                    </div>
                ) : (
                    !error &&
                    (purchases.length ? (
                        <>
                            <PurchaseSort sort={sort} onSort={changeSort} />
                            <div className="purchases-list">
                                {pagination.items.map((purchase) => (
                                    <PurchaseCard
                                        key={purchase.orderId}
                                        purchase={purchase}
                                        onDownload={download}
                                        onDownloadTicket={downloadTicket}
                                        ticketDownloading={ticketDownloading}
                                    />
                                ))}
                            </div>
                            {pagination.pages > 1 && (
                                <nav
                                    className="purchases-pagination"
                                    aria-label="Paginación de mis compras"
                                >
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        disabled={pagination.page === 1}
                                        onClick={() =>
                                            setPage(pagination.page - 1)
                                        }
                                    >
                                        Anterior
                                    </button>
                                    <span aria-live="polite">
                                        Página {pagination.page} de{" "}
                                        {pagination.pages}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        disabled={
                                            pagination.page === pagination.pages
                                        }
                                        onClick={() =>
                                            setPage(pagination.page + 1)
                                        }
                                    >
                                        Siguiente
                                    </button>
                                </nav>
                            )}
                        </>
                    ) : (
                        <div className="purchases-empty">
                            <span
                                className="purchases-empty-icon"
                                aria-hidden="true"
                            >
                                <IconReceipt size={32} stroke={1.5} />
                            </span>
                            <h2>
                                {activeTab === "approved"
                                    ? "Tus próximas aventuras empiezan acá"
                                    : "Todo al día"}
                            </h2>
                            <p>
                                {activeTab === "approved"
                                    ? "Aún no tenés compras aprobadas. Cuando hagas una, vas a encontrarla acá."
                                    : "No tenés compras pendientes, canceladas o por revisar."}
                            </p>
                            <Link to="/" className="btn-secondary">
                                Explorar juegos
                            </Link>
                        </div>
                    ))
                )}
            </section>
            <p className="purchases-footer-note">
                <IconReceipt size={17} aria-hidden="true" />
                Abrí una compra para acceder a sus archivos y descargar el
                ticket.
            </p>
        </div>
    );
}

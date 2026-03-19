import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Vault() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("items")
      .select("*")
      .order("expiry_date", { ascending: true });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const getStatus = (expiryDate) => {
    if (!expiryDate) return { label: "Unknown", color: "#888" };
    const now = new Date();
    const expiry = new Date(expiryDate);
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { label: "Expired", color: "#ef4444" };
    if (daysLeft < 30) return { label: `${daysLeft}d left`, color: "#f97316" };
    if (daysLeft < 90) return { label: `${daysLeft}d left`, color: "#eab308" };
    return { label: `${daysLeft}d left`, color: "#22c55e" };
  };

  const deleteItem = async (id) => {
    await supabase.from("items").delete().eq("id", id);
    fetchItems();
  };

  if (loading) {
    return <p style={{ color: "#888", padding: "2rem", textAlign: "center" }}>Loading...</p>;
  }

  if (items.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={{ fontSize: "2rem", margin: "0" }}>📦</p>
        <p style={{ color: "#888", margin: "0.5rem 0 0" }}>
          No items yet. Scan a receipt to get started.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Your Vault</h2>
      <p style={styles.count}>{items.length} item{items.length !== 1 ? "s" : ""}</p>

      <div style={styles.list}>
        {items.map((item) => {
          const status = getStatus(item.expiry_date);
          return (
            <div key={item.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.productName}>{item.product_name || "Unknown Item"}</p>
                  <p style={styles.storeName}>{item.store_name}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ ...styles.statusBadge, color: status.color, borderColor: status.color }}>
                    {status.label}
                  </span>
                </div>
              </div>

              <div style={styles.cardDetails}>
                <div style={styles.detail}>
                  <span style={styles.detailLabel}>Price</span>
                  <span style={styles.detailValue}>
                    {item.price ? `$${Number(item.price).toFixed(2)}` : "—"}
                  </span>
                </div>
                <div style={styles.detail}>
                  <span style={styles.detailLabel}>Purchased</span>
                  <span style={styles.detailValue}>
                    {item.purchase_date || "—"}
                  </span>
                </div>
                <div style={styles.detail}>
                  <span style={styles.detailLabel}>Warranty</span>
                  <span style={styles.detailValue}>
                    {item.warranty_months ? `${item.warranty_months} months` : "—"}
                  </span>
                </div>
                <div style={styles.detail}>
                  <span style={styles.detailLabel}>Expires</span>
                  <span style={{ ...styles.detailValue, color: status.color }}>
                    {item.expiry_date || "—"}
                  </span>
                </div>
              </div>

              {item.receipt_url && (
                <a href={item.receipt_url} target="_blank" rel="noopener" style={styles.receiptLink}>
                  View Receipt
                </a>
              )}

              <button onClick={() => deleteItem(item.id)} style={styles.deleteBtn}>
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: "1rem", maxWidth: "500px", margin: "0 auto" },
  heading: { color: "#fff", fontSize: "1.5rem", margin: "0" },
  count: { color: "#888", fontSize: "0.85rem", margin: "0.25rem 0 1rem" },
  empty: { padding: "3rem 1rem", textAlign: "center" },
  list: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  card: {
    background: "#1a1a1a",
    borderRadius: "12px",
    padding: "1rem",
    border: "1px solid #222",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "0.75rem",
  },
  productName: { color: "#fff", fontSize: "1.05rem", fontWeight: "600", margin: "0" },
  storeName: { color: "#888", fontSize: "0.85rem", margin: "0.15rem 0 0" },
  statusBadge: {
    fontSize: "0.75rem",
    fontWeight: "600",
    padding: "0.2rem 0.5rem",
    borderRadius: "6px",
    border: "1px solid",
  },
  cardDetails: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.5rem",
  },
  detail: { display: "flex", flexDirection: "column" },
  detailLabel: { color: "#666", fontSize: "0.75rem" },
  detailValue: { color: "#ccc", fontSize: "0.9rem" },
  receiptLink: {
    color: "#3b82f6",
    fontSize: "0.85rem",
    display: "block",
    marginTop: "0.75rem",
    textDecoration: "none",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "#ef4444",
    fontSize: "0.8rem",
    cursor: "pointer",
    padding: "0",
    marginTop: "0.5rem",
  },
};

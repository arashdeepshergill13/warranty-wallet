import { useState, useRef } from "react";
import { useReceiptParser } from "../hooks/useReceiptParser";
import { supabase } from "../lib/supabase";

export default function ScanReceipt({ onItemSaved }) {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const { parseReceipt, loading, error } = useReceiptParser();
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCapture = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setFormData(null);
    setSaved(false);
  };

  const handleParse = async () => {
    const data = await parseReceipt(file);
    if (data) {
      setFormData({
        store_name: data.store_name || "",
        product_name: data.product_name || "",
        product_category: data.product_category || "other",
        purchase_date: data.purchase_date || "",
        price: data.price || 0,
        warranty_months: data.warranty_months || 12,
        serial_number: data.serial_number || "",
        expiry_date: data.expiry_date || "",
        confidence: data.confidence || "low",
        notes: "",
      });
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "purchase_date" || field === "warranty_months") {
        const date = new Date(
          field === "purchase_date" ? value : prev.purchase_date
        );
        const months =
          field === "warranty_months" ? parseInt(value) : prev.warranty_months;
        if (!isNaN(date.getTime()) && months) {
          date.setMonth(date.getMonth() + months);
          updated.expiry_date = date.toISOString().split("T")[0];
        }
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let receipt_url = null;
    if (file) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData } = await supabase.storage
        .from("receipts")
        .upload(filePath, file);
      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("receipts")
          .getPublicUrl(filePath);
        receipt_url = urlData.publicUrl;
      }
    }

    const { error: insertError } = await supabase.from("items").insert({
      user_id: user.id,
      store_name: formData.store_name,
      product_name: formData.product_name,
      product_category: formData.product_category,
      purchase_date: formData.purchase_date || null,
      price: formData.price || null,
      warranty_months: formData.warranty_months || null,
      serial_number: formData.serial_number || null,
      expiry_date: formData.expiry_date || null,
      receipt_url,
      ocr_confidence: formData.confidence,
      notes: formData.notes || null,
    });

    setSaving(false);
    if (!insertError) {
      setSaved(true);
      setFormData(null);
      setPreview(null);
      setFile(null);
      if (onItemSaved) onItemSaved();
    }
  };

  const confidenceColor =
    formData?.confidence === "high"
      ? "#22c55e"
      : formData?.confidence === "medium"
      ? "#eab308"
      : "#ef4444";

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Scan Receipt</h2>

      {saved && (
        <div style={styles.successBanner}>Item saved to your vault!</div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        
        onChange={handleCapture}
        style={{ display: "none" }}
      />

      {!preview && (
        <button
          onClick={() => fileInputRef.current?.click()}
          style={styles.captureBtn}
        >
          📸 Take Photo or Choose Image
        </button>
      )}

      {preview && !formData && (
        <div>
          <img src={preview} alt="Receipt" style={styles.preview} />
          <div style={styles.buttonRow}>
            <button
              onClick={() => {
                setPreview(null);
                setFile(null);
              }}
              style={styles.secondaryBtn}
            >
              Retake
            </button>
            <button
              onClick={handleParse}
              style={styles.primaryBtn}
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Extract Data"}
            </button>
          </div>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}

      {formData && (
        <div style={styles.form}>
          <div style={styles.confidenceBadge}>
            <span
              style={{ ...styles.dot, background: confidenceColor }}
            ></span>
            {formData.confidence} confidence
          </div>

          <label style={styles.label}>Store</label>
          <input
            style={styles.input}
            value={formData.store_name}
            onChange={(e) => updateField("store_name", e.target.value)}
          />

          <label style={styles.label}>Product</label>
          <input
            style={styles.input}
            value={formData.product_name}
            onChange={(e) => updateField("product_name", e.target.value)}
          />

          <label style={styles.label}>Category</label>
          <select
            style={styles.input}
            value={formData.product_category}
            onChange={(e) => updateField("product_category", e.target.value)}
          >
            <option value="electronics">Electronics</option>
            <option value="appliance">Appliance</option>
            <option value="clothing">Clothing</option>
            <option value="food">Food</option>
            <option value="home">Home</option>
            <option value="tools">Tools</option>
            <option value="other">Other</option>
          </select>

          <label style={styles.label}>Purchase Date</label>
          <input
            style={styles.input}
            type="date"
            value={formData.purchase_date}
            onChange={(e) => updateField("purchase_date", e.target.value)}
          />

          <label style={styles.label}>Price ($)</label>
          <input
            style={styles.input}
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => updateField("price", parseFloat(e.target.value))}
          />

          <label style={styles.label}>Warranty (months)</label>
          <input
            style={styles.input}
            type="number"
            value={formData.warranty_months}
            onChange={(e) => updateField("warranty_months", e.target.value)}
          />

          <label style={styles.label}>Expiry Date (auto-calculated)</label>
          <input
            style={{ ...styles.input, color: "#888" }}
            type="date"
            value={formData.expiry_date}
            readOnly
          />

          <label style={styles.label}>Serial Number</label>
          <input
            style={styles.input}
            value={formData.serial_number || ""}
            onChange={(e) => updateField("serial_number", e.target.value)}
            placeholder="Optional"
          />

          <label style={styles.label}>Notes</label>
          <textarea
            style={{ ...styles.input, minHeight: "60px", resize: "vertical" }}
            value={formData.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Optional"
          />

          <div style={styles.buttonRow}>
            <button
              onClick={() => {
                setFormData(null);
                setPreview(null);
                setFile(null);
              }}
              style={styles.secondaryBtn}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={styles.primaryBtn}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save to Vault"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: "1rem", maxWidth: "500px", margin: "0 auto" },
  heading: { color: "#fff", fontSize: "1.5rem", margin: "0 0 1.5rem" },
  captureBtn: {
    width: "100%",
    padding: "3rem 1rem",
    borderRadius: "12px",
    border: "2px dashed #333",
    background: "#111",
    color: "#888",
    fontSize: "1.1rem",
    cursor: "pointer",
  },
  preview: {
    width: "100%",
    borderRadius: "12px",
    marginBottom: "1rem",
  },
  form: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  label: { color: "#888", fontSize: "0.8rem", marginTop: "0.5rem" },
  input: {
    padding: "0.65rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "#111",
    color: "#fff",
    fontSize: "0.95rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  buttonRow: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1rem",
  },
  primaryBtn: {
    flex: 1,
    padding: "0.75rem",
    borderRadius: "8px",
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  secondaryBtn: {
    flex: 1,
    padding: "0.75rem",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "transparent",
    color: "#888",
    fontSize: "1rem",
    cursor: "pointer",
  },
  confidenceBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "#ccc",
    fontSize: "0.85rem",
    marginBottom: "0.5rem",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
  },
  error: { color: "#ef4444", fontSize: "0.85rem" },
  successBanner: {
    background: "#052e16",
    border: "1px solid #22c55e",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    color: "#22c55e",
    fontSize: "0.9rem",
    marginBottom: "1rem",
  },
};

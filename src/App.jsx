import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./pages/Auth";
import ScanReceipt from "./pages/ScanReceipt";
import Vault from "./pages/Vault";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vault");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <p style={{ color: "#888" }}>Loading...</p>
      </div>
    );
  }

  if (!session) return <Auth />;

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Warranty Wallet</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          style={styles.signOut}
        >
          Sign Out
        </button>
      </header>

      <main style={styles.main}>
        {activeTab === "vault" && <Vault key={refreshKey} />}
        {activeTab === "scan" && (
          <ScanReceipt
            onItemSaved={() => {
              setRefreshKey((k) => k + 1);
              setActiveTab("vault");
            }}
          />
        )}
      </main>

      <nav style={styles.nav}>
        <button
          onClick={() => setActiveTab("vault")}
          style={{
            ...styles.navBtn,
            color: activeTab === "vault" ? "#3b82f6" : "#666",
          }}
        >
          <span style={styles.navIcon}>📦</span>
          <span style={styles.navLabel}>Vault</span>
        </button>
        <button
          onClick={() => setActiveTab("scan")}
          style={{
            ...styles.navBtn,
            color: activeTab === "scan" ? "#3b82f6" : "#666",
          }}
        >
          <span style={styles.navIcon}>📸</span>
          <span style={styles.navLabel}>Scan</span>
        </button>
      </nav>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#0a0a0a",
    display: "flex",
    flexDirection: "column",
  },
  loadingScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem",
    borderBottom: "1px solid #1a1a1a",
  },
  logo: {
    color: "#fff",
    fontSize: "1.1rem",
    fontWeight: "700",
    margin: "0",
  },
  signOut: {
    background: "none",
    border: "none",
    color: "#666",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  main: {
    flex: 1,
    paddingBottom: "5rem",
  },
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    background: "#111",
    borderTop: "1px solid #222",
    padding: "0.5rem 0 env(safe-area-inset-bottom, 0.5rem)",
  },
  navBtn: {
    flex: 1,
    background: "none",
    border: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.15rem",
    padding: "0.5rem",
    cursor: "pointer",
  },
  navIcon: { fontSize: "1.3rem" },
  navLabel: { fontSize: "0.7rem", fontWeight: "600" },
};

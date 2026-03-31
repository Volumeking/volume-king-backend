import { useState, useEffect, useRef } from "react";

const PACKAGES = [
  {
    id: "1h",
    name: "1 Hour Boost",
    duration: "1 Hour",
    price: 1,
    txCount: "800–1,200",
    wallets: 12,
    speed: "Normal",
    color: "#00FFB2",
    tag: null,
  },
  {
    id: "6h",
    name: "6 Hour Boost",
    duration: "6 Hours",
    price: 3,
    txCount: "5,000–7,000",
    wallets: 25,
    speed: "Normal",
    color: "#00FFB2",
    tag: null,
  },
  {
    id: "12h",
    name: "12 Hour Boost",
    duration: "12 Hours",
    price: 5,
    txCount: "10,000–14,000",
    wallets: 40,
    speed: "Fast",
    color: "#9FFF00",
    tag: null,
  },
  {
    id: "1d",
    name: "1 Day Boost",
    duration: "24 Hours",
    price: 8,
    txCount: "20,000–28,000",
    wallets: 60,
    speed: "Fast",
    color: "#9FFF00",
    tag: "POPULAR",
  },
  {
    id: "3d",
    name: "3 Day Boost",
    duration: "3 Days",
    price: 18,
    txCount: "60,000–80,000",
    wallets: 100,
    speed: "Aggressive",
    color: "#FF6B35",
    tag: null,
  },
  {
    id: "1w",
    name: "1 Week Boost",
    duration: "7 Days",
    price: 35,
    txCount: "150,000–200,000",
    wallets: 150,
    speed: "Aggressive",
    color: "#FF6B35",
    tag: "MAX POWER",
  },
];

const BACKEND_URL = "https://volume-king-backend-production.up.railway.app";
const PAYMENT_WALLET = "8eHR6xaJC7vNZPm9zLSRZ9z29qBSWw5SBFWmsW6iE7pq";

function AnimatedNumber({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1200;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(parseFloat((eased * end).toFixed(decimals)));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [value, decimals]);
  return <>{display.toLocaleString()}</>;
}

function StatusBadge({ status }) {
  const styles = {
    active: { bg: "#00FFB2", color: "#000", label: "● LIVE" },
    completed: { bg: "#1a1a2e", color: "#888", label: "✓ DONE" },
    pending: { bg: "#FF6B35", color: "#000", label: "⏳ PENDING" },
    failed: { bg: "#ff4444", color: "#fff", label: "✗ FAILED" },
  };
  const s = styles[status] || styles.pending;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 9,
        fontWeight: 800,
        padding: "2px 7px",
        borderRadius: 4,
        letterSpacing: 1,
        fontFamily: "monospace",
      }}
    >
      {s.label}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        background: copied ? "rgba(0,255,178,0.2)" : "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 6,
        padding: "4px 10px",
        color: copied ? "#00FFB2" : "#aaa",
        fontSize: 10,
        cursor: "pointer",
        fontFamily: "monospace",
        marginLeft: 8,
        transition: "all 0.2s",
      }}
    >
      {copied ? "✓ COPIED" : "COPY"}
    </button>
  );
}

export default function VolBotApp() {
  const [tab, setTab] = useState("boost");
  const [selected, setSelected] = useState(null);
  const [tokenAddress, setTokenAddress] = useState("");
  const [step, setStep] = useState("select");
  const [animIn, setAnimIn] = useState(true);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [telegramUser, setTelegramUser] = useState(null);
  const [txSignature, setTxSignature] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [confirmError, setConfirmError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      setTelegramUser(tg.initDataUnsafe?.user);
    }
  }, []);

  useEffect(() => {
    if (telegramUser?.id) {
      fetchOrders();
      fetchStats();
    }
  }, [telegramUser]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/orders?telegramId=${telegramUser.id}`,
      );
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/stats?telegramId=${telegramUser.id}`,
      );
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const switchTab = (t) => {
    setAnimIn(false);
    setTimeout(() => {
      setTab(t);
      setStep("select");
      setSelected(null);
      setAnimIn(true);
    }, 150);
  };

  const handleBook = async () => {
    if (!selected || !tokenAddress.trim()) return;
    // Create the order in backend first
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: String(telegramUser?.id || "test"),
          username: telegramUser?.username,
          firstName: telegramUser?.first_name,
          packageId: selected,
          tokenAddress,
        }),
      });
      const data = await res.json();
      if (data.orderId) {
        setOrderId(data.orderId);
        setStep("confirm");
      } else {
        alert("Failed to create order. Try again.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleConfirmPayment = async () => {
    if (!txSignature.trim()) {
      setConfirmError("Please paste your transaction signature.");
      return;
    }
    setConfirmError("");
    setVerifying(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: txSignature.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("success");
        fetchOrders();
        fetchStats();
      } else {
        setConfirmError(
          data.reason ||
            data.error ||
            "Payment could not be verified. Check your signature and try again.",
        );
      }
    } catch (err) {
      setConfirmError("Network error. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  const pkg = PACKAGES.find((p) => p.id === selected);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080810",
        color: "#fff",
        fontFamily: "'Space Mono', monospace",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0,255,178,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,178,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: -120,
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,255,178,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: "20px 20px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#00FFB2",
              letterSpacing: 3,
              fontWeight: 700,
            }}
          >
            SOLANA
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.5,
              lineHeight: 1.1,
            }}
          >
            VOLUME<span style={{ color: "#00FFB2" }}> KING</span>
          </div>
        </div>
        <div
          style={{
            background: "rgba(0,255,178,0.08)",
            border: "1px solid rgba(0,255,178,0.2)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 11,
            color: "#00FFB2",
          }}
        >
          ◎ ONLINE
        </div>
      </div>

      {/* Nav */}
      <div
        style={{
          display: "flex",
          gap: 4,
          margin: "16px 20px 0",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 10,
          padding: 4,
        }}
      >
        {[
          { id: "boost", label: "🚀 Boost" },
          { id: "orders", label: "📋 Orders" },
          { id: "stats", label: "📊 Stats" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              fontWeight: 700,
              transition: "all 0.2s",
              background: tab === t.id ? "#00FFB2" : "transparent",
              color: tab === t.id ? "#000" : "#666",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          padding: "20px 20px 100px",
          opacity: animIn ? 1 : 0,
          transform: animIn ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.2s ease",
        }}
      >
        {/* BOOST TAB */}
        {tab === "boost" && (
          <>
            {step === "select" && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    color: "#555",
                    letterSpacing: 2,
                    marginBottom: 14,
                  }}
                >
                  SELECT PACKAGE
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {PACKAGES.map((p) => (
                    <div
                      key={p.id}
                      onClick={() =>
                        setSelected(p.id === selected ? null : p.id)
                      }
                      style={{
                        border: `1px solid ${selected === p.id ? p.color : "rgba(255,255,255,0.07)"}`,
                        borderRadius: 14,
                        padding: "14px 16px",
                        cursor: "pointer",
                        background:
                          selected === p.id
                            ? `rgba(0,255,178,0.06)`
                            : "rgba(255,255,255,0.02)",
                        transition: "all 0.2s",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {p.tag && (
                        <div
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 12,
                            background: p.color,
                            color: "#000",
                            fontSize: 8,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 4,
                            letterSpacing: 1,
                          }}
                        >
                          {p.tag}
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: `${p.color}18`,
                            border: `1px solid ${p.color}40`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          {p.id === "1h"
                            ? "⚡"
                            : p.id === "6h"
                              ? "🔋"
                              : p.id === "12h"
                                ? "🔥"
                                : p.id === "1d"
                                  ? "🚀"
                                  : p.id === "3d"
                                    ? "💥"
                                    : "👑"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              marginBottom: 2,
                            }}
                          >
                            {p.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#555",
                              marginBottom: 8,
                            }}
                          >
                            {p.duration} · {p.wallets} wallets · {p.speed}
                          </div>
                          <span
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              borderRadius: 5,
                              padding: "2px 8px",
                              fontSize: 10,
                              color: "#aaa",
                            }}
                          >
                            {p.txCount} TXs
                          </span>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: p.color,
                            }}
                          >
                            {p.price}
                          </div>
                          <div style={{ fontSize: 10, color: "#555" }}>SOL</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#555",
                      letterSpacing: 2,
                      marginBottom: 10,
                    }}
                  >
                    TOKEN CONTRACT ADDRESS
                  </div>
                  <input
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    placeholder="Enter Solana token address..."
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      color: "#fff",
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 11,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <button
                  onClick={handleBook}
                  disabled={!selected || !tokenAddress.trim()}
                  style={{
                    width: "100%",
                    marginTop: 16,
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background:
                      selected && tokenAddress.trim()
                        ? "linear-gradient(135deg, #00FFB2, #00cc8e)"
                        : "rgba(255,255,255,0.06)",
                    color: selected && tokenAddress.trim() ? "#000" : "#333",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor:
                      selected && tokenAddress.trim()
                        ? "pointer"
                        : "not-allowed",
                    letterSpacing: 1,
                    transition: "all 0.2s",
                  }}
                >
                  CONTINUE →
                </button>
              </>
            )}

            {step === "confirm" && pkg && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    color: "#555",
                    letterSpacing: 2,
                    marginBottom: 16,
                  }}
                >
                  PAYMENT INSTRUCTIONS
                </div>

                {/* Order summary */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    padding: 18,
                    marginBottom: 16,
                  }}
                >
                  {[
                    ["Package", pkg.name],
                    ["Duration", pkg.duration],
                    [
                      "Token",
                      tokenAddress.slice(0, 6) + "..." + tokenAddress.slice(-4),
                    ],
                    ["Price", `${pkg.price} SOL`],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "#555" }}>{k}</span>
                      <span
                        style={{
                          color: k === "Price" ? "#00FFB2" : "#fff",
                          fontWeight: k === "Price" ? 700 : 400,
                        }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Step 1 - Send SOL */}
                <div
                  style={{
                    background: "rgba(0,255,178,0.04)",
                    border: "1px solid rgba(0,255,178,0.15)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#00FFB2",
                      letterSpacing: 2,
                      marginBottom: 10,
                      fontWeight: 700,
                    }}
                  >
                    STEP 1 — SEND PAYMENT
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
                    Send exactly{" "}
                    <span style={{ color: "#00FFB2", fontWeight: 700 }}>
                      {pkg.price} SOL
                    </span>{" "}
                    to:
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        color: "#aaa",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {PAYMENT_WALLET}
                    </span>
                    <CopyButton text={PAYMENT_WALLET} />
                  </div>
                </div>

                {/* Step 2 - Paste signature */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#555",
                      letterSpacing: 2,
                      marginBottom: 10,
                      fontWeight: 700,
                    }}
                  >
                    STEP 2 — PASTE TX SIGNATURE
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#555", marginBottom: 10 }}
                  >
                    After sending, copy your transaction signature from your
                    wallet and paste it below.
                  </div>
                  <input
                    value={txSignature}
                    onChange={(e) => {
                      setTxSignature(e.target.value);
                      setConfirmError("");
                    }}
                    placeholder="Paste transaction signature..."
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${confirmError ? "#ff4444" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      color: "#fff",
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 10,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {confirmError && (
                    <div
                      style={{ fontSize: 10, color: "#ff4444", marginTop: 8 }}
                    >
                      {confirmError}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => {
                      setStep("select");
                      setTxSignature("");
                      setConfirmError("");
                    }}
                    style={{
                      flex: 1,
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "transparent",
                      color: "#666",
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    ← BACK
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    disabled={verifying}
                    style={{
                      flex: 2,
                      padding: 14,
                      borderRadius: 12,
                      border: "none",
                      background: verifying
                        ? "rgba(0,255,178,0.3)"
                        : "linear-gradient(135deg, #00FFB2, #00cc8e)",
                      color: "#000",
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: verifying ? "not-allowed" : "pointer",
                      letterSpacing: 1,
                    }}
                  >
                    {verifying ? "VERIFYING..." : "CONFIRM PAYMENT ✓"}
                  </button>
                </div>
              </>
            )}

            {step === "success" && (
              <div style={{ textAlign: "center", paddingTop: 50 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: "rgba(0,255,178,0.1)",
                    border: "2px solid #00FFB2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                    margin: "0 auto 20px",
                    animation: "pop 0.4s ease",
                  }}
                >
                  ✓
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#00FFB2",
                    marginBottom: 8,
                  }}
                >
                  Payment Confirmed!
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#555",
                    lineHeight: 1.8,
                    marginBottom: 32,
                  }}
                >
                  Your volume bot is now starting. 🚀
                  <br />
                  You'll get a Telegram notification when live.
                </div>
                <button
                  onClick={() => {
                    setStep("select");
                    setSelected(null);
                    setTokenAddress("");
                    setTxSignature("");
                    setOrderId(null);
                  }}
                  style={{
                    padding: "12px 28px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,255,178,0.3)",
                    background: "transparent",
                    color: "#00FFB2",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  NEW ORDER
                </button>
                <style>{`@keyframes pop { 0% { transform: scale(0.5); opacity:0; } 100% { transform: scale(1); opacity:1; } }`}</style>
              </div>
            )}
          </>
        )}

        {/* ORDERS TAB */}
        {tab === "orders" && (
          <>
            <div
              style={{
                fontSize: 11,
                color: "#555",
                letterSpacing: 2,
                marginBottom: 16,
              }}
            >
              ORDER HISTORY
            </div>
            {orders.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#333",
                  fontSize: 12,
                  paddingTop: 40,
                }}
              >
                No orders yet. Make your first boost! 🚀
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {orders.map((o) => (
                  <div
                    key={o.orderId}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            marginBottom: 3,
                          }}
                        >
                          {o.tokenAddress.slice(0, 6)}...
                          {o.tokenAddress.slice(-4)}
                        </div>
                        <div style={{ fontSize: 10, color: "#444" }}>
                          {o.packageName}
                        </div>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        fontSize: 11,
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                        paddingTop: 10,
                      }}
                    >
                      <div>
                        <div style={{ color: "#444", marginBottom: 2 }}>
                          Paid
                        </div>
                        <div style={{ color: "#00FFB2" }}>{o.price} SOL</div>
                      </div>
                      <div>
                        <div style={{ color: "#444", marginBottom: 2 }}>
                          TXs
                        </div>
                        <div>{(o.txsGenerated || 0).toLocaleString()}</div>
                      </div>
                      <div style={{ marginLeft: "auto", textAlign: "right" }}>
                        <div style={{ color: "#444", marginBottom: 2 }}>ID</div>
                        <div style={{ color: "#333", fontSize: 10 }}>
                          {o.orderId}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* STATS TAB */}
        {tab === "stats" && (
          <>
            <div
              style={{
                fontSize: 11,
                color: "#555",
                letterSpacing: 2,
                marginBottom: 16,
              }}
            >
              YOUR STATS
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {[
                {
                  label: "Total Orders",
                  value: stats?.totalOrders || 0,
                  decimals: 0,
                },
                {
                  label: "SOL Spent",
                  value: stats?.totalSpent || 0,
                  decimals: 1,
                },
                {
                  label: "Total TXs",
                  value: stats?.totalTxs || 0,
                  decimals: 0,
                },
                {
                  label: "Success Rate",
                  value: stats?.successRate || 0,
                  decimals: 1,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    padding: "16px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#444",
                      marginBottom: 6,
                      letterSpacing: 1,
                    }}
                  >
                    {s.label.toUpperCase()}
                  </div>
                  <div
                    style={{ fontSize: 24, fontWeight: 700, color: "#00FFB2" }}
                  >
                    <AnimatedNumber value={s.value} decimals={s.decimals} />
                    {s.label === "Success Rate"
                      ? "%"
                      : s.label === "SOL Spent"
                        ? " SOL"
                        : ""}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

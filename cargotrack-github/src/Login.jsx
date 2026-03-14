import { useState } from "react";
import { USERS } from "./users.js";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = () => {
    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    setError("");

    // Simulate a small delay for UX
    setTimeout(() => {
      const user = USERS.find(
        (u) =>
          u.username.toLowerCase() === username.toLowerCase() &&
          u.password === password
      );
      if (user) {
        onLogin(user);
      } else {
        setError("Incorrect username or password.");
        setLoading(false);
      }
    }, 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: 20,
      }}
    >
      {/* Background grid pattern */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo + Title */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              fontSize: 48,
              lineHeight: 1,
              marginBottom: 12,
              filter: "drop-shadow(0 0 20px rgba(59,130,246,0.5))",
            }}
          >
            ⬡
          </div>
          <div
            style={{
              fontFamily: "'Roboto', sans-serif",
              fontWeight: 900,
              fontSize: 32,
              letterSpacing: 6,
              color: "#ffffff",
              textTransform: "uppercase",
            }}
          >
            CARGO<span style={{ color: "#3b82f6" }}>TRACK</span>
          </div>
          <div
            style={{
              fontFamily: "'Roboto', sans-serif",
              fontSize: 10,
              color: "#64748b",
              letterSpacing: 3,
              marginTop: 6,
              textTransform: "uppercase",
            }}
          >
            Container Planning System
          </div>
        </div>

        {/* Login Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "36px 40px",
            backdropFilter: "blur(20px)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              fontFamily: "'Roboto', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#94a3b8",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 28,
            }}
          >
            Sign In
          </div>

          {/* Username */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontFamily: "'Roboto', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                color: "#64748b",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              autoFocus
              autoComplete="username"
              placeholder="Enter username"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${error ? "#ef4444" : "rgba(255,255,255,0.12)"}`,
                borderRadius: 6,
                padding: "12px 14px",
                color: "#f1f5f9",
                fontFamily: "'Roboto', sans-serif",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                transition: "border 0.2s",
              }}
              onFocus={(e) => (e.target.style.border = "1px solid rgba(59,130,246,0.6)")}
              onBlur={(e) => (e.target.style.border = `1px solid ${error ? "#ef4444" : "rgba(255,255,255,0.12)"}`)}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontFamily: "'Roboto', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                color: "#64748b",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
                placeholder="Enter password"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${error ? "#ef4444" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 6,
                  padding: "12px 44px 12px 14px",
                  color: "#f1f5f9",
                  fontFamily: "'Roboto', sans-serif",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border 0.2s",
                }}
                onFocus={(e) => (e.target.style.border = "1px solid rgba(59,130,246,0.6)")}
                onBlur={(e) => (e.target.style.border = `1px solid ${error ? "#ef4444" : "rgba(255,255,255,0.12)"}`)}
              />
              <button
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: 16,
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 20,
                fontFamily: "'Roboto', sans-serif",
                fontSize: 12,
                color: "#f87171",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>⚠</span> {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%",
              background: loading
                ? "rgba(59,130,246,0.4)"
                : "linear-gradient(135deg, #1d6abf, #3b82f6)",
              border: "none",
              borderRadius: 6,
              padding: "13px",
              color: "#ffffff",
              fontFamily: "'Roboto', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 2,
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: loading ? "none" : "0 4px 15px rgba(59,130,246,0.3)",
            }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            fontFamily: "'Roboto', sans-serif",
            fontSize: 10,
            color: "#334155",
            letterSpacing: 1,
          }}
        >
          © {new Date().getFullYear()} CargoTrack — Container Planning System
        </div>
      </div>
    </div>
  );
}

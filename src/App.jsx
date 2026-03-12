import { useState, useEffect } from "react";
import Login from "./Login.jsx";
import CargoTrack from "./CargoTrack.jsx";
import { SESSION_KEY } from "./users.js";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setLoading(false);
  }, []);

  const handleLogin = (user) => {
    // Don't store password in session
    const session = { id: user.id, username: user.username, name: user.name, role: user.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setCurrentUser(session);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  };

  if (loading) return null;

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return <CargoTrack currentUser={currentUser} onLogout={handleLogout} />;
}

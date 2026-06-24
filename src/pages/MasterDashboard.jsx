import { useState, useEffect } from "react";
import MasterLogin from "@/components/master/MasterLogin";
import MasterPanel from "@/components/master/MasterPanel";

const MASTER_KEY = "sentinela_master_2024";
const SESSION_KEY = "master_session";

export default function MasterDashboard() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session === MASTER_KEY) setAuthenticated(true);
  }, []);

  const handleLogin = (password) => {
    if (password === MASTER_KEY) {
      sessionStorage.setItem(SESSION_KEY, MASTER_KEY);
      setAuthenticated(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthenticated(false);
  };

  if (!authenticated) return <MasterLogin onLogin={handleLogin} />;
  return <MasterPanel onLogout={handleLogout} />;
}
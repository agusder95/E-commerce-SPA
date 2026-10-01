import { createContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [email, setEmail] = useState(() => localStorage.getItem("email"));
  const [role, setRole] = useState(() => {
    const stored = localStorage.getItem("token");
    if (!stored) return null;
    const payload = parseJwt(stored);
    return payload?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ?? null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      const payload = parseJwt(token);
      setRole(payload?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ?? null);
    } else {
      localStorage.removeItem("token");
      setRole(null);
    }
  }, [token]);

  useEffect(() => {
    if (email) {
      localStorage.setItem("email", email);
    } else {
      localStorage.removeItem("email");
    }
  }, [email]);

  function login(newToken, newEmail) {
    setToken(newToken);
    setEmail(newEmail);
  }

  function logout() {
    setToken(null);
    setEmail(null);
    setRole(null);
    localStorage.removeItem("token");
    localStorage.removeItem("email");
  }

  return (
    <AuthContext.Provider value={{ token, email, role, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };

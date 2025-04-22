// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from "react";
import api from "../services/api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check for token in localStorage
    const token = localStorage.getItem("token");
    if (token) {
      checkAuthStatus(token);
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuthStatus = async (token) => {
    try {
      // Set default auth header
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Fetch user profile
      const response = await api.get("/user/me");
      setCurrentUser(response.data);
      setIsAuthenticated(true);
    } catch (err) {
      // If token is invalid, remove it
      localStorage.removeItem("token");
      api.defaults.headers.common["Authorization"] = "";
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      setError(null);
      const response = await api.post("/auth/login", { username, password });
      const { token } = response.data;

      localStorage.setItem("token", token);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Fetch user data after successful login
      const userResponse = await api.get("/user/me");
      setCurrentUser(userResponse.data);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
      return false;
    }
  };

  const register = async (username, password) => {
    try {
      setError(null);
      // First, register the user
      await api.post("/auth/register", {
        username,
        password,
      });

      // Then automatically log in
      const loginResponse = await api.post("/auth/login", {
        username,
        password,
      });
      const { token } = loginResponse.data;

      localStorage.setItem("token", token);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Fetch user data after successful registration and login
      const userResponse = await api.get("/user/me");
      setCurrentUser(userResponse.data);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    api.defaults.headers.common["Authorization"] = "";
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        loading,
        error,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

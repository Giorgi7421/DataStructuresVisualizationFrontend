// src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptor to handle token refresh or auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired, log out user
      localStorage.removeItem("token");
    }
    return Promise.reject(error);
  }
);

export default api;

// Data structure-specific API calls
export const dataStructureService = {
  // Get all data structures for the current user
  getAll: () => api.get("/user/get-all-data-structures"),

  // Get a specific data structure by ID
  getById: (id) => api.get(`/datastructures/${id}`),

  // Create a new data structure
  create: (type, name, implementation) =>
    api.post("/datastructures", { type, name, implementation }),

  // Perform operation on data structure
  performOperation: (id, operation, value) =>
    api.post(`/datastructures/${id}/operations`, { operation, value }),

  // Get operation history for a data structure
  getHistory: (id) => api.get(`/datastructures/${id}/history`),

  // Delete a data structure
  delete: (id) => api.delete(`/datastructures/${id}`),
};

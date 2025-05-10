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

// Helper function to determine whether a data structure has multiple implementations
const hasMultipleImplementations = (type) => {
  // Convert type to uppercase for consistency with backend
  const typeUpper = type.toUpperCase();

  // Data structures with multiple implementations
  const multiImplTypes = [
    "VECTOR",
    "STACK",
    "QUEUE",
    "MAP",
    "TREE",
    "SET",
    "EDITOR_BUFFER",
  ];

  return multiImplTypes.includes(typeUpper);
};

// Helper function to format data structure type for URL
const formatTypeForUrl = (type) => {
  // Convert to lowercase and replace underscores with hyphens
  return type.toLowerCase().replace(/_/g, "-");
};

// Data structure-specific API calls
export const dataStructureService = {
  // Get all data structures for the current user
  getAll: () => api.get("/user/get-all-data-structures"),

  // Create a new data structure
  create: (endpoint) => api.post(`/${endpoint}`),

  // Find data structure by type, name and implementation (if needed)
  // Returns operations history with current state as the last entry
  findDataStructure: (type, name, implementation) => {
    // Format type for URL (lowercase and replace underscores with hyphens)
    const dsType = formatTypeForUrl(type);

    // Construct URL with path variables
    // For types with multiple implementations, include implementation in path
    // Order: implementation first, then name
    let url = hasMultipleImplementations(type)
      ? `/${dsType}/find/${implementation}/${name}`
      : `/${dsType}/find/${name}`;

    return api.get(url);
  },

  // Perform operation on data structure
  performOperation: (type, name, implementation, operation, value) => {
    // Format type for URL (lowercase and replace underscores with hyphens)
    const dsType = formatTypeForUrl(type);

    // Construct URL with path variables
    // For types with multiple implementations, include implementation in path
    // Order: implementation first, then name
    let url = hasMultipleImplementations(type)
      ? `/${dsType}/operation/${implementation}/${name}`
      : `/${dsType}/operation/${name}`;

    // Create request body with operation and value
    const requestBody = {
      operation,
      value,
    };

    return api.post(url, requestBody);
  },

  // Delete a data structure
  delete: (id) => api.delete(`/datastructures/${id}`),
};

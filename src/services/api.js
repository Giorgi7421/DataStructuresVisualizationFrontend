import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
    }
    return Promise.reject(error);
  }
);

export default api;

const hasMultipleImplementations = (type) => {
  const typeUpper = type.toUpperCase();

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

const formatTypeForUrl = (type) => {
  return type.toLowerCase().replace(/_/g, "-");
};

export const dataStructureService = {
  getAll: () => api.get("/user/get-all-data-structures"),

  create: (endpoint) => api.post(`/${endpoint}`),

  findDataStructure: (type, name, implementation) => {
    const dsType = formatTypeForUrl(type);

    let url = hasMultipleImplementations(type)
      ? `/${dsType}/find/${implementation}/${name}`
      : `/${dsType}/find/${name}`;

    return api.get(url);
  },

  performOperation: (type, name, implementation, operation, value) => {
    const dsType = formatTypeForUrl(type);

    let url = hasMultipleImplementations(type)
      ? `/${dsType}/operation/${implementation}/${name}`
      : `/${dsType}/operation/${name}`;

    const requestBody = {
      operation,
      value,
    };

    return api.post(url, requestBody);
  },

  delete: (id) => api.delete(`/datastructures/${id}`),
  deleteByName: (name) => api.delete(`/user/delete/${name}`),
};

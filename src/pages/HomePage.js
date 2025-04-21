// src/pages/HomePage.js
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { dataStructureService } from "../services/api";
import { PlusIcon, TrashIcon } from "lucide-react";

function HomePage() {
  const [dataStructures, setDataStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDSName, setNewDSName] = useState("");
  const [newDSType, setNewDSType] = useState("stack");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchDataStructures();
  }, []);

  const fetchDataStructures = async () => {
    try {
      setLoading(true);
      const response = await dataStructureService.getAll();
      setDataStructures(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to load data structures");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (
      window.confirm("Are you sure you want to delete this data structure?")
    ) {
      try {
        await dataStructureService.delete(id);
        setDataStructures(dataStructures.filter((ds) => ds.id !== id));
      } catch (err) {
        setError("Failed to delete data structure");
        console.error(err);
      }
    }
  };

  const handleCreateDS = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const response = await dataStructureService.create(newDSType, newDSName);
      setDataStructures([...dataStructures, response.data]);
      setShowCreateModal(false);
      setNewDSName("");
      setNewDSType("stack");
    } catch (err) {
      setError("Failed to create data structure");
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  // Get appropriate icon based on data structure type
  const getTypeIcon = (type) => {
    switch (type) {
      case "stack":
        return "📚";
      case "queue":
        return "🔄";
      case "linkedList":
        return "🔗";
      case "binaryTree":
        return "🌳";
      case "graph":
        return "🕸️";
      case "hashMap":
        return "🗺️";
      default:
        return "📊";
    }
  };

  // Format data structure type to display name
  const formatType = (type) => {
    switch (type) {
      case "linkedList":
        return "Linked List";
      case "binaryTree":
        return "Binary Tree";
      case "hashMap":
        return "Hash Map";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Data Structures</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          <PlusIcon className="w-5 h-5 mr-1" />
          Create New
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : dataStructures.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <p className="text-xl text-gray-600 mb-4">
            You don't have any data structures yet
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Create your first data structure
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dataStructures.map((ds) => (
            <div
              key={ds.id}
              className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-2xl mr-2">
                      {getTypeIcon(ds.type)}
                    </span>
                    <h2 className="text-xl font-bold inline-block">
                      {ds.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => handleDelete(ds.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-gray-600 mt-1">{formatType(ds.type)}</p>
                <p className="text-gray-500 mt-1 text-sm">
                  Created: {new Date(ds.createdAt).toLocaleDateString()}
                </p>
                <p className="text-gray-500 text-sm">
                  Last updated: {new Date(ds.updatedAt).toLocaleDateString()}
                </p>
                <div className="mt-4">
                  <Link
                    to={`/datastructure/${ds.id}`}
                    className="block w-full text-center bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
                  >
                    Open
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create New Data Structure Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              Create New Data Structure
            </h2>
            <form onSubmit={handleCreateDS}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={newDSName}
                  onChange={(e) => setNewDSName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 mb-2" htmlFor="type">
                  Type
                </label>
                <select
                  id="type"
                  value={newDSType}
                  onChange={(e) => setNewDSType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="stack">Stack</option>
                  <option value="queue">Queue</option>
                  <option value="linkedList">Linked List</option>
                  <option value="binaryTree">Binary Tree</option>
                  <option value="graph">Graph</option>
                  <option value="hashMap">Hash Map</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-blue-300"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;

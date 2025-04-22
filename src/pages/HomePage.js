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
  const [newDSType, setNewDSType] = useState("STACK");
  const [newDSImplementation, setNewDSImplementation] = useState("ARRAY_STACK");
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
      const response = await dataStructureService.create(
        newDSType,
        newDSName,
        newDSImplementation
      );
      setDataStructures([...dataStructures, response.data]);
      setShowCreateModal(false);
      setNewDSName("");
      setNewDSType("STACK");
      setNewDSImplementation("ARRAY_STACK");
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
      case "VECTOR":
        return "📏"; // Ruler for vector
      case "STACK":
        return "📚"; // Books for stack
      case "QUEUE":
        return "🔄"; // Circular arrows for queue
      case "MAP":
        return "🗺️"; // Map for map
      case "TREE":
        return "🌳"; // Tree for tree
      case "SET":
        return "🔢"; // Numbers for set
      case "EDITOR_BUFFER":
        return "📝"; // Memo for editor buffer
      case "GRID":
        return "📊"; // Chart for grid
      case "DEQUE":
        return "↔️"; // Left-right arrows for deque
      case "FILE_SYSTEM":
        return "📁"; // File folder for file system
      case "WEB_BROWSER":
        return "🌐"; // Globe for web browser
      case "BIG_NUMBERS":
        return "🔢"; // Numbers for big numbers
      default:
        return "📊"; // Default chart icon
    }
  };

  // Format data structure type to display name
  const formatType = (type) => {
    // Convert SNAKE_CASE to Title Case
    return type
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Get implementation options based on data structure type
  const getImplementationOptions = (type) => {
    switch (type) {
      case "VECTOR":
        return [
          { value: "ARRAY_VECTOR", label: "Array Vector" },
          { value: "LINKED_LIST_VECTOR", label: "Linked List Vector" },
        ];
      case "STACK":
        return [
          { value: "ARRAY_STACK", label: "Array Stack" },
          { value: "LINKED_LIST_STACK", label: "Linked List Stack" },
          { value: "TWO_QUEUE_STACK", label: "Two Queue Stack" },
        ];
      case "QUEUE":
        return [
          { value: "ARRAY_QUEUE", label: "Array Queue" },
          { value: "LINKED_LIST_QUEUE", label: "Linked List Queue" },
          {
            value: "UNSORTED_VECTOR_PRIORITY_QUEUE",
            label: "Unsorted Vector Priority Queue",
          },
          {
            value: "SORTED_LINKED_LIST_PRIORITY_QUEUE",
            label: "Sorted Linked List Priority Queue",
          },
          {
            value: "UNSORTED_DOUBLY_LINKED_LIST_PRIORITY_QUEUE",
            label: "Unsorted Doubly Linked List Priority Queue",
          },
          {
            value: "BINARY_HEAP_PRIORITY_QUEUE",
            label: "Binary Heap Priority Queue",
          },
        ];
      case "MAP":
        return [
          { value: "ARRAY_MAP", label: "Array Map" },
          { value: "HASH_MAP", label: "Hash Map" },
          { value: "TREE_MAP", label: "Tree Map" },
        ];
      case "TREE":
        return [
          { value: "BS_TREE", label: "BS Tree" },
          { value: "AVL_TREE", label: "AVL Tree" },
          { value: "EXPRESSION_TREE", label: "Expression Tree" },
        ];
      case "SET":
        return [
          { value: "TREE_SET", label: "Tree Set" },
          { value: "HASH_SET", label: "Hash Set" },
          { value: "SMALL_INT_SET", label: "Small Int Set" },
          { value: "MOVE_TO_FRONT_SET", label: "Move To Front Set" },
        ];
      case "EDITOR_BUFFER":
        return [
          { value: "ARRAY_EDITOR_BUFFER", label: "Array Editor Buffer" },
          {
            value: "TWO_STACK_EDITOR_BUFFER",
            label: "Two Stack Editor Buffer",
          },
          {
            value: "LINKED_LIST_EDITOR_BUFFER",
            label: "Linked List Editor Buffer",
          },
          {
            value: "DOUBLY_LINKED_LIST_EDITOR_BUFFER",
            label: "Doubly Linked List Editor Buffer",
          },
        ];
      case "GRID":
        return [{ value: "GRID", label: "Grid" }];
      case "DEQUE":
        return [{ value: "DEQUE", label: "Deque" }];
      case "FILE_SYSTEM":
        return [{ value: "FILE_SYSTEM", label: "File System" }];
      case "WEB_BROWSER":
        return [{ value: "WEB_BROWSER", label: "Web Browser" }];
      case "BIG_NUMBERS":
        return [{ value: "BIG_NUMBERS", label: "Big Numbers" }];
      default:
        return [];
    }
  };

  // Helper function to check if a data structure type has multiple implementations
  const hasMultipleImplementations = (type) => {
    const options = getImplementationOptions(type);
    return options.length > 1;
  };

  // Format implementation to display name
  const formatImplementation = (implementation) => {
    // Convert SNAKE_CASE to Title Case
    return implementation
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
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
                <p className="text-gray-600 mt-1">
                  {ds.implementation
                    ? `${formatType(ds.type)} - ${formatImplementation(
                        ds.implementation
                      )}`
                    : formatType(ds.type)}
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

              <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="type">
                  Type
                </label>
                <select
                  id="type"
                  value={newDSType}
                  onChange={(e) => {
                    setNewDSType(e.target.value);
                    // Reset implementation when type changes
                    setNewDSImplementation(
                      getImplementationOptions(e.target.value)[0]?.value || ""
                    );
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="VECTOR">Vector</option>
                  <option value="STACK">Stack</option>
                  <option value="QUEUE">Queue</option>
                  <option value="MAP">Map</option>
                  <option value="TREE">Tree</option>
                  <option value="SET">Set</option>
                  <option value="EDITOR_BUFFER">Editor Buffer</option>
                  <option value="GRID">Grid</option>
                  <option value="DEQUE">Deque</option>
                  <option value="FILE_SYSTEM">File System</option>
                  <option value="WEB_BROWSER">Web Browser</option>
                  <option value="BIG_NUMBERS">Big Numbers</option>
                </select>
              </div>

              {hasMultipleImplementations(newDSType) && (
                <div className="mb-6">
                  <label
                    className="block text-gray-700 mb-2"
                    htmlFor="implementation"
                  >
                    Implementation
                  </label>
                  <select
                    id="implementation"
                    value={newDSImplementation}
                    onChange={(e) => setNewDSImplementation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getImplementationOptions(newDSType).map((impl) => (
                      <option key={impl.value} value={impl.value}>
                        {impl.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dataStructureService } from "../services/api";
import { PlusIcon, TrashIcon } from "lucide-react";

function HomePage() {
  const navigate = useNavigate();

  const getImplementationOptions = (type) => {
    switch (type) {
      case "VECTOR":
        return [
          { value: "ARRAY", label: "Array" },
          { value: "LINKED_LIST", label: "Linked List" },
        ];
      case "STACK":
        return [
          { value: "ARRAY", label: "Array" },
          { value: "LINKED_LIST", label: "Linked List" },
          { value: "TWO_QUEUE", label: "Two Queue" },
        ];
      case "QUEUE":
        return [
          { value: "ARRAY", label: "Array" },
          { value: "LINKED_LIST", label: "Linked List" },
          {
            value: "UNSORTED_VECTOR_PRIORITY",
            label: "Unsorted Vector Priority",
          },
          {
            value: "SORTED_LINKED_LIST_PRIORITY",
            label: "Sorted Linked List Priority",
          },
          {
            value: "UNSORTED_DOUBLY_LINKED_LIST_PRIORITY",
            label: "Unsorted Doubly Linked List Priority",
          },
          {
            value: "BINARY_HEAP_PRIORITY",
            label: "Binary Heap Priority",
          },
        ];
      case "SET":
        return [
          { value: "HASH", label: "Hash" },
          { value: "MOVE_TO_FRONT", label: "Move To Front" },
        ];
      case "MAP":
        return [
          { value: "ARRAY", label: "Array" },
          { value: "HASH", label: "Hash" },
        ];
      case "TREE":
        return [{ value: "BS", label: "Binary Search" }];
      case "EDITOR_BUFFER":
        return [
          { value: "ARRAY", label: "Array" },
          {
            value: "TWO_STACK",
            label: "Two Stack",
          },
          {
            value: "LINKED_LIST",
            label: "Linked List",
          },
          {
            value: "DOUBLY_LINKED_LIST",
            label: "Doubly Linked List",
          },
        ];
      case "GRID":
        return [{ value: "GRID", label: "Grid" }];
      case "DEQUE":
        return [{ value: "DEQUE", label: "Deque" }];
      case "WEB_BROWSER":
        return [{ value: "WEB_BROWSER", label: "Web Browser" }];
      case "BIG_INTEGER":
        return [{ value: "BIG_INTEGER", label: "Big Integer" }];
      default:
        return [];
    }
  };

  const [dataStructures, setDataStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDSName, setNewDSName] = useState("");
  const [newDSType, setNewDSType] = useState("STACK");
  const [newDSImplementation, setNewDSImplementation] = useState(
    getImplementationOptions("STACK")[0]?.value || ""
  );
  const [newDSNumber, setNewDSNumber] = useState("0");
  const [newGridRows, setNewGridRows] = useState("3");
  const [newGridColumns, setNewGridColumns] = useState("3");
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

  const handleDelete = async (name) => {
    if (window.confirm(`Are you sure you want to delete '${name}'?`)) {
      try {
        await dataStructureService.deleteByName(name);

        fetchDataStructures();
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

      let endpoint = newDSType.toLowerCase().replace(/_/g, "-");
      if (hasMultipleImplementations(newDSType)) {
        endpoint += `/create/${newDSImplementation}/${encodeURIComponent(
          newDSName
        )}`;
      } else {
        endpoint += `/create/${encodeURIComponent(newDSName)}`;
      }

      if (newDSType === "BIG_INTEGER") {
        endpoint += `/${encodeURIComponent(newDSNumber)}`;
      }

      if (newDSType === "GRID") {
        endpoint += `/${encodeURIComponent(newGridRows)}/${encodeURIComponent(
          newGridColumns
        )}`;
      }

      const response = await dataStructureService.create(endpoint);

      const newDataStructure = {
        id: response.data.id,
        name: newDSName,
        type: newDSType,
        implementation: newDSImplementation,
        operations: [],
        currentState: null,
      };

      setDataStructures([...dataStructures, newDataStructure]);
      setShowCreateModal(false);
      setNewDSName("");
      setNewDSType("STACK");
      setNewDSImplementation(getImplementationOptions("STACK")[0]?.value || "");
      setNewDSNumber("0");
      setNewGridRows("3");
      setNewGridColumns("3");

      navigate(`/datastructure/${newDataStructure.id}`, {
        state: { dataStructure: newDataStructure },
      });
    } catch (err) {
      setError("Failed to create data structure");
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "VECTOR":
        return "📏";
      case "STACK":
        return "📚";
      case "QUEUE":
        return "🔄";
      case "MAP":
        return "🗺️";
      case "TREE":
        return "🌳";
      case "SET":
        return "🔢";
      case "EDITOR_BUFFER":
        return "📝";
      case "GRID":
        return "📊";
      case "DEQUE":
        return "↔️";
      case "WEB_BROWSER":
        return "🌐";
      case "BIG_INTEGER":
        return "🔢";
      default:
        return "📊";
    }
  };

  const formatType = (type) => {
    if (!type) return "";

    return type
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  const hasMultipleImplementations = (type) => {
    const options = getImplementationOptions(type);

    return options.length > 1 || type === "TREE";
  };

  const formatImplementation = (implementation) => {
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
        <div
          className="max-h-[calc(100vh-200px)] overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-4 w-full"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#94a3b8 #f1f5f9",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      onClick={() => handleDelete(ds.name)}
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
                      state={{ dataStructure: ds }}
                      className="block w-full text-center bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                  <option value="WEB_BROWSER">Web Browser</option>
                  <option value="BIG_INTEGER">Big Integer</option>
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

              {newDSType === "BIG_INTEGER" && (
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="number">
                    Initial Number
                  </label>
                  <input
                    id="number"
                    type="number"
                    value={newDSNumber}
                    onChange={(e) => setNewDSNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              {newDSType === "GRID" && (
                <div className="mb-4 flex space-x-2">
                  <div className="flex-1">
                    <label
                      className="block text-gray-700 mb-2"
                      htmlFor="grid-rows"
                    >
                      Rows
                    </label>
                    <input
                      id="grid-rows"
                      type="number"
                      min="1"
                      value={newGridRows}
                      onChange={(e) => setNewGridRows(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      className="block text-gray-700 mb-2"
                      htmlFor="grid-columns"
                    >
                      Columns
                    </label>
                    <input
                      id="grid-columns"
                      type="number"
                      min="1"
                      value={newGridColumns}
                      onChange={(e) => setNewGridColumns(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
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

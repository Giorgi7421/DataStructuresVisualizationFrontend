// src/pages/DataStructurePage.js
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as d3 from "d3";
import { dataStructureService } from "../services/api";
import {
  ArrowLeftIcon,
  PlayIcon,
  PauseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

function DataStructurePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dataStructure, setDataStructure] = useState(null);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [operation, setOperation] = useState("");
  const [value, setValue] = useState("");
  const [processingOperation, setProcessingOperation] = useState(false);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(1000); // ms

  const svgRef = useRef(null);
  const autoPlayRef = useRef(null);

  useEffect(() => {
    fetchDataStructure();
  }, [id]);

  useEffect(() => {
    if (dataStructure) {
      renderVisualization();
    }
  }, [dataStructure, currentHistoryIndex]);

  useEffect(() => {
    if (autoPlay) {
      autoPlayRef.current = setInterval(() => {
        setCurrentHistoryIndex((prevIndex) => {
          if (prevIndex < operations.length - 1) {
            return prevIndex + 1;
          } else {
            setAutoPlay(false);
            return prevIndex;
          }
        });
      }, autoPlaySpeed);
    } else if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [autoPlay, autoPlaySpeed, operations.length]);

  const fetchDataStructure = async () => {
    try {
      setLoading(true);
      const dsResponse = await dataStructureService.getById(id);
      setDataStructure(dsResponse.data);

      const historyResponse = await dataStructureService.getHistory(id);
      setOperations(historyResponse.data);
      setCurrentHistoryIndex(historyResponse.data.length - 1); // Show the latest state

      setError(null);
    } catch (err) {
      setError("Failed to load data structure");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOperationSubmit = async (e) => {
    e.preventDefault();
    try {
      setProcessingOperation(true);
      const response = await dataStructureService.performOperation(
        id,
        operation,
        value
      );

      // Update operations and display the latest state
      const historyResponse = await dataStructureService.getHistory(id);
      setOperations(historyResponse.data);
      setCurrentHistoryIndex(historyResponse.data.length - 1);

      // Update data structure data
      const dsResponse = await dataStructureService.getById(id);
      setDataStructure(dsResponse.data);

      // Reset form
      setOperation("");
      setValue("");
    } catch (err) {
      setError("Failed to perform operation");
      console.error(err);
    } finally {
      setProcessingOperation(false);
    }
  };

  const renderVisualization = () => {
    if (
      !dataStructure ||
      currentHistoryIndex < 0 ||
      !operations[currentHistoryIndex]
    )
      return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 400;

    const state = operations[currentHistoryIndex].state;
    const dsType = dataStructure.type;

    switch (dsType) {
      case "stack":
        renderStack(svg, width, height, state);
        break;
      case "queue":
        renderQueue(svg, width, height, state);
        break;
      case "linkedList":
        renderLinkedList(svg, width, height, state);
        break;
      case "binaryTree":
        renderBinaryTree(svg, width, height, state);
        break;
      case "graph":
        renderGraph(svg, width, height, state);
        break;
      case "hashMap":
        renderHashMap(svg, width, height, state);
        break;
      default:
        svg
          .append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .text("Visualization not available for this data structure type");
    }
  };

  const renderStack = (svg, width, height, state) => {
    const data = state.elements || [];
    const boxHeight = 40;
    const boxWidth = 120;
    const maxBoxes = Math.floor(height / (boxHeight + 10));

    // Slice the stack to display only the last maxBoxes elements if needed
    const visibleData = data.slice(-maxBoxes);

    const group = svg
      .append("g")
      .attr("transform", `translate(${width / 2 - boxWidth / 2}, 10)`);

    // Base platform
    group
      .append("rect")
      .attr("x", -10)
      .attr("y", height - 20)
      .attr("width", boxWidth + 20)
      .attr("height", 10)
      .attr("fill", "#333");

    // Stack boxes
    const boxes = group
      .selectAll(".stack-box")
      .data(visibleData)
      .enter()
      .append("g")
      .attr("class", "stack-box")
      .attr(
        "transform",
        (d, i) => `translate(0, ${height - 30 - (i + 1) * (boxHeight + 5)})`
      );

    boxes
      .append("rect")
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("fill", "#4299e1")
      .attr("stroke", "#2b6cb0")
      .attr("rx", 4);

    boxes
      .append("text")
      .attr("x", boxWidth / 2)
      .attr("y", boxHeight / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .text((d) => d);

    // Labels
    group
      .append("text")
      .attr("x", boxWidth / 2)
      .attr("y", height - 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#333")
      .text("Bottom");

    if (visibleData.length > 0) {
      group
        .append("text")
        .attr("x", boxWidth / 2)
        .attr("y", height - 30 - visibleData.length * (boxHeight + 5) - 10)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .text("Top");
    }
  };

  const renderQueue = (svg, width, height, state) => {
    const data = state.elements || [];
    const boxHeight = 40;
    const boxWidth = 80;
    const maxBoxes = Math.floor(width / (boxWidth + 10));

    // Slice the queue to display only maxBoxes elements if needed
    const visibleData = data.length > maxBoxes ? data.slice(0, maxBoxes) : data;

    const group = svg
      .append("g")
      .attr(
        "transform",
        `translate(${(width - visibleData.length * (boxWidth + 10)) / 2}, ${
          height / 2 - boxHeight / 2
        })`
      );

    // Platform
    group
      .append("rect")
      .attr("x", -10)
      .attr("y", boxHeight + 10)
      .attr("width", visibleData.length * (boxWidth + 10) + 10)
      .attr("height", 10)
      .attr("fill", "#333");

    // Queue boxes
    const boxes = group
      .selectAll(".queue-box")
      .data(visibleData)
      .enter()
      .append("g")
      .attr("class", "queue-box")
      .attr("transform", (d, i) => `translate(${i * (boxWidth + 10)}, 0)`);

    boxes
      .append("rect")
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("fill", "#48bb78")
      .attr("stroke", "#2f855a")
      .attr("rx", 4);

    boxes
      .append("text")
      .attr("x", boxWidth / 2)
      .attr("y", boxHeight / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .text((d) => d);

    // Labels
    if (visibleData.length > 0) {
      group
        .append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .text("Front");

      group
        .append("text")
        .attr("x", (visibleData.length - 1) * (boxWidth + 10) + boxWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .text("Rear");
    }

    // If there are more elements than can be displayed
    if (data.length > maxBoxes) {
      group
        .append("text")
        .attr("x", visibleData.length * (boxWidth + 10) + 20)
        .attr("y", boxHeight / 2)
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .text(`+ ${data.length - maxBoxes} more`);
    }
  };

  const renderLinkedList = (svg, width, height, state) => {
    const data = state.elements || [];
    const nodeRadius = 25;
    const nodeSpacing = 100;
    const maxNodes = Math.floor(width / nodeSpacing);

    // Slice the list to display only maxNodes elements if needed
    const visibleData = data.length > maxNodes ? data.slice(0, maxNodes) : data;

    const group = svg
      .append("g")
      .attr(
        "transform",
        `translate(${(width - (visibleData.length - 1) * nodeSpacing) / 2}, ${
          height / 2
        })`
      );

    // Links
    const links = group
      .selectAll(".link")
      .data(visibleData.slice(0, -1))
      .enter()
      .append("g")
      .attr("class", "link");

    links
      .append("line")
      .attr("x1", (d, i) => i * nodeSpacing + nodeRadius)
      .attr("y1", 0)
      .attr("x2", (d, i) => (i + 1) * nodeSpacing - nodeRadius)
      .attr("y2", 0)
      .attr("stroke", "#333")
      .attr("stroke-width", 2);

    links
      .append("polygon")
      .attr("points", (d, i) => {
        const x = (i + 1) * nodeSpacing - nodeRadius;
        return `${x - 5},5 ${x},0 ${x - 5},-5`;
      })
      .attr("fill", "#333");

    // Nodes
    const nodes = group
      .selectAll(".node")
      .data(visibleData)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d, i) => `translate(${i * nodeSpacing}, 0)`);

    nodes
      .append("circle")
      .attr("r", nodeRadius)
      .attr("fill", "#9f7aea")
      .attr("stroke", "#6b46c1")
      .attr("stroke-width", 2);

    nodes
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .text((d) => d);

    // Head label
    if (visibleData.length > 0) {
      group
        .append("text")
        .attr("x", 0)
        .attr("y", -nodeRadius - 10)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .text("Head");
    }

    // If there are more elements than can be displayed
    if (data.length > maxNodes) {
      group
        .append("text")
        .attr("x", visibleData.length * nodeSpacing + 20)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .text(`+ ${data.length - maxNodes} more`);
    }
  };

  const renderBinaryTree = (svg, width, height, state) => {
    if (!state.tree) return;

    const root = d3.hierarchy(state.tree);
    const treeLayout = d3.tree().size([width - 100, height - 80]);
    treeLayout(root);

    const group = svg.append("g").attr("transform", `translate(50, 40)`);

    // Links
    group
      .selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr(
        "d",
        d3
          .linkVertical()
          .x((d) => d.x)
          .y((d) => d.y)
      )
      .attr("fill", "none")
      .attr("stroke", "#aaa")
      .attr("stroke-width", 1.5);

    // Nodes
    const nodes = group
      .selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

    nodes
      .append("circle")
      .attr("r", 20)
      .attr("fill", "#f56565")
      .attr("stroke", "#c53030")
      .attr("stroke-width", 2);

    nodes
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .text((d) => d.data.value);
  };

  const renderGraph = (svg, width, height, state) => {
    if (!state.nodes || !state.edges) return;

    const simulation = d3
      .forceSimulation(state.nodes)
      .force(
        "link",
        d3
          .forceLink(state.edges)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // Run the simulation for a few ticks to stabilize
    for (let i = 0; i < 100; i++) {
      simulation.tick();
    }
    simulation.stop();

    // Links
    svg
      .selectAll(".link")
      .data(state.edges)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("x1", (d) => Math.max(50, Math.min(width - 50, d.source.x)))
      .attr("y1", (d) => Math.max(50, Math.min(height - 50, d.source.y)))
      .attr("x2", (d) => Math.max(50, Math.min(width - 50, d.target.x)))
      .attr("y2", (d) => Math.max(50, Math.min(height - 50, d.target.y)))
      .attr("stroke", "#aaa")
      .attr("stroke-width", 2);

    // Nodes
    const nodes = svg
      .selectAll(".node")
      .data(state.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr(
        "transform",
        (d) =>
          `translate(${Math.max(30, Math.min(width - 30, d.x))}, ${Math.max(
            30,
            Math.min(height - 30, d.y)
          )})`
      );

    nodes
      .append("circle")
      .attr("r", 25)
      .attr("fill", "#4fd1c5")
      .attr("stroke", "#319795")
      .attr("stroke-width", 2);

    nodes
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .text((d) => d.value);
  };

  const renderHashMap = (svg, width, height, state) => {
    const data = state.buckets || [];
    const bucketHeight = 50;
    const bucketWidth = width - 100;
    const keyValueHeight = 30;
    const maxBuckets = Math.floor(height / (bucketHeight + 10));

    // Slice the buckets to display only maxBuckets elements if needed
    const visibleBuckets =
      data.length > maxBuckets ? data.slice(0, maxBuckets) : data;

    const group = svg.append("g").attr("transform", `translate(50, 30)`);

    // Buckets
    const buckets = group
      .selectAll(".bucket")
      .data(visibleBuckets)
      .enter()
      .append("g")
      .attr("class", "bucket")
      .attr("transform", (d, i) => `translate(0, ${i * (bucketHeight + 10)})`);

    // Bucket index
    buckets
      .append("text")
      .attr("x", -25)
      .attr("y", bucketHeight / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#333")
      .text((d, i) => i);

    // Bucket rectangle
    buckets
      .append("rect")
      .attr("width", bucketWidth)
      .attr("height", bucketHeight)
      .attr("fill", "none")
      .attr("stroke", "#cbd5e0")
      .attr("stroke-width", 1)
      .attr("rx", 4);

    // Key-value pairs
    buckets.each(function (bucket, bucketIndex) {
      const entries = bucket.entries || [];
      const bucketGroup = d3.select(this);

      const keyValues = bucketGroup
        .selectAll(".entry")
        .data(entries)
        .enter()
        .append("g")
        .attr("class", "entry")
        .attr(
          "transform",
          (d, i) =>
            `translate(${i * (bucketWidth / Math.max(entries.length, 1))}, 0)`
        );

      keyValues
        .append("rect")
        .attr("width", bucketWidth / Math.max(entries.length, 1))
        .attr("height", bucketHeight)
        .attr("fill", "#f6ad55")
        .attr("fill-opacity", 0.2)
        .attr("stroke", "#ed8936")
        .attr("stroke-width", 1);

      keyValues
        .append("text")
        .attr("x", bucketWidth / Math.max(entries.length, 1) / 2)
        .attr("y", bucketHeight / 2 - 10)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .text((d) => `K: ${d.key}`);

      keyValues
        .append("text")
        .attr("x", bucketWidth / Math.max(entries.length, 1) / 2)
        .attr("y", bucketHeight / 2 + 10)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .text((d) => `V: ${d.value}`);
    });

    // If there are more buckets than can be displayed
    if (data.length > maxBuckets) {
      group
        .append("text")
        .attr("x", bucketWidth / 2)
        .attr("y", visibleBuckets.length * (bucketHeight + 10) + 20)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .text(`+ ${data.length - maxBuckets} more buckets`);
    }
  };

  const getOperationOptions = () => {
    switch (dataStructure?.type) {
      case "stack":
        return [
          { value: "push", label: "Push" },
          { value: "pop", label: "Pop" },
          { value: "peek", label: "Peek" },
        ];
      case "queue":
        return [
          { value: "enqueue", label: "Enqueue" },
          { value: "dequeue", label: "Dequeue" },
          { value: "peek", label: "Peek" },
        ];
      case "linkedList":
        return [
          { value: "addFirst", label: "Add First" },
          { value: "addLast", label: "Add Last" },
          { value: "removeFirst", label: "Remove First" },
          { value: "removeLast", label: "Remove Last" },
          { value: "contains", label: "Contains" },
        ];
      case "binaryTree":
        return [
          { value: "insert", label: "Insert" },
          { value: "remove", label: "Remove" },
          { value: "search", label: "Search" },
        ];
      case "graph":
        return [
          { value: "addVertex", label: "Add Vertex" },
          { value: "removeVertex", label: "Remove Vertex" },
          { value: "addEdge", label: "Add Edge" },
          { value: "removeEdge", label: "Remove Edge" },
        ];
      case "hashMap":
        return [
          { value: "put", label: "Put" },
          { value: "get", label: "Get" },
          { value: "remove", label: "Remove" },
          { value: "containsKey", label: "Contains Key" },
        ];
      default:
        return [];
    }
  };

  const needsValueInput = () => {
    const noValueOperations = [
      "pop",
      "peek",
      "dequeue",
      "removeFirst",
      "removeLast",
    ];
    return !noValueOperations.includes(operation);
  };

  // Handle playback controls
  const goToFirst = () => setCurrentHistoryIndex(0);
  const goToLast = () => setCurrentHistoryIndex(operations.length - 1);
  const goToPrevious = () =>
    setCurrentHistoryIndex(Math.max(0, currentHistoryIndex - 1));
  const goToNext = () =>
    setCurrentHistoryIndex(
      Math.min(operations.length - 1, currentHistoryIndex + 1)
    );

  const toggleAutoPlay = () => setAutoPlay(!autoPlay);

  return (
    <div className="max-w-6xl mx-auto">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate("/home")}
                className="mr-4 flex items-center text-blue-500 hover:text-blue-700"
              >
                <ArrowLeftIcon className="w-5 h-5 mr-1" />
                Back to Data Structures
              </button>
              {dataStructure && (
                <h1 className="text-3xl font-bold">
                  {dataStructure.name}{" "}
                  <span className="text-gray-500 text-xl">
                    ({dataStructure.type})
                  </span>
                </h1>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Operation panel */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">Operations</h2>
              <form onSubmit={handleOperationSubmit}>
                <div className="mb-4">
                  <label
                    className="block text-gray-700 mb-2"
                    htmlFor="operation"
                  >
                    Operation
                  </label>
                  <select
                    id="operation"
                    value={operation}
                    onChange={(e) => setOperation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select an operation</option>
                    {getOperationOptions().map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                {operation && needsValueInput() && (
                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2" htmlFor="value">
                      Value
                    </label>
                    <input
                      id="value"
                      type="text"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    !operation ||
                    (needsValueInput() && !value) ||
                    processingOperation
                  }
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-300"
                >
                  {processingOperation ? "Processing..." : "Perform Operation"}
                </button>
              </form>

              <div className="mt-6">
                <h3 className="font-bold mb-2">Current State</h3>
                <div className="bg-gray-100 p-3 rounded max-h-48 overflow-auto">
                  <pre className="text-sm">
                    {operations[currentHistoryIndex]
                      ? JSON.stringify(
                          operations[currentHistoryIndex].state,
                          null,
                          2
                        )
                      : "No state information available"}
                  </pre>
                </div>
              </div>
            </div>

            {/* Visualization area */}
            <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">Visualization</h2>

              <div
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4"
                style={{ height: "400px" }}
              >
                {operations.length > 0 ? (
                  <svg ref={svgRef} width="100%" height="100%"></svg>
                ) : (
                  <div className="flex justify-center items-center h-full text-gray-500">
                    No operations performed yet. Start by adding elements to the
                    data structure.
                  </div>
                )}
              </div>

              {/* Playback controls */}
              {operations.length > 0 && (
                <div className="flex justify-between items-center">
                  <div className="text-gray-600">
                    Operation {currentHistoryIndex + 1} of {operations.length}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={goToFirst}
                      disabled={currentHistoryIndex === 0}
                      className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50"
                      title="First"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={goToPrevious}
                      disabled={currentHistoryIndex === 0}
                      className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50"
                      title="Previous"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>

                    <button
                      onClick={toggleAutoPlay}
                      className="p-2 rounded-full hover:bg-gray-200"
                      title={autoPlay ? "Pause" : "Play"}
                    >
                      {autoPlay ? (
                        <PauseIcon className="w-5 h-5" />
                      ) : (
                        <PlayIcon className="w-5 h-5" />
                      )}
                    </button>

                    <button
                      onClick={goToNext}
                      disabled={currentHistoryIndex === operations.length - 1}
                      className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50"
                      title="Next"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>

                    <button
                      onClick={goToLast}
                      disabled={currentHistoryIndex === operations.length - 1}
                      className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50"
                      title="Last"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 5l7 7-7 7M5 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center">
                    <label htmlFor="playback-speed" className="mr-2 text-sm">
                      Speed:
                    </label>
                    <select
                      id="playback-speed"
                      value={autoPlaySpeed}
                      onChange={(e) => setAutoPlaySpeed(Number(e.target.value))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value={2000}>Slow</option>
                      <option value={1000}>Normal</option>
                      <option value={500}>Fast</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Operation history panel */}
          <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Operation History</h2>
            {operations.length === 0 ? (
              <p className="text-gray-500">No operations performed yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-700 bg-gray-100">
                        #
                      </th>
                      <th className="px-4 py-2 text-left text-gray-700 bg-gray-100">
                        Operation
                      </th>
                      <th className="px-4 py-2 text-left text-gray-700 bg-gray-100">
                        Value
                      </th>
                      <th className="px-4 py-2 text-left text-gray-700 bg-gray-100">
                        Result
                      </th>
                      <th className="px-4 py-2 text-left text-gray-700 bg-gray-100">
                        Timestamp
                      </th>
                      <th className="px-4 py-2 text-left text-gray-700 bg-gray-100">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map((op, index) => (
                      <tr
                        key={index}
                        className={`border-t ${
                          currentHistoryIndex === index ? "bg-blue-50" : ""
                        }`}
                      >
                        <td className="px-4 py-2">{index + 1}</td>
                        <td className="px-4 py-2">{op.operation}</td>
                        <td className="px-4 py-2">{op.value || "-"}</td>
                        <td className="px-4 py-2">
                          {typeof op.result !== "undefined"
                            ? String(op.result)
                            : "-"}
                        </td>
                        <td className="px-4 py-2">
                          {new Date(op.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => setCurrentHistoryIndex(index)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DataStructurePage;

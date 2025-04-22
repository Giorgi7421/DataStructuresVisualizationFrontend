// src/pages/DataStructurePage.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  // Get location state for data structure details
  const navigate = useNavigate();
  const location = useLocation();

  // Extract data structure details from location state
  const dsDetails = location.state?.dataStructure;

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
  const [enableMemoryVisualization, setEnableMemoryVisualization] =
    useState(true);

  const svgRef = useRef(null);
  const autoPlayRef = useRef(null);

  // Define fetchDataStructure as a useCallback to avoid dependency issues
  const fetchDataStructure = useCallback(async () => {
    try {
      setLoading(true);

      if (!dsDetails || !dsDetails.name || !dsDetails.type) {
        throw new Error("Incomplete data structure details");
      }

      // Fetch data structure operations
      const response = await dataStructureService.findDataStructure(
        dsDetails.type,
        dsDetails.name,
        dsDetails.implementation
      );

      // Parse the response which has a memoryHistory structure
      const responseData = response.data;

      if (
        !responseData ||
        !responseData.memoryHistory ||
        !responseData.memoryHistory.operationHistoryList
      ) {
        throw new Error("Invalid response format from server");
      }

      // Extract operation history
      const operationHistory = responseData.memoryHistory.operationHistoryList;

      if (operationHistory.length === 0) {
        throw new Error("No operations found for this data structure");
      }

      // Convert the operation history to the format our visualization expects
      const formattedOperations = operationHistory.map((op) => {
        // Get the last memory snapshot which represents the final state after the operation
        const lastSnapshot = op.memorySnapshots[op.memorySnapshots.length - 1];

        return {
          operation: op.operationName,
          parameters: op.parameters,
          state: {
            // Combine instance variables, addressObjectMap and other relevant data
            ...lastSnapshot.instanceVariables,
            addressObjectMap: lastSnapshot.addressObjectMap,
            result: lastSnapshot.getResult,
            message: lastSnapshot.message,
          },
          // Include all memory snapshots for detailed visualization
          memorySnapshots: op.memorySnapshots,
        };
      });

      setOperations(formattedOperations);

      // Set current state from the last operation's final state
      const lastOperation = operationHistory[operationHistory.length - 1];
      const lastSnapshot =
        lastOperation.memorySnapshots[lastOperation.memorySnapshots.length - 1];

      setDataStructure({
        name: responseData.dataStructureName || dsDetails.name,
        type: dsDetails.type,
        implementation: dsDetails.implementation,
        state: {
          ...lastSnapshot.instanceVariables,
          addressObjectMap: lastSnapshot.addressObjectMap,
          elements: extractElementsFromSnapshot(lastSnapshot, dsDetails.type),
          result: lastSnapshot.getResult,
          message: lastSnapshot.message,
        },
      });

      // Show the latest state
      setCurrentHistoryIndex(formattedOperations.length - 1);
      setError(null);
    } catch (err) {
      setError(
        "Failed to load data structure: " + (err.message || "Unknown error")
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dsDetails]);

  // Define renderVisualization as a useCallback
  const renderVisualization = useCallback(() => {
    if (!svgRef.current || !dataStructure) return;

    // Clear existing visualization
    d3.select(svgRef.current).selectAll("*").remove();

    // Create a new SVG
    const svg = d3.select(svgRef.current);
    const width = parseInt(svg.style("width")) || 800;
    const height = parseInt(svg.style("height")) || 600;

    const operation = operations[currentHistoryIndex];
    if (!operation) return;

    // Log current operation
    console.log("Current Operation:", operation);
    console.log("Structure Type:", dataStructure.type);

    // Choose rendering method based on structure type
    switch (dataStructure.type.toLowerCase()) {
      case "vector":
      case "array":
      case "vector<int>":
      case "vector<string>":
      case "arraylist":
        renderArrayVisualization(svg, width, height, operation);
        break;
      case "linkedlist":
      case "singly linked list":
      case "singlylinkedlist":
      case "doubly linked list":
      case "doublylinkedlist":
        renderLinkedListVisualization(svg, width, height, operation);
        break;
      case "binarysearchtree":
      case "bst":
      case "binary search tree":
      case "binary tree":
      case "binarytree":
        renderTreeVisualization(svg, width, height, operation);
        break;
      case "stack":
      case "queue":
        renderStackQueueVisualization(svg, width, height, operation);
        break;
      case "hashmap":
      case "hashtable":
      case "map":
      case "unordered_map":
        renderHashMapVisualization(svg, width, height, operation);
        break;
      default:
        // For any other data structure, or if memory visualization is enabled
        if (enableMemoryVisualization) {
          renderMemoryVisualization(
            svg,
            width,
            height,
            operation,
            dataStructure.type
          );
        } else {
          renderDefaultVisualization(svg, width, height, operation);
        }
    }
  }, [
    operations,
    currentHistoryIndex,
    dataStructure,
    enableMemoryVisualization,
  ]);

  useEffect(() => {
    if (dsDetails) {
      fetchDataStructure();
    } else {
      setError("No data structure details provided");
      setLoading(false);
    }
  }, [dsDetails, fetchDataStructure]);

  useEffect(() => {
    if (dataStructure) {
      renderVisualization();
    }
  }, [dataStructure, currentHistoryIndex, renderVisualization]);

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

  // Add a resize observer to update the visualization when the container size changes
  useEffect(() => {
    if (!svgRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      renderVisualization();
    });

    resizeObserver.observe(svgRef.current.parentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [renderVisualization]);

  const handleOperationSubmit = async (e) => {
    e.preventDefault();
    try {
      setProcessingOperation(true);

      if (!dataStructure) {
        throw new Error("No data structure available");
      }

      // Perform operation
      await dataStructureService.performOperation(
        dataStructure.type,
        dataStructure.name,
        dataStructure.implementation,
        operation,
        value
      );

      // Fetch updated operations history
      const response = await dataStructureService.findDataStructure(
        dataStructure.type,
        dataStructure.name,
        dataStructure.implementation
      );

      // Parse the updated response
      const responseData = response.data;

      if (
        !responseData ||
        !responseData.memoryHistory ||
        !responseData.memoryHistory.operationHistoryList
      ) {
        throw new Error("Invalid response format from server");
      }

      // Extract operation history
      const operationHistory = responseData.memoryHistory.operationHistoryList;

      // Convert the operation history to the format our visualization expects
      const formattedOperations = operationHistory.map((op) => {
        // Get the last memory snapshot which represents the final state after the operation
        const lastSnapshot = op.memorySnapshots[op.memorySnapshots.length - 1];

        return {
          operation: op.operationName,
          parameters: op.parameters,
          state: {
            // Combine instance variables, addressObjectMap and other relevant data
            ...lastSnapshot.instanceVariables,
            addressObjectMap: lastSnapshot.addressObjectMap,
            result: lastSnapshot.getResult,
            message: lastSnapshot.message,
          },
          // Include all memory snapshots for detailed visualization
          memorySnapshots: op.memorySnapshots,
        };
      });

      setOperations(formattedOperations);

      // Set current state from the last operation's final state
      const lastOperation = operationHistory[operationHistory.length - 1];
      const lastSnapshot =
        lastOperation.memorySnapshots[lastOperation.memorySnapshots.length - 1];

      setDataStructure({
        ...dataStructure,
        state: {
          ...lastSnapshot.instanceVariables,
          addressObjectMap: lastSnapshot.addressObjectMap,
          elements: extractElementsFromSnapshot(
            lastSnapshot,
            dataStructure.type
          ),
          result: lastSnapshot.getResult,
          message: lastSnapshot.message,
        },
      });

      // Show the latest state
      setCurrentHistoryIndex(formattedOperations.length - 1);

      // Reset form
      setOperation("");
      setValue("");
    } catch (err) {
      setError(
        "Failed to perform operation: " + (err.message || "Unknown error")
      );
      console.error(err);
    } finally {
      setProcessingOperation(false);
    }
  };

  // Helper function to extract elements from snapshot based on data structure type
  const extractElementsFromSnapshot = (snapshot, type) => {
    // Different data structures store their elements differently
    const typeKey = type.toUpperCase();

    // Handle array-based data structures (Vector, Stack, etc.)
    if (snapshot.addressObjectMap && snapshot.instanceVariables.array) {
      const arrayAddress = snapshot.instanceVariables.array;
      const array = snapshot.addressObjectMap[arrayAddress];
      if (array) {
        // Filter out null values and format for visualization
        return array.filter((item) => item !== null);
      }
    }

    // For linked structures (LinkedList, etc.)
    if (typeKey.includes("LINKED") && snapshot.addressObjectMap) {
      // Implementation would depend on how linked structures are represented
      // This is a simplified approach
      const elements = [];
      let head = snapshot.instanceVariables.head;

      // Follow the linked list and extract values
      while (head && snapshot.addressObjectMap[head]) {
        const node = snapshot.addressObjectMap[head];
        if (node.value !== undefined) {
          elements.push(node.value);
        }
        head = node.next;
      }

      return elements;
    }

    // Default: try to return whatever elements we can find
    // This is a fallback and might need adjustment based on actual data
    return (
      Object.values(snapshot.instanceVariables).filter((value) =>
        Array.isArray(value)
      )[0] || []
    );
  };

  // New visualization function for arrays and vectors
  const renderArrayVisualization = (svg, width, height, operation) => {
    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2 - 300}, ${height / 2 - 150})`);

    const structureData = operation.state ? operation.state.elements || [] : [];
    const elements = Array.isArray(structureData) ? structureData : [];

    // Dimensions
    const cellWidth = 60;
    const cellHeight = 40;
    const cellSpacing = 5;

    // Create a group for the array
    const arrayGroup = g.append("g");

    // Draw index labels
    arrayGroup
      .selectAll(".index-label")
      .data(elements.map((_, i) => i))
      .enter()
      .append("text")
      .attr("class", "index-label")
      .attr("x", (d, i) => i * (cellWidth + cellSpacing) + cellWidth / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .text((d) => d);

    // Draw array cells
    const cells = arrayGroup
      .selectAll(".cell")
      .data(elements)
      .enter()
      .append("g")
      .attr("class", "cell")
      .attr(
        "transform",
        (d, i) => `translate(${i * (cellWidth + cellSpacing)}, 0)`
      );

    // Draw rectangles for cells
    cells
      .append("rect")
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("fill", "white")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("rx", 4);

    // Add text for values
    cells
      .append("text")
      .attr("x", cellWidth / 2)
      .attr("y", cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "14px")
      .text((d) => {
        // Check if it's a pointer (starts with 0x)
        if (typeof d === "string" && d.startsWith("0x")) {
          return "👉 " + d.substring(0, 6);
        }
        return d;
      });

    // Highlight the operation
    highlightOperation(g, operation);
  };

  // New visualization function for linked lists
  const renderLinkedListVisualization = (svg, width, height, operation) => {
    const g = svg
      .append("g")
      .attr("transform", `translate(50, ${height / 2 - 50})`);

    const structureData = operation.state ? operation.state.elements || [] : [];

    // Extract nodes and links from the data
    let nodes = [];
    let links = [];

    if (Array.isArray(structureData)) {
      // Might be a simple array representation
      nodes = structureData.map((value, index) => ({
        id: index,
        value: value,
        isPointer: typeof value === "string" && value.startsWith("0x"),
      }));

      // Create links between consecutive nodes
      for (let i = 0; i < nodes.length - 1; i++) {
        links.push({ source: i, target: i + 1 });
      }
    } else if (structureData && typeof structureData === "object") {
      // Handle more complex structure representation
      // This might need to be adjusted based on your actual data structure
      const processNode = (node, id) => {
        if (!node) return null;

        const newNode = { id, value: node.value || node.data || "N/A" };
        nodes.push(newNode);

        if (node.next && nodes.length < 20) {
          // Limit to prevent infinite loops
          const nextId = id + 1;
          links.push({ source: id, target: nextId });
          processNode(node.next, nextId);
        }

        return newNode;
      };

      processNode(structureData, 0);
    }

    // Node dimensions
    const nodeWidth = 60;
    const nodeHeight = 40;
    const nodeSpacing = 80;

    // Draw nodes
    const nodeGroups = g
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d, i) => `translate(${i * nodeSpacing}, 0)`);

    // Draw node rectangles
    nodeGroups
      .append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight)
      .attr("fill", "white")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("rx", 4);

    // Add value text
    nodeGroups
      .append("text")
      .attr("x", nodeWidth / 2)
      .attr("y", nodeHeight / 2 - 5)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "14px")
      .text((d) => (d.isPointer ? "👉 " + d.value.substring(0, 6) : d.value));

    // Draw next pointers
    nodeGroups
      .filter((d, i) => i < nodes.length - 1)
      .append("circle")
      .attr("cx", nodeWidth - 10)
      .attr("cy", nodeHeight / 2 + 10)
      .attr("r", 5)
      .attr("fill", "black");

    // Draw links as curved arrows
    g.selectAll(".link")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", (d) => {
        const sourceX = d.source * nodeSpacing + nodeWidth;
        const sourceY = nodeHeight / 2;
        const targetX = d.target * nodeSpacing;
        const targetY = nodeHeight / 2;

        // Create a curved path
        return `M${sourceX},${sourceY} 
                C${sourceX + nodeSpacing / 3},${sourceY} 
                  ${targetX - nodeSpacing / 3},${targetY} 
                  ${targetX},${targetY}`;
      })
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrowhead)");

    // Add arrowhead marker definition
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "black");

    // Highlight the operation
    highlightOperation(g, operation);
  };

  // Simplified Tree Visualization
  const renderTreeVisualization = (svg, width, height, operation) => {
    const g = svg.append("g").attr("transform", `translate(${width / 2}, 50)`);

    const structureData = operation.state ? operation.state.elements || [] : [];

    // Function to process tree data
    const processTreeData = (data) => {
      if (!data) return null;

      // Convert to hierarchy-compatible format
      const convertToHierarchy = (node, id = "root") => {
        if (!node) return null;

        const result = {
          name: node.value || node.data || "N/A",
          id,
        };

        const children = [];
        if (node.left)
          children.push(convertToHierarchy(node.left, `${id}-left`));
        if (node.right)
          children.push(convertToHierarchy(node.right, `${id}-right`));

        if (children.length > 0) result.children = children;
        return result;
      };

      return convertToHierarchy(data);
    };

    const treeData = processTreeData(structureData);

    if (treeData) {
      // Create hierarchy
      const root = d3.hierarchy(treeData);

      // Create tree layout
      const treeLayout = d3.tree().size([width - 100, height - 150]);

      // Compute layout
      treeLayout(root);

      // Draw links
      g.selectAll(".link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", (d) => {
          return `M${d.source.x},${d.source.y}C${d.source.x},${
            (d.source.y + d.target.y) / 2
          } ${d.target.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${
            d.target.y
          }`;
        })
        .attr("fill", "none")
        .attr("stroke", "#555")
        .attr("stroke-width", 1.5);

      // Draw nodes
      const nodes = g
        .selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", (d) => `translate(${d.x},${d.y})`);

      // Add circles for nodes
      nodes
        .append("circle")
        .attr("r", 20)
        .attr("fill", "white")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2);

      // Add node labels
      nodes
        .append("text")
        .attr("dy", "0.3em")
        .attr("text-anchor", "middle")
        .text((d) => d.data.name)
        .attr("font-size", "12px");
    }

    // Highlight the operation
    highlightOperation(g, operation);
  };

  // Helper function to highlight the current operation
  const highlightOperation = (g, operation) => {
    if (!operation || !operation.operation) return;

    // Add operation info at the bottom
    g.append("text")
      .attr("x", 0)
      .attr("y", 200)
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text(`Operation: ${operation.operation}`);

    if (operation.parameters && operation.parameters.index !== undefined) {
      g.append("text")
        .attr("x", 0)
        .attr("y", 225)
        .attr("font-size", "14px")
        .text(`Index: ${operation.parameters.index}`);
    }

    if (operation.parameters && operation.parameters.value !== undefined) {
      g.append("text")
        .attr("x", 0)
        .attr("y", 250)
        .attr("font-size", "14px")
        .text(`Value: ${operation.parameters.value}`);
    }
  };

  // Stack and Queue Visualization
  const renderStackQueueVisualization = (svg, width, height, operation) => {
    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2 - 50}, 50)`);

    const structureData = operation.state ? operation.state.elements || [] : [];
    const elements = Array.isArray(structureData) ? structureData : [];
    const isStack = dataStructure.type.toLowerCase() === "stack";

    // Dimensions
    const cellWidth = 100;
    const cellHeight = 40;

    // Draw container
    g.append("rect")
      .attr("x", -10)
      .attr("y", -10)
      .attr("width", cellWidth + 20)
      .attr("height", elements.length * cellHeight + 20 + (isStack ? 30 : 0))
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5");

    // Labels for top/front and bottom/back
    if (isStack) {
      g.append("text")
        .attr("x", -20)
        .attr("y", 20)
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .text("Top");

      g.append("text")
        .attr("x", -20)
        .attr("y", elements.length * cellHeight)
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .text("Bottom");
    } else {
      g.append("text")
        .attr("x", -20)
        .attr("y", 20)
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .text("Front");

      g.append("text")
        .attr("x", -20)
        .attr("y", elements.length * cellHeight)
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .text("Back");
    }

    // Draw elements
    const cells = g
      .selectAll(".cell")
      .data(elements)
      .enter()
      .append("g")
      .attr("class", "cell")
      .attr("transform", (d, i) => `translate(0, ${i * cellHeight})`);

    cells
      .append("rect")
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("fill", "white")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2);

    cells
      .append("text")
      .attr("x", cellWidth / 2)
      .attr("y", cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "14px")
      .text((d) => d);

    // Highlight the operation
    highlightOperation(g, operation);
  };

  // HashMap/HashTable Visualization
  const renderHashMapVisualization = (svg, width, height, operation) => {
    const g = svg.append("g").attr("transform", `translate(50, 50)`);

    const structureData = operation.state ? operation.state.elements || [] : [];

    // Prepare data
    let entries = [];
    if (structureData && typeof structureData === "object") {
      // If it's directly a map-like object
      entries = Object.entries(structureData);
    } else if (Array.isArray(structureData)) {
      // If it's an array of key-value pairs
      entries = structureData
        .filter((item) => item && item.key !== undefined)
        .map((item) => [item.key, item.value]);
    }

    // Dimensions
    const bucketWidth = 120;
    const bucketHeight = 40;
    const bucketSpacing = 10;
    const maxBuckets = 8;

    // Draw hashmap container
    g.append("rect")
      .attr("x", -10)
      .attr("y", -10)
      .attr("width", bucketWidth + 20)
      .attr("height", maxBuckets * (bucketHeight + bucketSpacing) + 10)
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-width", 2);

    // Draw buckets
    for (let i = 0; i < maxBuckets; i++) {
      g.append("rect")
        .attr("x", 0)
        .attr("y", i * (bucketHeight + bucketSpacing))
        .attr("width", bucketWidth)
        .attr("height", bucketHeight)
        .attr("fill", "white")
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1);

      // Bucket index
      g.append("text")
        .attr("x", -5)
        .attr("y", i * (bucketHeight + bucketSpacing) + bucketHeight / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "12px")
        .text(i);
    }

    // Draw entries
    const entryGroups = g
      .selectAll(".entry")
      .data(entries)
      .enter()
      .append("g")
      .attr("class", "entry");

    // Place entries in buckets (simplified hash function)
    entryGroups.each(function (d, i) {
      const key = d[0];
      const value = d[1];

      // Simple hash function for visualization
      const hashValue =
        typeof key === "string"
          ? key.split("").reduce((a, b) => a + b.charCodeAt(0), 0) % maxBuckets
          : typeof key === "number"
          ? key % maxBuckets
          : i % maxBuckets;

      const entryG = d3
        .select(this)
        .attr(
          "transform",
          `translate(${bucketWidth + 50}, ${
            hashValue * (bucketHeight + bucketSpacing)
          })`
        );

      // Draw entry rectangle
      entryG
        .append("rect")
        .attr("width", 200)
        .attr("height", bucketHeight)
        .attr("fill", "white")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("rx", 4);

      // Key-value text
      entryG
        .append("text")
        .attr("x", 10)
        .attr("y", bucketHeight / 2)
        .attr("dominant-baseline", "middle")
        .attr("font-size", "14px")
        .text(`${key}: ${value}`);

      // Draw arrow from bucket to entry
      g.append("path")
        .attr(
          "d",
          `M${bucketWidth},${
            hashValue * (bucketHeight + bucketSpacing) + bucketHeight / 2
          } L${bucketWidth + 40},${
            hashValue * (bucketHeight + bucketSpacing) + bucketHeight / 2
          }`
        )
        .attr("stroke", "black")
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrowhead)");
    });

    // Add arrowhead marker definition if not already added
    if (!svg.select("#arrowhead").size()) {
      svg
        .append("defs")
        .append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#4338ca");
    }

    // Highlight the operation
    highlightOperation(g, operation);
  };

  // Helper function to check if a value is a memory address
  const isAddress = (value) => {
    return typeof value === "string" && value.startsWith("0x");
  };

  // New function to render memory-based visualization with pointers and addresses
  const renderMemoryVisualization = (
    svg,
    width,
    height,
    operation,
    structureType
  ) => {
    const memorySnapshot = operation.memorySnapshots
      ? operation.memorySnapshots[operation.memorySnapshots.length - 1]
      : null;

    if (!memorySnapshot) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .text("Memory snapshot not available");
      return;
    }

    // Create a container for the visualization with margin
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Variables section
    const instanceVars = memorySnapshot.instanceVariables || {};
    const localVars = memorySnapshot.localVariables || {};
    const addressMap = memorySnapshot.addressObjectMap || {};

    // Variables to track rendering positions
    let instanceVarsHeight = 0;
    let localVarsHeight = 0;
    let heapStartY = 0;

    // Create a dictionary to track positions of objects for drawing pointer lines
    const objectPositions = {};

    // Create a group for pointer arrows
    const pointerArrows = g.append("g").attr("class", "pointer-arrows");

    // Function to store object position with full dimensions
    const recordObjectPosition = (key, value, x, y, width, height) => {
      objectPositions[key] = {
        value,
        x,
        y,
        width,
        height,
        centerX: x + width / 2,
        centerY: y + height / 2,
      };
    };

    // Render instance variables section
    if (Object.keys(instanceVars).length > 0) {
      const sectionHeader = g
        .append("g")
        .attr("transform", "translate(20, 20)");

      // Section header
      sectionHeader
        .append("text")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text("Instance Variables");

      const varHeight = 22;
      const varWidth = 220;
      const varsGroup = g.append("g").attr("transform", "translate(20, 40)");

      // Draw each instance variable
      Object.entries(instanceVars).forEach(([name, value], index) => {
        const varY = index * varHeight;

        // Variable rectangle
        varsGroup
          .append("rect")
          .attr("x", 0)
          .attr("y", varY)
          .attr("width", varWidth)
          .attr("height", varHeight)
          .attr("fill", isAddress(value) ? "#f3f4f6" : "#ffffff")
          .attr("stroke", "#d1d5db")
          .attr("rx", 2);

        // Variable name
        varsGroup
          .append("text")
          .attr("x", 5)
          .attr("y", varY + varHeight / 2)
          .attr("dominant-baseline", "middle")
          .attr("font-size", "11px")
          .attr("fill", "#374151")
          .text(name);

        // Variable value
        varsGroup
          .append("text")
          .attr("x", varWidth - 5)
          .attr("y", varY + varHeight / 2)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "11px")
          .attr("fill", isAddress(value) ? "#1d4ed8" : "#111827")
          .text(
            value !== null && value !== undefined
              ? isAddress(value)
                ? value
                : typeof value === "object"
                ? "{...}"
                : value.toString().substring(0, 15)
              : "null"
          );

        // Record position for drawing arrows
        recordObjectPosition(
          `instanceVar_${name}`,
          value,
          20,
          40 + varY,
          varWidth,
          varHeight
        );
      });

      // Update the height for next section
      instanceVarsHeight =
        40 + Object.keys(instanceVars).length * varHeight + 20;
    }

    // Render local variables section if any exist
    if (Object.keys(localVars).length > 0) {
      const localsStartY = instanceVarsHeight > 0 ? instanceVarsHeight : 20;
      const sectionHeader = g
        .append("g")
        .attr("transform", `translate(20, ${localsStartY})`);

      // Section header
      sectionHeader
        .append("text")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text("Local Variables");

      const varHeight = 22;
      const varWidth = 220;
      const varsGroup = g
        .append("g")
        .attr("transform", `translate(20, ${localsStartY + 20})`);

      // Draw each local variable
      Object.entries(localVars).forEach(([name, value], index) => {
        const varY = index * varHeight;

        // Variable rectangle
        varsGroup
          .append("rect")
          .attr("x", 0)
          .attr("y", varY)
          .attr("width", varWidth)
          .attr("height", varHeight)
          .attr("fill", isAddress(value) ? "#f3f4f6" : "#ffffff")
          .attr("stroke", "#d1d5db")
          .attr("rx", 2);

        // Variable name
        varsGroup
          .append("text")
          .attr("x", 5)
          .attr("y", varY + varHeight / 2)
          .attr("dominant-baseline", "middle")
          .attr("font-size", "11px")
          .attr("fill", "#374151")
          .text(name);

        // Variable value
        varsGroup
          .append("text")
          .attr("x", varWidth - 5)
          .attr("y", varY + varHeight / 2)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "11px")
          .attr("fill", isAddress(value) ? "#1d4ed8" : "#111827")
          .text(
            value !== null && value !== undefined
              ? isAddress(value)
                ? value
                : typeof value === "object"
                ? "{...}"
                : value.toString().substring(0, 15)
              : "null"
          );

        // Record position for drawing arrows
        recordObjectPosition(
          `localVar_${name}`,
          value,
          20,
          localsStartY + 20 + varY,
          varWidth,
          varHeight
        );
      });

      // Update height for heap section
      localVarsHeight = Object.keys(localVars).length * varHeight + 20;
    }

    // Calculate starting position for heap objects
    heapStartY = instanceVarsHeight + localVarsHeight;
    if (heapStartY > 0) {
      // Add heap section header
      g.append("text")
        .attr("x", 20)
        .attr("y", heapStartY + 20)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text("Heap Memory");

      heapStartY += 40;
    } else {
      heapStartY = 60;
    }

    // Loop through arrays first
    Object.entries(addressMap)
      .filter(([_, obj]) => Array.isArray(obj))
      .forEach(([address, array], i) => {
        const arrayX = 50;
        const arrayY = heapStartY + i * 80;
        const elementWidth = 40;
        const elementHeight = 30;
        const headerHeight = 20;
        const arrayWidth = array.length * elementWidth;
        const arrayHeight = headerHeight + elementHeight;

        // Draw array header
        g.append("rect")
          .attr("x", arrayX)
          .attr("y", arrayY)
          .attr("width", arrayWidth)
          .attr("height", headerHeight)
          .attr("fill", "#c7d2fe")
          .attr("stroke", "#4338ca")
          .attr("rx", 3);

        // Draw array header text (address)
        g.append("text")
          .attr("x", arrayX + 5)
          .attr("y", arrayY + headerHeight / 2)
          .attr("dominant-baseline", "middle")
          .attr("font-size", "10px")
          .attr("fill", "#1e1b4b")
          .text(address);

        // Draw array elements
        array.forEach((value, index) => {
          const elemX = arrayX + index * elementWidth;
          const elemY = arrayY + headerHeight;

          // Element rectangle
          g.append("rect")
            .attr("x", elemX)
            .attr("y", elemY)
            .attr("width", elementWidth)
            .attr("height", elementHeight)
            .attr("fill", isAddress(value) ? "#ede9fe" : "white")
            .attr("stroke", "#6b7280")
            .attr("rx", 2);

          // Element index
          g.append("text")
            .attr("x", elemX + 5)
            .attr("y", elemY + 10)
            .attr("font-size", "9px")
            .attr("fill", "#6b7280")
            .text(index);

          // Element value
          g.append("text")
            .attr("x", elemX + elementWidth / 2)
            .attr("y", elemY + elementHeight / 2 + 5)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("fill", isAddress(value) ? "#4338ca" : "#111827")
            .text(
              value !== null
                ? isAddress(value)
                  ? value.substring(0, 6) + "..."
                  : value
                : "null"
            );
        });

        // Record the position of the entire array for pointer references
        recordObjectPosition(
          address,
          address,
          arrayX,
          arrayY,
          arrayWidth,
          arrayHeight
        );

        // Record positions of individual elements
        array.forEach((value, index) => {
          const elemX = arrayX + index * elementWidth;
          const elemY = arrayY + headerHeight;
          recordObjectPosition(
            `${address}[${index}]`,
            value,
            elemX,
            elemY,
            elementWidth,
            elementHeight
          );
        });
      });

    // Then render objects (non-arrays)
    Object.entries(addressMap)
      .filter(([_, obj]) => !Array.isArray(obj))
      .forEach(([address, obj], i) => {
        const objectX = 300;
        const objectY = heapStartY + i * 100;
        const objectWidth = 150;
        const headerHeight = 20;
        const fieldHeight = 25;
        const objectHeight =
          headerHeight + Object.keys(obj).length * fieldHeight;

        // Draw object header
        g.append("rect")
          .attr("x", objectX)
          .attr("y", objectY)
          .attr("width", objectWidth)
          .attr("height", headerHeight)
          .attr("fill", "#bfdbfe")
          .attr("stroke", "#1d4ed8")
          .attr("rx", 3);

        // Draw object header text (address)
        g.append("text")
          .attr("x", objectX + 5)
          .attr("y", objectY + headerHeight / 2)
          .attr("dominant-baseline", "middle")
          .attr("font-size", "10px")
          .attr("fill", "#1e3a8a")
          .text(address);

        // Draw object fields
        Object.entries(obj).forEach(([field, value], fieldIndex) => {
          const fieldY = objectY + headerHeight + fieldIndex * fieldHeight;

          // Field rectangle
          g.append("rect")
            .attr("x", objectX)
            .attr("y", fieldY)
            .attr("width", objectWidth)
            .attr("height", fieldHeight)
            .attr("fill", isAddress(value) ? "#dbeafe" : "white")
            .attr("stroke", "#6b7280")
            .attr("rx", 2);

          // Field name
          g.append("text")
            .attr("x", objectX + 5)
            .attr("y", fieldY + fieldHeight / 2)
            .attr("dominant-baseline", "middle")
            .attr("font-size", "10px")
            .attr("fill", "#6b7280")
            .text(field);

          // Field value
          g.append("text")
            .attr("x", objectX + objectWidth - 5)
            .attr("y", fieldY + fieldHeight / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "10px")
            .attr("fill", isAddress(value) ? "#1d4ed8" : "#111827")
            .text(
              value !== null
                ? isAddress(value)
                  ? value.substring(0, 6) + "..."
                  : typeof value === "object"
                  ? "{...}"
                  : value.toString().substring(0, 15)
                : "null"
            );
        });

        // Record the position of the object for pointer references
        recordObjectPosition(
          address,
          address,
          objectX,
          objectY,
          objectWidth,
          objectHeight
        );

        // Record positions of each field
        Object.entries(obj).forEach(([field, value], fieldIndex) => {
          const fieldY = objectY + headerHeight + fieldIndex * fieldHeight;
          recordObjectPosition(
            `${address}.${field}`,
            value,
            objectX,
            fieldY,
            objectWidth,
            fieldHeight
          );
        });
      });

    // Function to generate a curved path between points
    const generateCurve = (source, target) => {
      if (!source || !target) return "";

      // Determine which edges to connect based on relative positions
      let sourceX, sourceY, targetX, targetY;

      // Horizontal relationship (prioritize left/right connections)
      if (
        Math.abs(source.centerX - target.centerX) >
        Math.abs(source.centerY - target.centerY)
      ) {
        // Source is to the left of target
        if (source.centerX < target.centerX) {
          sourceX = source.x + source.width; // Right edge of source
          sourceY = source.centerY;
          targetX = target.x; // Left edge of target
          targetY = target.centerY;
        } else {
          // Source is to the right of target
          sourceX = source.x; // Left edge of source
          sourceY = source.centerY;
          targetX = target.x + target.width; // Right edge of target
          targetY = target.centerY;
        }
      }
      // Vertical relationship
      else {
        // Source is above target
        if (source.centerY < target.centerY) {
          sourceX = source.centerX;
          sourceY = source.y + source.height; // Bottom edge of source
          targetX = target.centerX;
          targetY = target.y; // Top edge of target
        } else {
          // Source is below target
          sourceX = source.centerX;
          sourceY = source.y; // Top edge of source
          targetX = target.centerX;
          targetY = target.y + target.height; // Bottom edge of target
        }
      }

      // Calculate control points for a smooth curve
      const dx = Math.abs(targetX - sourceX) * 0.5;
      const dy = Math.abs(targetY - sourceY) * 0.3;

      // Adjust control points based on direction
      let controlPoint1X, controlPoint1Y, controlPoint2X, controlPoint2Y;

      // Horizontal relationship
      if (
        Math.abs(source.centerX - target.centerX) >
        Math.abs(source.centerY - target.centerY)
      ) {
        controlPoint1X = sourceX + (targetX > sourceX ? dx : -dx);
        controlPoint1Y = sourceY;
        controlPoint2X = targetX - (targetX > sourceX ? dx : -dx);
        controlPoint2Y = targetY;
      }
      // Vertical relationship
      else {
        controlPoint1X = sourceX;
        controlPoint1Y = sourceY + (targetY > sourceY ? dy : -dy);
        controlPoint2X = targetX;
        controlPoint2Y = targetY - (targetY > sourceY ? dy : -dy);
      }

      // Return a cubic Bezier curve path
      return `M ${sourceX} ${sourceY} 
              C ${controlPoint1X} ${controlPoint1Y}, 
                ${controlPoint2X} ${controlPoint2Y}, 
                ${targetX} ${targetY}`;
    };

    // Find all pointers and draw arrows
    Object.entries(objectPositions).forEach(([key, source]) => {
      if (isAddress(source.value) && objectPositions[source.value]) {
        const target = objectPositions[source.value];

        // Draw arrow
        pointerArrows
          .append("path")
          .attr("d", generateCurve(source, target))
          .attr("fill", "none")
          .attr("stroke", "#4338ca")
          .attr("stroke-width", 2)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("marker-end", "url(#arrowhead)")
          .style("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.1))");
      }
    });

    // Define arrowhead marker
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#4338ca");

    // 5. Add operation information at the bottom
    g.append("text")
      .attr("x", 10)
      .attr("y", innerHeight - 10)
      .attr("font-size", 12)
      .attr("fill", "#6b7280")
      .text(
        `Operation: ${operation.operation || "Constructor"} ${
          operation.parameters ? JSON.stringify(operation.parameters) : ""
        }`
      );
  };

  // Simplified default visualization for unsupported data structures
  const renderDefaultVisualization = (svg, width, height, operation) => {
    const state = operation.state;
    const g = svg.append("g").attr("transform", `translate(20, 20)`);

    g.append("text")
      .attr("x", width / 2 - 20)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .text(`${dataStructure.type} - ${dataStructure.implementation || ""}`);

    // Display state as a formatted JSON
    const stateText = JSON.stringify(state, null, 2);
    const stateLines = stateText.split("\n");

    g.append("rect")
      .attr("x", width / 4)
      .attr("y", 40)
      .attr("width", width / 2)
      .attr("height", stateLines.length * 20 + 20)
      .attr("fill", "#f9fafb")
      .attr("stroke", "#d1d5db");

    stateLines.forEach((line, i) => {
      g.append("text")
        .attr("x", width / 4 + 10)
        .attr("y", 60 + i * 20)
        .attr("font-family", "monospace")
        .attr("font-size", 12)
        .text(line);
    });
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
    <div className="h-full overflow-hidden flex flex-col">
      {loading ? (
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header - minimal height */}
          <div className="flex items-center px-4 py-1 bg-white shadow-sm flex-shrink-0">
            <button
              onClick={() => navigate("/home")}
              className="flex items-center text-blue-500 hover:text-blue-700"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back
            </button>
            {dataStructure && (
              <h1 className="text-lg font-bold ml-3 truncate">
                {dataStructure.name}{" "}
                <span className="text-gray-500 text-sm">
                  ({dataStructure.type}
                  {dataStructure.implementation &&
                    ` - ${dataStructure.implementation}`}
                  )
                </span>
              </h1>
            )}
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-1 text-xs flex-shrink-0">
              {error}
            </div>
          )}

          {/* Main content area with reduced padding */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 p-2 overflow-hidden">
            {/* Operation panel */}
            <div className="bg-white rounded shadow-md p-2 flex flex-col h-full overflow-hidden">
              <h2 className="text-md font-bold mb-2 flex-shrink-0">
                Operations
              </h2>
              <div className="overflow-y-auto flex-1 no-scrollbar">
                <form
                  onSubmit={handleOperationSubmit}
                  className="flex flex-col"
                >
                  <div className="mb-2">
                    <label
                      className="block text-gray-700 mb-1 text-xs"
                      htmlFor="operation"
                    >
                      Operation
                    </label>
                    <select
                      id="operation"
                      value={operation}
                      onChange={(e) => setOperation(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    <div className="mb-2">
                      <label
                        className="block text-gray-700 mb-1 text-xs"
                        htmlFor="value"
                      >
                        Value
                      </label>
                      <input
                        id="value"
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    className="w-full bg-blue-500 text-white py-1 px-2 rounded text-sm hover:bg-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-300"
                  >
                    {processingOperation
                      ? "Processing..."
                      : "Perform Operation"}
                  </button>
                </form>

                <div className="mt-2">
                  <h3 className="font-bold mb-1 text-xs">Current State</h3>
                  <div className="bg-gray-100 p-2 rounded max-h-36 overflow-y-auto no-scrollbar">
                    <pre className="text-xs whitespace-pre-wrap">
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
            </div>

            {/* Visualization area */}
            <div className="md:col-span-3 bg-white rounded shadow-md p-2 flex flex-col h-full overflow-hidden">
              <h2 className="text-md font-bold mb-2 flex-shrink-0">
                Visualization
              </h2>

              <div className="flex-1 bg-gray-50 border border-gray-200 rounded p-2 overflow-hidden">
                {operations.length > 0 ? (
                  <svg ref={svgRef} className="w-full h-full"></svg>
                ) : (
                  <div className="flex justify-center items-center h-full text-gray-500 text-sm">
                    No operations performed yet. Start by adding elements to the
                    data structure.
                  </div>
                )}
              </div>

              {/* Playback controls with reduced vertical space */}
              {operations.length > 0 && (
                <div className="flex justify-between items-center mt-2 flex-shrink-0">
                  <div className="text-gray-600 text-xs">
                    Operation {currentHistoryIndex + 1} of {operations.length}
                  </div>

                  <div className="flex space-x-1">
                    <button
                      onClick={goToFirst}
                      disabled={currentHistoryIndex === 0}
                      className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                      title="First"
                    >
                      <svg
                        className="w-4 h-4"
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
                      className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                      title="Previous"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                    </button>

                    <button
                      onClick={toggleAutoPlay}
                      className="p-1 rounded-full hover:bg-gray-200"
                      title={autoPlay ? "Pause" : "Play"}
                    >
                      {autoPlay ? (
                        <PauseIcon className="w-4 h-4" />
                      ) : (
                        <PlayIcon className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={goToNext}
                      disabled={currentHistoryIndex === operations.length - 1}
                      className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                      title="Next"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>

                    <button
                      onClick={goToLast}
                      disabled={currentHistoryIndex === operations.length - 1}
                      className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                      title="Last"
                    >
                      <svg
                        className="w-4 h-4"
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

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                      <label htmlFor="memory-viz" className="mr-1 text-xs">
                        Memory:
                      </label>
                      <button
                        id="memory-viz"
                        onClick={() =>
                          setEnableMemoryVisualization(
                            !enableMemoryVisualization
                          )
                        }
                        className={`px-2 py-0.5 text-xs rounded ${
                          enableMemoryVisualization
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200 text-gray-700"
                        }`}
                        title="Toggle memory visualization"
                      >
                        {enableMemoryVisualization ? "On" : "Off"}
                      </button>
                    </div>

                    <div className="flex items-center">
                      <label htmlFor="playback-speed" className="mr-1 text-xs">
                        Speed:
                      </label>
                      <select
                        id="playback-speed"
                        value={autoPlaySpeed}
                        onChange={(e) =>
                          setAutoPlaySpeed(Number(e.target.value))
                        }
                        className="border border-gray-300 rounded px-1 py-0 text-xs"
                      >
                        <option value={2000}>Slow</option>
                        <option value={1000}>Normal</option>
                        <option value={500}>Fast</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataStructurePage;

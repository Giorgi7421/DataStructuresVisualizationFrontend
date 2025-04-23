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
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(1000); // ms
  const [enableMemoryVisualization, setEnableMemoryVisualization] =
    useState(true);
  const [snapshotMode, setSnapshotMode] = useState(false);

  const svgRef = useRef(null);
  const autoPlayRef = useRef(null);

  // Helper function to check if a value is an address
  const isAddress = (value) => {
    if (!value) return false;
    return typeof value === "string" && value.match(/^0x[0-9a-f]+$/i);
  };

  // Extract elements from memory snapshot
  const extractElementsFromSnapshot = (snapshot, structureType) => {
    try {
      if (!snapshot) return [];

      const { instanceVariables, addressObjectMap } = snapshot;
      const structType = (structureType || "").toUpperCase();

      console.log(
        "Extracting elements from snapshot for",
        structType,
        ":",
        snapshot
      );

      // For vector implementations, check both size and count
      if (structType === "VECTOR") {
        const sizeField = instanceVariables?.size;
        const countField = instanceVariables?.count;
        const size = sizeField !== undefined ? sizeField : countField;

        const arrayAddress = instanceVariables?.array;

        if (arrayAddress && addressObjectMap?.[arrayAddress]) {
          console.log("Vector array found at", arrayAddress, "with size", size);
          const arrayData = addressObjectMap[arrayAddress];
          if (Array.isArray(arrayData)) {
            return arrayData
              .slice(0, size)
              .filter((item) => item !== null && item !== undefined);
          }
        }
      }

      return [];
    } catch (error) {
      console.error("Error extracting elements from snapshot:", error);
      return [];
    }
  };

  // Define fetchDataStructure as a useCallback to avoid dependency issues
  const fetchDataStructure = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!dsDetails) {
        throw new Error("No data structure details provided");
      }

      // Fetch data structure operations
      const response = await dataStructureService.findDataStructure(
        dsDetails.type,
        dsDetails.name,
        dsDetails.implementation
      );

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
      if (formattedOperations.length > 0) {
        const lastOperationIndex = formattedOperations.length - 1;
        setCurrentHistoryIndex(lastOperationIndex);

        // Set the last snapshot of the last operation
        const lastOperation = formattedOperations[lastOperationIndex];
        if (
          lastOperation.memorySnapshots &&
          lastOperation.memorySnapshots.length > 0
        ) {
          const lastSnapshotIndex = lastOperation.memorySnapshots.length - 1;
          setCurrentSnapshotIndex(lastSnapshotIndex);
        }
      }

      // Set the data structure details
      setDataStructure({
        id: dsDetails.id,
        name: dsDetails.name,
        type: dsDetails.type,
        implementation: dsDetails.implementation,
      });

      setLoading(false);
    } catch (err) {
      setError("Failed to load data structure: " + err.message);
      console.error(err);
      setLoading(false);
    }
  }, [dsDetails]);

  // Find the renderVisualization function
  const renderVisualization = useCallback(() => {
    console.log("Starting renderVisualization");

    if (!svgRef.current) {
      console.error("SVG reference is not available");
      return;
    }

    if (!dataStructure) {
      console.error("Data structure is not available");
      return;
    }

    // Clear existing visualization
    d3.select(svgRef.current).selectAll("*").remove();
    console.log("Cleared previous visualization");

    // Create a new SVG
    const svg = d3.select(svgRef.current);
    const width = parseInt(svg.style("width")) || 800;
    const height = parseInt(svg.style("height")) || 600;

    console.log("SVG dimensions for rendering:", { width, height });

    // Debug SVG setup with a background rect
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#f8fafc")
      .attr("stroke", "#d1d5db");

    // Add a test text to verify SVG rendering is working
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#64748b")
      .text("Visualization Area");

    // Get the current operation
    const operation = operations[currentHistoryIndex];
    if (!operation) {
      console.error("No operation available at index", currentHistoryIndex);
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .text("No operation data available");
      return;
    }

    console.log("Current Operation:", operation);
    console.log("Structure Type:", dataStructure.type);
    console.log("Current History Index:", currentHistoryIndex);
    console.log("Current Snapshot Index:", currentSnapshotIndex);
    console.log("Operations array length:", operations.length);

    // Add debug info on the visualization
    svg
      .append("text")
      .attr("x", 10)
      .attr("y", height - 10)
      .attr("font-size", "10px")
      .attr("fill", "#64748b")
      .text(
        `Operation: ${
          operation.operationName || operation.operation
        } | History: ${currentHistoryIndex + 1}/${
          operations.length
        } | Snapshot: ${currentSnapshotIndex + 1}/${
          operation.memorySnapshots?.length || 0
        }`
      );

    // Get the specific memorySnapshot from the operation
    let memorySnapshot = null;
    if (operation.memorySnapshots && operation.memorySnapshots.length > 0) {
      const validSnapshotIndex = Math.min(
        Math.max(0, currentSnapshotIndex),
        operation.memorySnapshots.length - 1
      );

      memorySnapshot = operation.memorySnapshots[validSnapshotIndex];
      console.log(
        `Rendering snapshot ${validSnapshotIndex + 1}/${
          operation.memorySnapshots.length
        } of operation ${operation.operationName || operation.operation}`
      );
    } else {
      console.log(
        `No memory snapshots available for operation ${
          operation.operationName || operation.operation
        }`
      );
    }

    console.log("Memory Snapshot:", memorySnapshot);

    try {
      // FALLBACK: If there's no specific selected memory snapshot, use the operation state directly
      if (!memorySnapshot && operation.state) {
        console.log(
          "Using operation state directly since no memory snapshot is available"
        );

        // Create a modified operation object with the current snapshot data
        const newOperation = { ...operation };

        // Determine visualization method based on structure type
        const structureType = (dataStructure.type || "").toUpperCase();
        const isVector = structureType === "VECTOR";

        console.log(`Is vector implementation: ${isVector}`);
        console.log("Structure type for visualization:", structureType);

        // Select the appropriate visualization method
        if (enableMemoryVisualization) {
          console.log("Using memory visualization (no snapshots)");
          renderMemoryVisualization(newOperation, svgRef);
        } else {
          switch (structureType) {
            case "VECTOR":
              console.log("Using array visualization (no snapshots)");
              renderArrayVisualization(svg, width, height, newOperation);
              break;
            case "LINKED_LIST":
              renderLinkedListVisualization(svg, width, height, newOperation);
              break;
            case "TREE":
              renderTreeVisualization(svg, width, height, newOperation);
              break;
            case "STACK":
            case "QUEUE":
              renderStackQueueVisualization(svg, width, height, newOperation);
              break;
            case "MAP":
              renderHashMapVisualization(svg, width, height, newOperation);
              break;
            default:
              renderDefaultVisualization(svg, width, height, newOperation);
          }
        }
        return;
      }

      if (!memorySnapshot) {
        // No snapshot and no operation state, show error message
        svg
          .append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .text("No memory data available to visualize");
        console.error("No memory snapshot or state data available");
        return;
      }

      // Create a modified operation object with the current snapshot data
      const effectiveOperation = { ...operation };

      // Override operation state with snapshot data
      effectiveOperation.state = {
        ...effectiveOperation.state,
        instanceVariables: memorySnapshot.instanceVariables || {},
        localVariables: memorySnapshot.localVariables || {},
        addressObjectMap: memorySnapshot.addressObjectMap || {},
        elements: extractElementsFromSnapshot(
          memorySnapshot,
          dataStructure.type
        ),
        result: memorySnapshot.getResult,
        message: memorySnapshot.message,
      };

      console.log(
        "Effective operation state for rendering:",
        effectiveOperation.state
      );

      // Determine visualization method based on structure type
      const structureType = (dataStructure.type || "").toUpperCase();
      const isVector = structureType === "VECTOR";

      console.log(`Is vector implementation: ${isVector}`);
      console.log("Structure type for visualization:", structureType);

      // Select the appropriate visualization method
      if (enableMemoryVisualization) {
        console.log("Using memory visualization");
        renderMemoryVisualization(effectiveOperation, svgRef);
      } else {
        switch (structureType) {
          case "VECTOR":
            console.log("Using array visualization");
            renderArrayVisualization(svg, width, height, effectiveOperation);
            break;
          case "LINKED_LIST":
            renderLinkedListVisualization(
              svg,
              width,
              height,
              effectiveOperation
            );
            break;
          case "TREE":
            renderTreeVisualization(svg, width, height, effectiveOperation);
            break;
          case "STACK":
          case "QUEUE":
            renderStackQueueVisualization(
              svg,
              width,
              height,
              effectiveOperation
            );
            break;
          case "MAP":
            renderHashMapVisualization(svg, width, height, effectiveOperation);
            break;
          default:
            renderDefaultVisualization(svg, width, height, effectiveOperation);
        }
      }
    } catch (error) {
      console.error("Error in renderVisualization:", error);

      // Add error information to SVG
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#ef4444")
        .text("Error rendering visualization");

      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2 + 25)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "#ef4444")
        .text(error.message);
    }
  }, [
    operations,
    currentHistoryIndex,
    currentSnapshotIndex,
    dataStructure,
    enableMemoryVisualization,
  ]);

  // Then all the useEffect hooks that reference renderVisualization will come after it
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
      // Specifically check and update elements for vectors before rendering
      if (
        dataStructure.type.toLowerCase().includes("vector") &&
        operations[currentHistoryIndex]
      ) {
        const currentOp = operations[currentHistoryIndex];
        // Get the last memory snapshot for this operation
        const memorySnapshot =
          currentOp.memorySnapshots &&
          currentOp.memorySnapshots[currentOp.memorySnapshots.length - 1];

        if (memorySnapshot) {
          console.log(
            "VECTOR FIX: Getting elements directly from memory snapshot"
          );
          // Get array address and array data directly from the snapshot
          const arrayAddress = memorySnapshot.instanceVariables?.array;
          const count = memorySnapshot.instanceVariables?.count || 0;

          if (arrayAddress && memorySnapshot.addressObjectMap[arrayAddress]) {
            const arrayData = memorySnapshot.addressObjectMap[arrayAddress];
            if (Array.isArray(arrayData)) {
              // Update current operation with elements
              const elements = arrayData
                .slice(0, count)
                .filter((item) => item !== null);
              console.log("VECTOR FIX: Found elements:", elements);

              // Update the operation's state with these elements
              operations[currentHistoryIndex] = {
                ...currentOp,
                state: {
                  ...currentOp.state,
                  elements: elements,
                },
              };
            }
          }
        }
      }

      renderVisualization();
    }
  }, [dataStructure, currentHistoryIndex, renderVisualization, operations]);

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

  // Find and modify the useEffect that resets snapshot index when operation changes
  useEffect(() => {
    if (operations[currentHistoryIndex]?.memorySnapshots?.length > 0) {
      // Change from setting to first snapshot (0) to setting to last snapshot
      const lastSnapshotIndex =
        operations[currentHistoryIndex].memorySnapshots.length - 1;
      setCurrentSnapshotIndex(lastSnapshotIndex);
    }
  }, [currentHistoryIndex, operations]);

  useEffect(() => {
    // Ensure SVG is properly sized
    if (svgRef.current) {
      // Set explicit dimensions if not already set by CSS
      const svg = d3.select(svgRef.current);
      if (!svg.style("width")) svg.style("width", "100%");
      if (!svg.style("height")) svg.style("height", "500px");

      console.log("SVG dimensions:", {
        width: svg.style("width"),
        height: svg.style("height"),
      });
    }
  }, [svgRef.current]);

  // Rendering functions for different data structure types

  const renderArrayVisualization = (svg, width, height, operation) => {
    console.log("Rendering array visualization with operation:", operation);

    try {
      const state = operation.state || {};
      const structureData = state.elements || [];

      console.log("Operation state:", state);
      console.log("Structure data:", structureData);

      // If structureData is empty but we have memorySnapshots, try to extract elements directly
      if (structureData.length === 0 && operation.memorySnapshots?.length > 0) {
        console.log(
          "No elements in state, attempting to extract from memory snapshots..."
        );

        // Get the last memory snapshot for this operation
        const memorySnapshot =
          operation.memorySnapshots[operation.memorySnapshots.length - 1];

        if (memorySnapshot && memorySnapshot.instanceVariables) {
          const { instanceVariables, addressObjectMap } = memorySnapshot;

          // Check for array and count in instanceVariables
          const arrayAddress = instanceVariables.array;
          const count = instanceVariables.count || instanceVariables.size || 0;

          console.log("Found array address:", arrayAddress, "count:", count);

          if (
            arrayAddress &&
            addressObjectMap &&
            addressObjectMap[arrayAddress]
          ) {
            const arrayData = addressObjectMap[arrayAddress];
            if (Array.isArray(arrayData)) {
              // Use only the first 'count' elements
              const elements = arrayData
                .slice(0, count)
                .filter((item) => item !== null);
              console.log("Extracted elements from array:", elements);
              structureData.push(...elements);
            }
          }
        }
      }

      // If still no data to display, show a message
      if (structureData.length === 0) {
        svg
          .append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .attr("font-size", "16px")
          .attr("fill", "#374151")
          .text("No elements to display. Try adding elements first.");
        return;
      }

      // Display info about current operation
      svg
        .append("text")
        .attr("x", 20)
        .attr("y", 30)
        .attr("font-size", "14px")
        .attr("fill", "#4b5563")
        .text(`Operation: ${operation.operation || "Initial State"}`);

      // Set up display constants
      const cellWidth = 60;
      const cellHeight = 40;
      const startX = Math.max(
        20,
        (width - cellWidth * structureData.length) / 2
      );
      const startY = height / 3;

      // Create array cells
      structureData.forEach((value, index) => {
        const cellX = startX + index * cellWidth;

        // Cell rectangle
        svg
          .append("rect")
          .attr("x", cellX)
          .attr("y", startY)
          .attr("width", cellWidth)
          .attr("height", cellHeight)
          .attr("fill", "#f3f4f6")
          .attr("stroke", "#d1d5db")
          .attr("rx", 4);

        // Index label
        svg
          .append("text")
          .attr("x", cellX + cellWidth / 2)
          .attr("y", startY - 10)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("fill", "#6b7280")
          .text(index);

        // Cell value
        svg
          .append("text")
          .attr("x", cellX + cellWidth / 2)
          .attr("y", startY + cellHeight / 2 + 5)
          .attr("text-anchor", "middle")
          .attr("font-size", "14px")
          .attr("fill", "#111827")
          .text(value);
      });

      console.log("Array visualization complete");
    } catch (error) {
      console.error("Error in renderArrayVisualization:", error);
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "red")
        .text(`Error: ${error.message}`);
    }
  };

  const renderLinkedListVisualization = (svg, width, height, operation) => {
    // Placeholder implementation
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("Linked List Visualization");
  };

  const renderTreeVisualization = (svg, width, height, operation) => {
    // Placeholder implementation
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("Tree Visualization");
  };

  const renderStackQueueVisualization = (svg, width, height, operation) => {
    // Placeholder implementation
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("Stack/Queue Visualization");
  };

  const renderHashMapVisualization = (svg, width, height, operation) => {
    // Placeholder implementation
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("HashMap Visualization");
  };

  const renderDefaultVisualization = (svg, width, height, operation) => {
    // Placeholder implementation
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("Default Visualization");
  };

  // Helper to generate curved path between two points
  const generateCurvedPath = (source, target) => {
    // Calculate horizontal and vertical distance between points
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Determine direction to adjust control points
    const isRightToLeft = target.x < source.x;
    const isTopToBottom = target.y > source.y;

    // Adjust control point distances based on total distance
    const controlPointDistance = Math.min(100, distance * 0.5);

    // Position control points based on direction
    let cp1x, cp1y, cp2x, cp2y;

    if (Math.abs(dx) > Math.abs(dy) * 2) {
      // Mostly horizontal path
      cp1x = source.x + (isRightToLeft ? -0.2 : 0.2) * distance;
      cp1y = source.y;
      cp2x = target.x + (isRightToLeft ? 0.2 : -0.2) * distance;
      cp2y = target.y;
    } else if (Math.abs(dy) > Math.abs(dx) * 2) {
      // Mostly vertical path
      cp1x = source.x;
      cp1y = source.y + (isTopToBottom ? 0.2 : -0.2) * distance;
      cp2x = target.x;
      cp2y = target.y + (isTopToBottom ? -0.2 : 0.2) * distance;
    } else {
      // Diagonal path
      cp1x = source.x + (isRightToLeft ? -0.2 : 0.2) * distance;
      cp1y = source.y + (isTopToBottom ? 0.2 : -0.2) * distance;
      cp2x = target.x + (isRightToLeft ? 0.2 : -0.2) * distance;
      cp2y = target.y + (isTopToBottom ? -0.2 : 0.2) * distance;
    }

    return `M ${source.x} ${source.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${target.x} ${target.y}`;
  };

  const renderMemoryVisualization = (operation, svgRef) => {
    try {
      if (
        !operation ||
        !operation.memorySnapshots ||
        operation.memorySnapshots.length === 0
      ) {
        console.error("No memory snapshots available for visualization");
        return;
      }

      console.log("Operation for memory viz:", operation);

      // Get the appropriate memory snapshot based on mode
      const memorySnapshot =
        snapshotMode && operation.memorySnapshots.length > currentSnapshotIndex
          ? operation.memorySnapshots[currentSnapshotIndex]
          : operation.memorySnapshots[operation.memorySnapshots.length - 1];

      console.log("Memory Snapshot for visualization:", memorySnapshot);

      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      // Define layout dimensions and spacing
      const margin = { top: 30, right: 30, bottom: 30, left: 30 };
      const width = svgRef.current.clientWidth - margin.left - margin.right;
      const height = svgRef.current.clientHeight - margin.top - margin.bottom;

      // Create a container group with margins
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Extract data from memory snapshot
      const {
        addressObjectMap = {},
        localVariables = {},
        instanceVariables = {},
      } = memorySnapshot;

      console.log("Address map:", addressObjectMap);
      console.log("Local vars:", localVariables);
      console.log("Instance vars:", instanceVariables);

      // Add snapshot title
      svg
        .append("text")
        .attr("x", svgRef.current.clientWidth / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .text(
          `${operation.operation || "State"} - Snapshot ${
            currentSnapshotIndex + 1
          }/${operation.memorySnapshots.length}`
        );

      // Split the visualization area into sections
      const variablesSectionWidth = Math.min(300, width * 0.3); // Either 300px or 30% of width
      const heapSectionWidth = width - variablesSectionWidth;

      // Variables related style and layout
      const variableBoxHeight = 36;
      const variableBoxWidth = variablesSectionWidth - 20;
      const variableSpacing = 8;

      // Heap related style and layout
      const heapBoxHeight = 36;
      const heapBoxPadding = 16;
      const heapSpacing = 24;
      const fieldSpacing = 5;

      // Color scheme
      const colors = {
        instanceVariable: "#e3f2fd", // Light blue background
        instanceVariableBorder: "#90caf9", // Blue border
        localVariable: "#f3e5f5", // Light purple background
        localVariableBorder: "#ce93d8", // Purple border
        heapObject: "#f5f5f5", // Light gray background
        heapObjectBorder: "#9e9e9e", // Gray border
        heapObjectTitle: "#424242", // Dark gray title
        arrayBackground: "#e8f5e9", // Light green for arrays
        arrayBorder: "#81c784", // Green border for arrays
        objectBackground: "#fff3e0", // Light orange for objects
        objectBorder: "#ffb74d", // Orange border for objects
        nullValue: "#9e9e9e", // Gray for null values
        referenceArrow: "#5c6bc0", // Indigo for references
        text: "#212121", // Nearly black for text
        sectionTitle: "#1976d2", // Blue for section titles
        highlight: "#ff8a65", // Highlight color (light orange)
      };

      // Collect all variables (instance and local)
      const allVariables = {};
      let variableY = 40; // Start position for variables

      // Referenced addresses for highlighting important heap objects
      const referencedAddresses = new Set();

      // For arrows rendering later
      const connections = [];

      // Draw section headers
      g.append("text")
        .attr("x", 10)
        .attr("y", 15)
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .attr("fill", colors.sectionTitle)
        .text("Variables");

      g.append("text")
        .attr("x", variablesSectionWidth + 20)
        .attr("y", 15)
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .attr("fill", colors.sectionTitle)
        .text("Heap Memory");

      // Render instance variables first with a title
      if (Object.keys(instanceVariables).length > 0) {
        g.append("text")
          .attr("x", 10)
          .attr("y", variableY)
          .attr("font-size", "14px")
          .attr("font-weight", "bold")
          .attr("fill", colors.text)
          .text("Instance Variables");

        variableY += 25;

        // Sort instance variables to group similar types
        const sortedInstanceVars = Object.entries(instanceVariables).sort(
          (a, b) => {
            const aIsRef = isAddress(a[1]);
            const bIsRef = isAddress(b[1]);

            // First group by reference/primitive
            if (aIsRef && !bIsRef) return -1;
            if (!aIsRef && bIsRef) return 1;

            // Then by name
            return a[0].localeCompare(b[0]);
          }
        );

        sortedInstanceVars.forEach(([varName, value]) => {
          // Store variable info for later rendering
          allVariables[`instance_${varName}`] = {
            name: varName,
            value,
            type: "instance",
            y: variableY,
          };

          // Track referenced addresses
          if (isAddress(value)) {
            referencedAddresses.add(value);
          }

          variableY += variableBoxHeight + variableSpacing;
        });

        variableY += 15; // Extra space after instance variables
      }

      // Render local variables with a title if any exist
      if (Object.keys(localVariables).length > 0) {
        g.append("text")
          .attr("x", 10)
          .attr("y", variableY)
          .attr("font-size", "14px")
          .attr("font-weight", "bold")
          .attr("fill", colors.text)
          .text("Local Variables");

        variableY += 25;

        // Sort local variables to group similar types
        const sortedLocalVars = Object.entries(localVariables).sort((a, b) => {
          const aIsRef = isAddress(a[1]);
          const bIsRef = isAddress(b[1]);

          // First group by reference/primitive
          if (aIsRef && !bIsRef) return -1;
          if (!aIsRef && bIsRef) return 1;

          // Then by name
          return a[0].localeCompare(b[0]);
        });

        sortedLocalVars.forEach(([varName, value]) => {
          // Store variable info for later rendering
          allVariables[`local_${varName}`] = {
            name: varName,
            value,
            type: "local",
            y: variableY,
          };

          // Track referenced addresses
          if (isAddress(value)) {
            referencedAddresses.add(value);
          }

          variableY += variableBoxHeight + variableSpacing;
        });
      }

      // Process heap objects and analyze their structure
      const processedHeapObjects = new Map();
      const objectSizes = new Map(); // To store calculated sizes for each object

      // First pass - analyze heap objects and determine their structure
      for (const [address, object] of Object.entries(addressObjectMap)) {
        // Skip if not a valid object or already processed
        if (!object || processedHeapObjects.has(address)) continue;

        // Initialize with default size
        const objectType = object.type || "unknown";
        const isArray = objectType === "array";
        const elements = object.elements || [];
        const fields = object.fields || {};

        // Calculate object size
        const fieldCount = Object.keys(fields).length;
        const elementCount = elements.length;

        const headerHeight = 30;
        const fieldsHeight =
          fieldCount > 0 ? fieldCount * (heapBoxHeight + fieldSpacing) + 30 : 0;
        const elementsHeight =
          elementCount > 0
            ? elementCount * (heapBoxHeight + fieldSpacing) + 30
            : 0;

        // Calculate total height based on content
        const totalHeight =
          headerHeight +
          fieldsHeight +
          elementsHeight +
          (fieldCount > 0 && elementCount > 0 ? 10 : 0); // Add spacing between fields and elements

        // Calculate width based on longest field name
        let maxWidth = 180; // Minimum width

        if (fieldCount > 0) {
          const longestFieldName = Object.keys(fields).reduce(
            (max, field) => Math.max(max, field.length),
            0
          );
          maxWidth = Math.max(maxWidth, longestFieldName * 8 + 120);
        }

        objectSizes.set(address, {
          width: maxWidth,
          height: totalHeight,
          fieldCount,
          elementCount,
        });

        processedHeapObjects.set(address, object);
      }

      // Sort heap objects with referenced ones first, arrays, then others
      const sortedHeapAddresses = [...processedHeapObjects.keys()].sort(
        (a, b) => {
          // First prioritize referenced objects
          const aIsReferenced = referencedAddresses.has(a);
          const bIsReferenced = referencedAddresses.has(b);

          if (aIsReferenced && !bIsReferenced) return -1;
          if (!aIsReferenced && bIsReferenced) return 1;

          // Then prioritize arrays
          const aObject = processedHeapObjects.get(a);
          const bObject = processedHeapObjects.get(b);

          const aIsArray = aObject.type === "array";
          const bIsArray = bObject.type === "array";

          if (aIsArray && !bIsArray) return -1;
          if (!aIsArray && bIsArray) return 1;

          // Lastly sort by address
          return a.localeCompare(b);
        }
      );

      // Layout heap objects in a grid-like pattern
      const heapX = variablesSectionWidth + 20;
      let heapY = 40;
      let rowMaxHeight = 0;
      let currentX = heapX;

      // Map to store object positions for connections
      const heapPositions = {};

      // Second pass - render heap objects based on the sorted list
      sortedHeapAddresses.forEach((address) => {
        const object = processedHeapObjects.get(address);
        const size = objectSizes.get(address);

        // Check if we need to wrap to next row
        if (currentX + size.width > width) {
          currentX = heapX;
          heapY += rowMaxHeight + heapSpacing;
          rowMaxHeight = 0;
        }

        // Store position for later connection drawing
        heapPositions[address] = {
          x: currentX,
          y: heapY,
          width: size.width,
          height: size.height,
        };

        // Update row max height
        rowMaxHeight = Math.max(rowMaxHeight, size.height);

        // Move x position for next object
        currentX += size.width + heapSpacing;
      });

      // Draw connections between variables and heap objects first (behind everything)
      // so they don't overlap with objects
      const drawConnections = () => {
        // Add marker definition for arrows
        const defs = svg.append("defs");

        defs
          .append("marker")
          .attr("id", "arrow")
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 10)
          .attr("refY", 0)
          .attr("markerWidth", 8)
          .attr("markerHeight", 8)
          .attr("orient", "auto")
          .append("path")
          .attr("d", "M0,-5L10,0L0,5")
          .attr("fill", colors.referenceArrow);

        // Draw all connections
        connections.forEach((conn) => {
          const targetPos = heapPositions[conn.target];

          if (!targetPos) {
            console.warn(`Cannot find target for connection: ${conn.target}`);
            return;
          }

          // Draw connection path
          g.append("path")
            .attr(
              "d",
              generateCurvedPath(conn.source, {
                x: targetPos.x + 10,
                y: targetPos.y + 15,
              })
            )
            .attr("stroke", colors.referenceArrow)
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .attr("marker-end", "url(#arrow)")
            .attr("opacity", 0.8);

          // Add a small label if needed
          if (conn.label) {
            const pathNode = g.select("path").node();
            if (pathNode) {
              const pathLength = pathNode.getTotalLength();
              const midPoint = pathNode.getPointAtLength(pathLength / 2);

              g.append("text")
                .attr("x", midPoint.x)
                .attr("y", midPoint.y - 5)
                .attr("text-anchor", "middle")
                .attr("font-size", "10px")
                .attr("fill", colors.referenceArrow)
                .text(conn.label);
            }
          }
        });
      };

      // Draw all heap objects
      sortedHeapAddresses.forEach((address) => {
        const object = processedHeapObjects.get(address);
        const isReferenced = referencedAddresses.has(address);
        const size = objectSizes.get(address);
        const pos = heapPositions[address];

        if (!pos) return;

        const x = pos.x;
        const y = pos.y;
        const objectType = object.type || "unknown";
        const isArray = objectType === "array";

        // Determine background and border colors based on type
        const bgColor = isArray
          ? colors.arrayBackground
          : colors.objectBackground;
        const borderColor = isArray ? colors.arrayBorder : colors.objectBorder;

        // Draw object container with a subtle shadow for referenced objects
        if (isReferenced) {
          g.append("rect")
            .attr("x", x + 3)
            .attr("y", y + 3)
            .attr("width", size.width)
            .attr("height", size.height)
            .attr("fill", "#00000015")
            .attr("rx", 5);
        }

        // Main object container
        g.append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", size.width)
          .attr("height", size.height)
          .attr("fill", bgColor)
          .attr("stroke", isReferenced ? colors.highlight : borderColor)
          .attr("stroke-width", isReferenced ? 2 : 1)
          .attr("rx", 5);

        // Object header section
        g.append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", size.width)
          .attr("height", 30)
          .attr("fill", isReferenced ? colors.highlight : borderColor)
          .attr("opacity", isReferenced ? 0.7 : 0.5)
          .attr("stroke", "none")
          .attr("rx", 5)
          .attr("ry", 0);

        // Object address label
        g.append("text")
          .attr("x", x + 10)
          .attr("y", y + 20)
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .attr("fill", colors.heapObjectTitle)
          .text(address.substring(0, 8));

        // Object type label
        g.append("text")
          .attr("x", x + size.width - 10)
          .attr("y", y + 20)
          .attr("text-anchor", "end")
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .attr("fill", colors.heapObjectTitle)
          .text(objectType);

        let contentY = y + 30; // Start position for content

        // Draw object fields if any
        const fields = object.fields || {};
        if (Object.keys(fields).length > 0) {
          // Fields section label
          g.append("rect")
            .attr("x", x)
            .attr("y", contentY)
            .attr("width", size.width)
            .attr("height", 24)
            .attr("fill", isArray ? colors.arrayBorder : colors.objectBorder)
            .attr("opacity", 0.3)
            .attr("stroke", "none");

          g.append("text")
            .attr("x", x + 10)
            .attr("y", contentY + 16)
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", colors.text)
            .text("Fields");

          contentY += 24;

          // Draw each field
          Object.entries(fields).forEach(([fieldName, fieldValue]) => {
            // Field box
            g.append("rect")
              .attr("x", x)
              .attr("y", contentY)
              .attr("width", size.width)
              .attr("height", heapBoxHeight)
              .attr("fill", "rgba(255,255,255,0.7)")
              .attr(
                "stroke",
                isArray ? colors.arrayBorder : colors.objectBorder
              )
              .attr("stroke-width", 0.5);

            // Field name
            g.append("text")
              .attr("x", x + 15)
              .attr("y", contentY + 24)
              .attr("font-size", "12px")
              .attr("fill", colors.text)
              .text(fieldName);

            // Field value
            const isRef = isAddress(fieldValue);
            const valueText =
              fieldValue === null
                ? "null"
                : fieldValue === undefined
                ? "undefined"
                : String(fieldValue);

            const valueColor =
              fieldValue === null
                ? colors.nullValue
                : isRef
                ? colors.referenceArrow
                : colors.text;

            const valueX = x + size.width - 15;

            g.append("text")
              .attr("x", valueX)
              .attr("y", contentY + 24)
              .attr("text-anchor", "end")
              .attr("font-size", "12px")
              .attr("font-family", "monospace")
              .attr("fill", valueColor)
              .text(valueText);

            // Add connection for reference fields
            if (isRef) {
              connections.push({
                source: {
                  x: valueX,
                  y: contentY + 18,
                },
                target: fieldValue,
                label: null,
              });
            }

            contentY += heapBoxHeight + fieldSpacing;
          });

          // Add spacing between fields and elements
          if (object.elements && object.elements.length > 0) {
            contentY += 10;
          }
        }

        // Draw array elements if any
        const elements = object.elements || [];
        if (elements.length > 0) {
          // Elements section label
          g.append("rect")
            .attr("x", x)
            .attr("y", contentY)
            .attr("width", size.width)
            .attr("height", 24)
            .attr("fill", colors.arrayBorder)
            .attr("opacity", 0.3)
            .attr("stroke", "none");

          g.append("text")
            .attr("x", x + 10)
            .attr("y", contentY + 16)
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", colors.text)
            .text("Elements");

          contentY += 24;

          // Draw each element with its index
          elements.forEach((element, index) => {
            // Element box
            g.append("rect")
              .attr("x", x)
              .attr("y", contentY)
              .attr("width", size.width)
              .attr("height", heapBoxHeight)
              .attr("fill", "rgba(255,255,255,0.7)")
              .attr("stroke", colors.arrayBorder)
              .attr("stroke-width", 0.5);

            // Element index
            g.append("text")
              .attr("x", x + 15)
              .attr("y", contentY + 24)
              .attr("font-size", "12px")
              .attr("fill", colors.text)
              .text(`[${index}]`);

            // Element value
            const isRef = isAddress(element);
            const valueText =
              element === null
                ? "null"
                : element === undefined
                ? "undefined"
                : String(element);

            const valueColor =
              element === null
                ? colors.nullValue
                : isRef
                ? colors.referenceArrow
                : colors.text;

            const valueX = x + size.width - 15;

            g.append("text")
              .attr("x", valueX)
              .attr("y", contentY + 24)
              .attr("text-anchor", "end")
              .attr("font-size", "12px")
              .attr("font-family", "monospace")
              .attr("fill", valueColor)
              .text(valueText);

            // Add connection for reference elements
            if (isRef) {
              connections.push({
                source: {
                  x: valueX,
                  y: contentY + 18,
                },
                target: element,
                label: null,
              });
            }

            contentY += heapBoxHeight + fieldSpacing;
          });
        }
      });

      // Draw variables last so they appear on top
      Object.entries(allVariables).forEach(([key, variable]) => {
        const x = 0;
        const y = variable.y;
        const isInstanceVar = variable.type === "instance";

        // Variable box with background color based on type
        g.append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", variableBoxWidth)
          .attr("height", variableBoxHeight)
          .attr(
            "fill",
            isInstanceVar ? colors.instanceVariable : colors.localVariable
          )
          .attr(
            "stroke",
            isInstanceVar
              ? colors.instanceVariableBorder
              : colors.localVariableBorder
          )
          .attr("rx", 4)
          .attr("ry", 4);

        // Variable name
        g.append("text")
          .attr("x", x + 15)
          .attr("y", y + 24)
          .attr("font-size", "13px")
          .attr("fill", colors.text)
          .text(variable.name);

        // Variable value
        const isRef = isAddress(variable.value);
        const valueText =
          variable.value === null
            ? "null"
            : variable.value === undefined
            ? "undefined"
            : String(variable.value);

        const valueColor =
          variable.value === null
            ? colors.nullValue
            : isRef
            ? colors.referenceArrow
            : colors.text;

        const valueX = x + variableBoxWidth - 15;

        g.append("text")
          .attr("x", valueX)
          .attr("y", y + 24)
          .attr("text-anchor", "end")
          .attr("font-size", "13px")
          .attr("font-family", "monospace")
          .attr("fill", valueColor)
          .text(valueText);

        // Add connection if it's a reference
        if (isRef) {
          connections.push({
            source: {
              x: valueX,
              y: y + 18,
            },
            target: variable.value,
            label: null,
          });
        }
      });

      // Draw all connections
      drawConnections();

      // Calculate total height needed and resize SVG if necessary
      const maxHeapY = Object.values(heapPositions).reduce(
        (max, pos) => Math.max(max, pos.y + pos.height),
        0
      );

      const maxVariableY = Math.max(
        ...Object.values(allVariables).map((v) => v.y + variableBoxHeight),
        0 // Ensure we have at least one valid value for max
      );

      const totalHeight = Math.max(maxHeapY, maxVariableY) + margin.bottom + 40;
      svg.attr("height", totalHeight + margin.top);
    } catch (error) {
      console.error("Error rendering memory visualization:", error);
      // Display error message in SVG
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      svg
        .append("text")
        .attr("x", 20)
        .attr("y", 50)
        .attr("fill", "red")
        .text(`Error: ${error.message}`);
    }
  };

  // Navigation functions for snapshot and history
  const goToFirst = () => {
    if (
      snapshotMode &&
      operations[currentHistoryIndex]?.memorySnapshots?.length > 0
    ) {
      setCurrentSnapshotIndex(0);
    } else {
      setCurrentHistoryIndex(0);
    }
  };

  const goToLast = () => {
    if (
      snapshotMode &&
      operations[currentHistoryIndex]?.memorySnapshots?.length > 0
    ) {
      setCurrentSnapshotIndex(
        operations[currentHistoryIndex].memorySnapshots.length - 1
      );
    } else {
      setCurrentHistoryIndex(operations.length - 1);
    }
  };

  const goToPrevious = () => {
    if (snapshotMode) {
      if (currentSnapshotIndex > 0) {
        setCurrentSnapshotIndex(currentSnapshotIndex - 1);
      } else if (currentHistoryIndex > 0) {
        // Move to previous operation and its last snapshot
        setCurrentHistoryIndex(currentHistoryIndex - 1);
        const prevOp = operations[currentHistoryIndex - 1];
        if (prevOp?.memorySnapshots?.length > 0) {
          setCurrentSnapshotIndex(prevOp.memorySnapshots.length - 1);
        }
      }
    } else if (currentHistoryIndex > 0) {
      setCurrentHistoryIndex(currentHistoryIndex - 1);
    }
  };

  const goToNext = () => {
    if (snapshotMode) {
      const maxSnapshot =
        operations[currentHistoryIndex]?.memorySnapshots?.length - 1;
      if (currentSnapshotIndex < maxSnapshot) {
        setCurrentSnapshotIndex(currentSnapshotIndex + 1);
      } else if (currentHistoryIndex < operations.length - 1) {
        // Move to next operation and its first snapshot
        setCurrentHistoryIndex(currentHistoryIndex + 1);
        setCurrentSnapshotIndex(0);
      }
    } else if (currentHistoryIndex < operations.length - 1) {
      setCurrentHistoryIndex(currentHistoryIndex + 1);
    }
  };

  const toggleAutoPlay = () => {
    setAutoPlay(!autoPlay);
  };

  const toggleSnapshotMode = () => {
    const newMode = !snapshotMode;
    setSnapshotMode(newMode);
    if (
      newMode &&
      operations[currentHistoryIndex]?.memorySnapshots?.length > 0
    ) {
      // When entering snapshot mode, start at first snapshot
      setCurrentSnapshotIndex(0);
    }
  };

  // Select a specific operation from the history list
  const selectOperation = (index) => {
    setCurrentHistoryIndex(index);

    // Reset snapshot index to the last snapshot of this operation
    if (operations[index]?.memorySnapshots?.length > 0) {
      setCurrentSnapshotIndex(operations[index].memorySnapshots.length - 1);
    }

    // Exit snapshot mode when selecting a different operation
    setSnapshotMode(false);
  };

  // Get operation options based on the data structure type
  const getOperationOptions = () => {
    if (!dataStructure) return [];

    const type = dataStructure.type.toUpperCase();

    const commonOperations = [
      { value: "CLEAR", label: "Clear" },
      { value: "IS_EMPTY", label: "Is Empty?" },
      { value: "SIZE", label: "Size" },
    ];

    switch (type) {
      case "VECTOR":
        return [
          ...commonOperations,
          { value: "GET", label: "Get Element" },
          { value: "SET", label: "Set Element" },
          { value: "PUSH_BACK", label: "Push Back" },
          { value: "POP_BACK", label: "Pop Back" },
          { value: "INSERT", label: "Insert" },
          { value: "ERASE", label: "Erase" },
        ];
      case "STACK":
        return [
          ...commonOperations,
          { value: "PUSH", label: "Push" },
          { value: "POP", label: "Pop" },
          { value: "TOP", label: "Top" },
        ];
      case "QUEUE":
        return [
          ...commonOperations,
          { value: "ENQUEUE", label: "Enqueue" },
          { value: "DEQUEUE", label: "Dequeue" },
          { value: "FRONT", label: "Front" },
        ];
      case "MAP":
        return [
          ...commonOperations,
          { value: "GET", label: "Get" },
          { value: "PUT", label: "Put" },
          { value: "REMOVE", label: "Remove" },
          { value: "CONTAINS_KEY", label: "Contains Key" },
        ];
      case "TREE":
        return [
          ...commonOperations,
          { value: "INSERT", label: "Insert" },
          { value: "REMOVE", label: "Remove" },
          { value: "FIND", label: "Find" },
          { value: "TRAVERSAL", label: "Traversal" },
        ];
      default:
        return commonOperations;
    }
  };

  // Check if the selected operation needs a value input
  const needsValueInput = () => {
    if (!operation) return false;

    // Operations that don't need a value input
    const noValueOperations = [
      "CLEAR",
      "IS_EMPTY",
      "SIZE",
      "POP",
      "TOP",
      "DEQUEUE",
      "FRONT",
      "POP_BACK",
    ];

    return !noValueOperations.includes(operation);
  };

  // Handle operation form submission
  const handleOperationSubmit = async (e) => {
    e.preventDefault();

    if (!operation || (needsValueInput() && !value)) return;

    try {
      setProcessingOperation(true);

      const response = await dataStructureService.performOperation(
        dataStructure.type,
        dataStructure.name,
        dataStructure.implementation,
        operation,
        value
      );

      // Update operations list with the new operation
      const updatedOperations = [...operations, response.data];
      setOperations(updatedOperations);

      // Navigate to the new operation
      setCurrentHistoryIndex(updatedOperations.length - 1);

      // Reset form fields
      setOperation("");
      setValue("");
      setError(null);
    } catch (err) {
      setError(
        "Failed to perform operation: " +
          (err.response?.data?.message || err.message)
      );
      console.error(err);
    } finally {
      setProcessingOperation(false);
    }
  };

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

                {/* Operation History List */}
                <div className="mt-4">
                  <h3 className="font-bold mb-1 text-xs">Operation History</h3>
                  <div className="bg-gray-100 p-2 rounded max-h-96 overflow-y-auto no-scrollbar">
                    {operations.length > 0 ? (
                      <ul className="divide-y divide-gray-200">
                        {[...operations].reverse().map((op, index) => {
                          // Calculate the original index since we reversed the array
                          const originalIndex = operations.length - 1 - index;
                          return (
                            <li
                              key={originalIndex}
                              className={`py-2 px-1 text-xs ${
                                originalIndex === currentHistoryIndex
                                  ? "bg-blue-100"
                                  : ""
                              }`}
                              onClick={() => selectOperation(originalIndex)}
                            >
                              <div className="font-semibold text-blue-700">
                                {op.operation}
                                {op.parameters &&
                                Object.keys(op.parameters).length > 0
                                  ? `(${Object.values(op.parameters).join(
                                      ", "
                                    )})`
                                  : ""}
                              </div>
                              {op.state && op.state.message && (
                                <div className="mt-1 text-gray-600">
                                  {op.state.message}
                                </div>
                              )}
                              {op.state && op.state.result !== undefined && (
                                <div className="mt-1">
                                  Result:{" "}
                                  <span className="text-green-600">
                                    {op.state.result}
                                  </span>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-xs py-2">
                        No operations performed yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visualization area */}
            <div className="md:col-span-3 bg-white rounded shadow-md p-2 flex flex-col h-full overflow-hidden">
              <h2 className="text-md font-bold mb-2 flex-shrink-0">
                Visualization
              </h2>

              <div
                className="flex-1 overflow-hidden relative"
                style={{ minHeight: "500px" }}
              >
                <svg
                  ref={svgRef}
                  className="w-full h-full"
                  style={{ minHeight: "500px" }}
                ></svg>
              </div>

              {/* Playback controls with reduced vertical space */}
              {operations.length > 0 &&
                operations[currentHistoryIndex]?.memorySnapshots?.length >
                  1 && (
                  <div className="flex justify-between items-center mt-2 flex-shrink-0">
                    <div className="text-gray-600 text-xs">
                      Snapshot {currentSnapshotIndex + 1}/
                      {operations[currentHistoryIndex].memorySnapshots.length}{" "}
                      of "
                      {operations[currentHistoryIndex].operationName ||
                        operations[currentHistoryIndex].operation}
                      "
                    </div>

                    <div className="flex space-x-1">
                      <button
                        onClick={goToFirst}
                        disabled={currentSnapshotIndex === 0}
                        className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                        title="First Snapshot"
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
                        disabled={currentSnapshotIndex === 0}
                        className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                        title="Previous Snapshot"
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
                        disabled={
                          currentSnapshotIndex >=
                          operations[currentHistoryIndex]?.memorySnapshots
                            ?.length -
                            1
                        }
                        className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                        title="Next Snapshot"
                      >
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>

                      <button
                        onClick={goToLast}
                        disabled={
                          currentSnapshotIndex >=
                          operations[currentHistoryIndex]?.memorySnapshots
                            ?.length -
                            1
                        }
                        className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                        title="Last Snapshot"
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
                        <label htmlFor="snapshot-mode" className="mr-1 text-xs">
                          Snapshots:
                        </label>
                        <button
                          id="snapshot-mode"
                          onClick={toggleSnapshotMode}
                          className={`px-2 py-0.5 text-xs rounded ${
                            snapshotMode
                              ? "bg-blue-500 text-white"
                              : "bg-gray-200 text-gray-700"
                          }`}
                          title="Toggle snapshot mode"
                        >
                          {snapshotMode ? "On" : "Off"}
                        </button>
                      </div>

                      <div className="flex items-center">
                        <label
                          htmlFor="playback-speed"
                          className="mr-1 text-xs"
                        >
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

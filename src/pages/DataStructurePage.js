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
  ZoomInIcon,
  ZoomOutIcon,
  RefreshCwIcon,
  MoveIcon,
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
  const [snapshotMode, setSnapshotMode] = useState(true);
  // Track zoom state with all transform properties
  const [zoomLevel, setZoomLevel] = useState(1);

  const svgRef = useRef(null);
  const autoPlayRef = useRef(null);
  const zoomRef = useRef(null);
  const visualizationContainerRef = useRef(null);

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

    // First, create a fixed background layer that doesn't move or zoom
    const backgroundLayer = svg.append("g").attr("class", "fixed-background");

    // Add the gray background rectangle that stays fixed
    backgroundLayer
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#f8fafc")
      .attr("stroke", "#d1d5db");

    // Now create a content layer that will be zoomable and pannable
    const contentGroup = svg.append("g").attr("class", "zoom-container");

    // Set up the zoom behavior for mouse interaction only
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 5]) // Min/max zoom levels
      .translateExtent([
        [-width * 3, -height * 3],
        [width * 3, height * 3],
      ]) // Extra generous panning area
      .on("zoom", (event) => {
        // Apply the transform directly to the content group
        contentGroup.attr("transform", event.transform);

        // Update zoom level for display
        setZoomLevel(event.transform.k);
        console.log("Zoom event:", event.transform.k);
      });

    // Store zoom for reference and manual control
    zoomRef.current = zoom;

    // Apply zoom behavior to the SVG
    svg.call(zoom);

    // Initialize with identity transform
    svg.call(zoom.transform, d3.zoomIdentity);

    // Get the current operation
    const operation = operations[currentHistoryIndex];
    if (!operation) {
      console.error("No operation available at index", currentHistoryIndex);
      contentGroup
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
    contentGroup
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
      const structureType = (dataStructure.type || "").toUpperCase();

      // Special case for web browser visualization
      if (structureType === "WEB_BROWSER") {
        console.log("Rendering WEB_BROWSER visualization");
        renderWebBrowserVisualization(
          contentGroup,
          width,
          height,
          operation,
          memorySnapshot
        );
        return;
      }

      // FALLBACK: If there's no specific selected memory snapshot, use the operation state directly
      if (!memorySnapshot && operation.state) {
        console.log(
          "Using operation state directly since no memory snapshot is available"
        );

        // Create a modified operation object with the current snapshot data
        const newOperation = { ...operation };

        // Determine visualization method based on structure type
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
        contentGroup
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

      // Special case for web browser visualization
      if (structureType === "WEB_BROWSER") {
        console.log("Rendering WEB_BROWSER visualization with memory snapshot");
        renderWebBrowserVisualization(
          contentGroup,
          width,
          height,
          effectiveOperation,
          memorySnapshot
        );
        return;
      }

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
      contentGroup
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#ef4444")
        .text("Error rendering visualization");

      contentGroup
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

  // Add this new function for web browser visualization
  const renderWebBrowserVisualization = (
    container,
    width,
    height,
    operation,
    memorySnapshot
  ) => {
    console.log("Rendering Web Browser visualization");

    // Extract data from operation or memory snapshot
    let browserData = {};

    // First try to get data from memory snapshot
    if (memorySnapshot) {
      // Use memory snapshot directly
      browserData = memorySnapshot;
      console.log("Web Browser data from memory snapshot:", browserData);
    } else if (operation.state) {
      // Fallback to operation state
      browserData = operation.state;
      console.log("Web Browser data from operation state:", browserData);
    }

    // Get the last snapshot of the last operation history if available
    const lastOpIndex = operations.length - 1;
    const lastOp = operations[lastOpIndex];
    const lastSnapshotIndex = lastOp?.memorySnapshots?.length - 1 || 0;
    const lastSnapshot = lastOp?.memorySnapshots?.[lastSnapshotIndex];

    if (lastSnapshot) {
      browserData = lastSnapshot;
      console.log("Using last snapshot of last operation:", browserData);
    }

    // Extract the browser components
    const localVariables = browserData.localVariables || {};
    const instanceVariables = browserData.instanceVariables || {};
    const addressObjectMap = browserData.addressObjectMap || {};
    const currentPageAddress = instanceVariables.current;

    console.log("Local variables:", localVariables);
    console.log("Instance variables:", instanceVariables);
    console.log("Address object map:", addressObjectMap);
    console.log("Current page address:", currentPageAddress);

    // Entity styles
    const styles = {
      browser: {
        width: 500,
        height: 80,
        fill: "#f8fafc", // Very light gray
        stroke: "#94a3b8", // Gray
        textColor: "#334155", // Dark gray
      },
      page: {
        width: 200,
        height: 120,
        fill: "#ffffff", // White
        stroke: "#94a3b8", // Gray
        textColor: "#334155", // Dark gray
        currentFill: "#f1f5f9", // Light gray for current page
        currentStroke: "#64748b", // Darker gray for current page
      },
      localVars: {
        width: 200,
        height: 30, // Will be adjusted based on content
        fill: "#f8fafc", // Very light gray
        stroke: "#94a3b8", // Gray
        textColor: "#334155", // Dark gray
      },
      instanceVars: {
        width: 200,
        height: 30, // Will be adjusted based on content
        fill: "#f1f5f9", // Light slate
        stroke: "#64748b", // Slate
        textColor: "#334155", // Dark slate
      },
      connection: {
        stroke: "#64748b", // Slate
        width: 2,
        nextColor: "#64748b", // Gray for next pointers
        prevColor: "#64748b", // Gray for previous pointers
        currentColor: "#334155", // Dark gray for current pointer
      },
    };

    // Add title for the visualization
    container
      .append("text")
      .attr("x", width / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("font-weight", "bold")
      .attr("fill", "#334155")
      .text("Web Browser - Browser History");

    // Add operation info
    if (operation) {
      const operationName =
        operation.operation || operation.operationName || "Unknown operation";

      container
        .append("text")
        .attr("x", width / 2)
        .attr("y", 55)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", "#4b5563")
        .text(
          `Operation: ${operationName}${
            operation.parameters
              ? " (" + JSON.stringify(operation.parameters) + ")"
              : ""
          }`
        );
    }

    // Add arrowhead definitions for connections
    const defs = container.append("defs");

    // Next pointer (blue)
    defs
      .append("marker")
      .attr("id", "next-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", styles.connection.nextColor);

    // Previous pointer (red)
    defs
      .append("marker")
      .attr("id", "prev-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", styles.connection.prevColor);

    // Current pointer (green)
    defs
      .append("marker")
      .attr("id", "current-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", styles.connection.currentColor);

    // 1. Render Local Variables Box
    const localVarsBox = container.append("g").attr("class", "local-variables");

    // Adjust height based on number of variables
    const localVarCount = Object.keys(localVariables).length;
    const localVarsHeight = Math.max(65, 25 + 5 + localVarCount * 30); // Header (25px) + small gap (5px) + variables
    styles.localVars.height = localVarsHeight;

    // Box container
    localVarsBox
      .append("rect")
      .attr("x", 50)
      .attr("y", 80)
      .attr("width", styles.localVars.width)
      .attr("height", styles.localVars.height)
      .attr("fill", "#ffffff")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1)
      .attr("rx", 5);

    // Title
    localVarsBox
      .append("rect")
      .attr("x", 50)
      .attr("y", 80)
      .attr("width", styles.localVars.width)
      .attr("height", 25)
      .attr("fill", "#94a3b8")
      .attr("fill-opacity", 0.3)
      .attr("stroke", "none")
      .attr("rx", 5)
      .attr("ry", 0);

    localVarsBox
      .append("text")
      .attr("x", 50 + styles.localVars.width / 2)
      .attr("y", 80 + 17)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("font-weight", "bold")
      .attr("fill", "#334155")
      .text("Local Variables");

    // Divider line
    localVarsBox
      .append("line")
      .attr("x1", 50)
      .attr("y1", 80 + 25)
      .attr("x2", 50 + styles.localVars.width)
      .attr("y2", 80 + 25)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1);

    // Variables
    let yOffset = 30; // Start below the header
    Object.entries(localVariables).forEach(([key, value]) => {
      // Add field container for local variables
      localVarsBox
        .append("rect")
        .attr("x", 50 + 10) // Same padding as page nodes (10px)
        .attr("y", 80 + yOffset)
        .attr("width", styles.localVars.width - 20)
        .attr("height", 25) // Same as page nodes
        .attr("fill", "white")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .attr("rx", 3);

      // Variable name (like "value:" in node boxes)
      localVarsBox
        .append("text")
        .attr("x", 50 + 20) // Same as page nodes
        .attr("y", 80 + yOffset + 17) // Center in the row like page nodes
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#334155")
        .text(key + ":");

      // Variable value (like the values in node boxes)
      localVarsBox
        .append("text")
        .attr("x", 50 + styles.localVars.width - 20) // Same as page nodes
        .attr("y", 80 + yOffset + 17) // Center in the row like page nodes
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#334155")
        .text(
          String(value).length > 10
            ? String(value).substring(0, 9) + "..."
            : value
        );

      yOffset += 30; // Same spacing as page nodes (node boxes use 30px spacing)
    });

    // 2. Render Instance Variables Box
    const instanceVarsBox = container
      .append("g")
      .attr("class", "instance-variables");

    // Adjust height based on number of variables
    const instanceVarCount = Object.keys(instanceVariables).length;
    const instanceVarsHeight = Math.max(65, 25 + 5 + instanceVarCount * 30); // Header (25px) + small gap (5px) + variables
    styles.instanceVars.height = instanceVarsHeight;

    // Box container
    instanceVarsBox
      .append("rect")
      .attr("x", width - 50 - styles.instanceVars.width)
      .attr("y", 80)
      .attr("width", styles.instanceVars.width)
      .attr("height", styles.instanceVars.height)
      .attr("fill", "#ffffff")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1)
      .attr("rx", 5);

    // Title
    instanceVarsBox
      .append("rect")
      .attr("x", width - 50 - styles.instanceVars.width)
      .attr("y", 80)
      .attr("width", styles.instanceVars.width)
      .attr("height", 25)
      .attr("fill", "#94a3b8")
      .attr("fill-opacity", 0.3)
      .attr("stroke", "none")
      .attr("rx", 5)
      .attr("ry", 0);

    instanceVarsBox
      .append("text")
      .attr("x", width - 50 - styles.instanceVars.width / 2)
      .attr("y", 80 + 17)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("font-weight", "bold")
      .attr("fill", "#334155")
      .text("Instance Variables");

    // Divider line
    instanceVarsBox
      .append("line")
      .attr("x1", width - 50 - styles.instanceVars.width)
      .attr("y1", 80 + 25)
      .attr("x2", width - 50)
      .attr("y2", 80 + 25)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1);

    // Variables
    yOffset = 30; // Start below the header
    Object.entries(instanceVariables).forEach(([key, value]) => {
      // Add field container for instance variables
      instanceVarsBox
        .append("rect")
        .attr("x", width - 50 - styles.instanceVars.width + 10) // Same padding as page nodes (10px)
        .attr("y", 80 + yOffset)
        .attr("width", styles.instanceVars.width - 20)
        .attr("height", 25) // Same as page nodes
        .attr("fill", "white")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .attr("rx", 3);

      // Variable name (like "value:" in node boxes)
      instanceVarsBox
        .append("text")
        .attr("x", width - 50 - styles.instanceVars.width + 20) // Same as page nodes
        .attr("y", 80 + yOffset + 17) // Center in the row like page nodes
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#334155")
        .text(key + ":");

      // Variable value (like the values in node boxes)
      instanceVarsBox
        .append("text")
        .attr("x", width - 70) // Same as page nodes
        .attr("y", 80 + yOffset + 17) // Center in the row like page nodes
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#334155")
        .text(
          String(value).length > 10
            ? String(value).substring(0, 9) + "..."
            : value
        );

      yOffset += 30; // Same spacing as page nodes (node boxes use 30px spacing)
    });

    // 3. Build page nodes layout information
    const pageNodes = [];
    const pagePositions = {};
    const connections = [];

    // Get all page nodes from address object map
    const addresses = Object.keys(addressObjectMap);

    // Helper to check if an address is valid
    const isValidAddress = (addr) =>
      addr && addr !== "null" && addr !== "0x0" && addr in addressObjectMap;

    // Find starting point (page with no previous)
    let startAddress = null;
    for (const addr of addresses) {
      const page = addressObjectMap[addr];
      if (!isValidAddress(page.previousAddress)) {
        startAddress = addr;
        break;
      }
    }

    // If no start found, just use the first address
    if (!startAddress && addresses.length > 0) {
      startAddress = addresses[0];
    }

    // Build the linked list of pages in order
    let currentAddr = startAddress;
    let xPos = width / 2 - styles.page.width / 2;
    let nextX = 100;

    while (isValidAddress(currentAddr)) {
      const page = addressObjectMap[currentAddr];
      const yCenter = height / 2;

      // Add to our nodes list
      pageNodes.push({
        address: currentAddr,
        value: page.value,
        previousAddress: page.previousAddress,
        nextAddress: page.nextAddress,
        isCurrent: currentAddr === currentPageAddress,
        x: nextX,
        y: yCenter - styles.page.height / 2,
      });

      // Save position for reference
      pagePositions[currentAddr] = {
        x: nextX,
        y: yCenter - styles.page.height / 2,
      };

      // Move to next page
      currentAddr = page.nextAddress;
      nextX += styles.page.width + 50;
    }

    // Center the pages horizontally if there's more than one
    if (pageNodes.length > 1) {
      const totalWidth =
        pageNodes.length * styles.page.width + (pageNodes.length - 1) * 50;
      const startX = (width - totalWidth) / 2;

      pageNodes.forEach((node, index) => {
        node.x = startX + index * (styles.page.width + 50);
        pagePositions[node.address] = {
          x: node.x,
          y: node.y,
        };
      });
    }

    // 4. Setup connections between nodes
    pageNodes.forEach((node) => {
      // Next connections
      if (isValidAddress(node.nextAddress)) {
        connections.push({
          source: node.address,
          target: node.nextAddress,
          type: "next",
        });
      }

      // Previous connections
      if (isValidAddress(node.previousAddress)) {
        connections.push({
          source: node.address,
          target: node.previousAddress,
          type: "prev",
        });
      }
    });

    // Current node connection from instance variable
    if (isValidAddress(currentPageAddress)) {
      connections.push({
        source: "current",
        target: currentPageAddress,
        type: "current",
        sourcePoint: {
          x: width - 50 - styles.instanceVars.width / 2,
          y: 80 + styles.instanceVars.height + 5,
        },
      });
    }

    // 5. Render all page nodes
    pageNodes.forEach((node) => {
      const pageGroup = container
        .append("g")
        .attr("class", "page-node")
        .attr("transform", `translate(${node.x}, ${node.y})`);

      // Increase height for better field separation
      const nodeHeight = 130; // More compact height

      // Page rectangle
      pageGroup
        .append("rect")
        .attr("width", styles.page.width)
        .attr("height", nodeHeight)
        .attr(
          "fill",
          node.isCurrent ? styles.page.currentFill : styles.page.fill
        )
        .attr(
          "stroke",
          node.isCurrent ? styles.page.currentStroke : styles.page.stroke
        )
        .attr("stroke-width", node.isCurrent ? 2 : 1)
        .attr("rx", 5);

      // Title section
      pageGroup
        .append("rect")
        .attr("width", styles.page.width)
        .attr("height", 25)
        .attr(
          "fill",
          node.isCurrent ? styles.page.currentStroke : styles.page.stroke
        )
        .attr("fill-opacity", 0.3)
        .attr("rx", 5)
        .attr("ry", 0);

      // Page title (short address)
      pageGroup
        .append("text")
        .attr("x", styles.page.width / 2)
        .attr("y", 17)
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .attr("font-weight", "bold")
        .attr("fill", styles.page.textColor)
        .text(
          node.address.substring(0, 8) + (node.isCurrent ? " (current)" : "")
        );

      // Divider line after title
      pageGroup
        .append("line")
        .attr("x1", 0)
        .attr("y1", 25)
        .attr("x2", styles.page.width)
        .attr("y2", 25)
        .attr("stroke", styles.page.stroke)
        .attr("stroke-width", 1);

      // Create fields section with vertical layout
      const fieldsGroup = pageGroup.append("g").attr("class", "fields");

      // Add value field
      fieldsGroup
        .append("rect")
        .attr("x", 10)
        .attr("y", 32)
        .attr("width", styles.page.width - 20)
        .attr("height", 25)
        .attr("fill", "none")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .attr("rx", 3);

      // Value label
      fieldsGroup
        .append("text")
        .attr("x", 20)
        .attr("y", 49)
        .attr("font-size", "13px")
        .attr("font-weight", "bold")
        .attr("fill", styles.page.textColor)
        .text("value:");

      // Page value
      fieldsGroup
        .append("text")
        .attr("x", styles.page.width - 20)
        .attr("y", 49)
        .attr("text-anchor", "end")
        .attr("font-size", "13px")
        .attr("font-weight", "bold")
        .attr("fill", styles.page.textColor)
        .text(node.value || "null");

      // Add previous field
      fieldsGroup
        .append("rect")
        .attr("x", 10)
        .attr("y", 62)
        .attr("width", styles.page.width - 20)
        .attr("height", 25)
        .attr("fill", "none")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .attr("rx", 3);

      // Previous address
      fieldsGroup
        .append("text")
        .attr("x", 20)
        .attr("y", 79)
        .attr("font-size", "13px")
        .attr("font-weight", "bold")
        .attr("fill", styles.page.textColor)
        .text("prev:");

      fieldsGroup
        .append("text")
        .attr("x", styles.page.width - 20)
        .attr("y", 79)
        .attr("text-anchor", "end")
        .attr("font-size", "13px")
        .attr("fill", styles.connection.prevColor)
        .attr("font-weight", "bold")
        .text(node.previousAddress?.substring(0, 8) || "null");

      // Add next field
      fieldsGroup
        .append("rect")
        .attr("x", 10)
        .attr("y", 92)
        .attr("width", styles.page.width - 20)
        .attr("height", 25)
        .attr("fill", "none")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .attr("rx", 3);

      // Next address
      fieldsGroup
        .append("text")
        .attr("x", 20)
        .attr("y", 109)
        .attr("font-size", "13px")
        .attr("font-weight", "bold")
        .attr("fill", styles.page.textColor)
        .text("next:");

      fieldsGroup
        .append("text")
        .attr("x", styles.page.width - 20)
        .attr("y", 109)
        .attr("text-anchor", "end")
        .attr("font-size", "13px")
        .attr("fill", styles.connection.nextColor)
        .attr("font-weight", "bold")
        .text(node.nextAddress?.substring(0, 8) || "null");

      // Update node height in our positions record for connection calculations
      pagePositions[node.address] = {
        x: node.x,
        y: node.y,
        width: styles.page.width,
        height: nodeHeight,
      };
    });

    // 6. Render Address Object Map Box
    // Only if there's space at the bottom and not too many pages
    if (pageNodes.length <= 5) {
      const addressMapBox = container
        .append("g")
        .attr("class", "address-object-map");

      const mapBoxY = height - 120;
      const mapBoxHeight = 160;
      const mapBoxWidth = width - 100;

      // Box container
      addressMapBox
        .append("rect")
        .attr("x", 50)
        .attr("y", mapBoxY)
        .attr("width", mapBoxWidth)
        .attr("height", mapBoxHeight)
        .attr("fill", "#f8fafc")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1)
        .attr("rx", 5);

      // Title
      addressMapBox
        .append("rect")
        .attr("x", 50)
        .attr("y", mapBoxY)
        .attr("width", mapBoxWidth)
        .attr("height", 30)
        .attr("fill", "#94a3b8")
        .attr("fill-opacity", 0.3)
        .attr("stroke", "none")
        .attr("rx", 5)
        .attr("ry", 0);

      addressMapBox
        .append("text")
        .attr("x", 50 + mapBoxWidth / 2)
        .attr("y", mapBoxY + 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "#475569")
        .text("Address Object Map");

      // Address entries
      const entryWidth = 180;
      const entriesPerRow = Math.floor(mapBoxWidth / entryWidth);

      addresses.forEach((address, index) => {
        const row = Math.floor(index / entriesPerRow);
        const col = index % entriesPerRow;

        const entryX = 50 + col * entryWidth + 10;
        const entryY = mapBoxY + 40 + row * 40;

        // Address
        addressMapBox
          .append("text")
          .attr("x", entryX)
          .attr("y", entryY)
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .attr("fill", "#475569")
          .text(address.substring(0, 8) + ":");

        // Value
        const value = addressObjectMap[address]?.value;
        addressMapBox
          .append("text")
          .attr("x", entryX + 80)
          .attr("y", entryY)
          .attr("font-size", "12px")
          .attr("fill", "#475569")
          .text(value || "null");
      });
    }

    // 7. Render connections between nodes
    const connectionsGroup = container.append("g").attr("class", "connections");

    connections.forEach((conn) => {
      let sourcePoint, targetPoint;

      // Special case for 'current' source
      if (conn.source === "current") {
        sourcePoint = conn.sourcePoint;
      } else {
        const sourcePos = pagePositions[conn.source];
        if (!sourcePos) return;

        sourcePoint = {
          x: sourcePos.x + styles.page.width / 2,
          y: sourcePos.y + styles.page.height / 2,
        };
      }

      const targetPos = pagePositions[conn.target];
      if (!targetPos) return;

      targetPoint = {
        x: targetPos.x + styles.page.width / 2,
        y: targetPos.y + styles.page.height / 2,
      };

      // Adjust source and target points based on connection type
      if (conn.type === "next") {
        sourcePoint.x = sourcePoint.x + styles.page.width / 2;
        targetPoint.x = targetPoint.x - styles.page.width / 2;
      } else if (conn.type === "prev") {
        sourcePoint.x = sourcePoint.x - styles.page.width / 2;
        targetPoint.x = targetPoint.x + styles.page.width / 2;
      }

      // Generate curved path
      const path = generateCurvedPath(sourcePoint, targetPoint);

      // Determine color and marker based on connection type
      let color, marker;
      switch (conn.type) {
        case "next":
          color = styles.connection.nextColor;
          marker = "url(#next-arrow)";
          break;
        case "prev":
          color = styles.connection.prevColor;
          marker = "url(#prev-arrow)";
          break;
        case "current":
          color = styles.connection.currentColor;
          marker = "url(#current-arrow)";
          break;
        default:
          color = styles.connection.stroke;
          marker = null;
      }

      // Draw path
      connectionsGroup
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", styles.connection.width)
        .attr("marker-end", marker)
        .attr("opacity", 0.8);

      // Add label if needed
      if (conn.label) {
        const pathNode = connectionsGroup.select("path").node();
        if (pathNode) {
          const pathLength = pathNode.getTotalLength();
          const midPoint = pathNode.getPointAtLength(pathLength / 2);

          connectionsGroup
            .append("text")
            .attr("x", midPoint.x)
            .attr("y", midPoint.y - 5)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", color)
            .text(conn.label);
        }
      }
    });
  };

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

  // Direct zoom controls that manipulate both the zoom behavior and content group
  const zoomIn = () => {
    console.log("Zoom in clicked");

    if (svgRef.current && zoomRef.current) {
      try {
        // Directly use D3's scaleBy with a simple approach
        const svg = d3.select(svgRef.current);
        svg.call(zoomRef.current.scaleBy, 1.3);
        console.log("Zoom in applied");
      } catch (error) {
        console.error("Error during zoom in:", error);
      }
    }
  };

  const zoomOut = () => {
    console.log("Zoom out clicked");

    if (svgRef.current && zoomRef.current) {
      try {
        // Directly use D3's scaleBy with a simple approach
        const svg = d3.select(svgRef.current);
        svg.call(zoomRef.current.scaleBy, 0.7);
        console.log("Zoom out applied");
      } catch (error) {
        console.error("Error during zoom out:", error);
      }
    }
  };

  const resetZoom = () => {
    console.log("Reset zoom clicked");

    if (svgRef.current && zoomRef.current) {
      try {
        // Directly reset to identity transform
        const svg = d3.select(svgRef.current);
        svg.call(zoomRef.current.transform, d3.zoomIdentity);
        console.log("Zoom reset applied");
      } catch (error) {
        console.error("Error during zoom reset:", error);
      }
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
              <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h2 className="text-md font-bold">Visualization</h2>
                {/* Zoom Controls */}
                <div className="flex space-x-1">
                  <div className="text-xs mr-2 text-gray-600">
                    Zoom: {(zoomLevel * 100).toFixed(0)}%
                  </div>
                  <button
                    onClick={zoomIn}
                    className="p-1 rounded hover:bg-gray-200 text-gray-700"
                    title="Zoom In"
                  >
                    <ZoomInIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={zoomOut}
                    className="p-1 rounded hover:bg-gray-200 text-gray-700"
                    title="Zoom Out"
                  >
                    <ZoomOutIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={resetZoom}
                    className="p-1 rounded hover:bg-gray-200 text-gray-700"
                    title="Reset Zoom"
                  >
                    <RefreshCwIcon className="w-4 h-4" />
                  </button>
                  <div
                    className="p-1 rounded text-gray-700 flex items-center cursor-pointer"
                    title="Pan by dragging the visualization"
                  >
                    <MoveIcon className="w-4 h-4" />
                    <span className="text-xs ml-1">Pan</span>
                  </div>
                </div>
              </div>

              <div
                className="flex-1 overflow-hidden relative"
                style={{ minHeight: "500px" }}
                ref={visualizationContainerRef}
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

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
  // Add a forceRender state to help with UI updates
  const [forceRender, setForceRender] = useState(0);

  // Create completely separate visualization state
  const [visualState, setVisualState] = useState({
    operationIndex: null,
    snapshotIndex: null,
    operation: null,
    snapshot: null,
  });

  const svgRef = useRef(null);
  const autoPlayRef = useRef(null);
  const zoomRef = useRef(null);
  const visualizationContainerRef = useRef(null);
  // Add refs to track the selected operation and snapshot
  const selectedOperationRef = useRef(null);
  const selectedSnapshotRef = useRef(null);

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

  // Find and modify the renderVisualization function to properly handle operation selection
  const renderVisualization = useCallback(
    (directOperation = null, directSnapshot = null) => {
      console.log(
        "Starting renderVisualization with forceRender:",
        forceRender
      );
      console.log("Direct operation:", directOperation);
      console.log("Direct snapshot:", directSnapshot);

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

      // Initialize zoom on the SVG
      svg.call(zoom);

      // Reset zoom to initial position
      svg.call(zoom.transform, d3.zoomIdentity);

      // Determine which operation to render:
      // 1. If provided directly as parameter, use that
      // 2. Otherwise use current state
      let operation;
      let memorySnapshot = null;

      // Priority 1: Use direct parameters if provided
      if (directOperation) {
        operation = directOperation;
        memorySnapshot = directSnapshot;
        console.log("Using directly provided operation and snapshot");
      }
      // Priority 2: Use current state
      else if (
        currentHistoryIndex >= 0 &&
        currentHistoryIndex < operations.length
      ) {
        operation = operations[currentHistoryIndex];
        console.log(
          `Rendering operation ${currentHistoryIndex + 1}/${operations.length}`
        );

        // Always use the memory snapshot if we're in snapshot mode and it's available
        if (
          snapshotMode &&
          operation.memorySnapshots &&
          operation.memorySnapshots.length > 0
        ) {
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
        }
      } else {
        console.error("No valid operation to render");
        return;
      }

      if (
        !memorySnapshot &&
        operation.memorySnapshots &&
        operation.memorySnapshots.length > 0
      ) {
        // No memory snapshot specified yet, default to the last one
        memorySnapshot =
          operation.memorySnapshots[operation.memorySnapshots.length - 1];
        console.log("Defaulting to last snapshot for operation");
      } else if (!memorySnapshot) {
        console.log(
          `No memory snapshots available for operation ${
            operation.operationName || operation.operation
          }`
        );
      }

      console.log("Memory Snapshot for rendering:", memorySnapshot);

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

          // Auto-fit the visualization after rendering
          autoFitVisualization(svg, contentGroup, zoom, width, height);
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
          console.log(
            "Rendering WEB_BROWSER visualization with memory snapshot"
          );
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
              renderHashMapVisualization(
                svg,
                width,
                height,
                effectiveOperation
              );
              break;
            default:
              renderDefaultVisualization(
                svg,
                width,
                height,
                effectiveOperation
              );
          }
        }

        // Auto-fit visualization after rendering
        autoFitVisualization(svg, contentGroup, zoom, width, height);
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
    },
    [
      dataStructure,
      currentHistoryIndex,
      currentSnapshotIndex,
      enableMemoryVisualization,
      snapshotMode,
      forceRender, // Add dependency on forceRender
    ]
  );

  // Add a new function to automatically fit the visualization to the view
  const autoFitVisualization = (
    svg,
    contentGroup,
    zoom,
    viewWidth,
    viewHeight
  ) => {
    try {
      // Give the browser a moment to render the SVG content
      setTimeout(() => {
        // Get the bounding box of all content in the content group
        const contentNode = contentGroup.node();
        if (!contentNode) return;

        // Check if we have any content to fit
        if (contentNode.children.length === 0) return;

        // Get the bounding box of the content
        const contentBBox = contentNode.getBBox();

        // Add some padding
        const padding = 40;
        const paddedWidth = contentBBox.width + padding * 2;
        const paddedHeight = contentBBox.height + padding * 2;

        // Calculate the scale to fit the content
        const scaleX = viewWidth / paddedWidth;
        const scaleY = viewHeight / paddedHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in past 1

        // Calculate the translation to center the content
        const translateX =
          (viewWidth - contentBBox.width * scale) / 2 - contentBBox.x * scale;
        const translateY =
          (viewHeight - contentBBox.height * scale) / 2 - contentBBox.y * scale;

        // Apply the transform
        console.log("Auto-fitting visualization:", {
          contentBBox,
          scale,
          translateX,
          translateY,
        });

        svg
          .transition()
          .duration(500)
          .call(
            zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
          );
      }, 100); // Short delay to ensure the DOM has rendered
    } catch (error) {
      console.error("Error in autoFitVisualization:", error);
    }
  };

  // Helper to generate curved path between two points
  const generateCurvedPath = (source, target) => {
    // Calculate the vector between points
    const dx = target.x - source.x;
    const dy = target.y - source.y;

    // Determine if connection is horizontal/vertical/diagonal
    const isMainlyHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
    const isMainlyVertical = Math.abs(dy) > Math.abs(dx) * 1.5;

    // Base control point distance - make more subtle curves
    const distanceTotal = Math.sqrt(dx * dx + dy * dy);
    const controlDistance = Math.min(distanceTotal * 0.4, 80);

    // Calculate control points based on direction and orientation
    let cp1x, cp1y, cp2x, cp2y;

    if (isMainlyHorizontal) {
      // For horizontal connections (left-to-right or right-to-left)
      cp1x = source.x + Math.sign(dx) * controlDistance;
      cp1y = source.y;
      cp2x = target.x - Math.sign(dx) * controlDistance;
      cp2y = target.y;
    } else if (isMainlyVertical) {
      // For vertical connections (top-to-bottom or bottom-to-top)
      cp1x = source.x;
      cp1y = source.y + Math.sign(dy) * controlDistance;
      cp2x = target.x;
      cp2y = target.y - Math.sign(dy) * controlDistance;
    } else {
      // For diagonal connections, create a more gentle curve
      // Use an offset to create more space between arrows
      cp1x = source.x + Math.sign(dx) * controlDistance;
      cp1y = source.y + Math.sign(dy) * controlDistance * 0.3;
      cp2x = target.x - Math.sign(dx) * controlDistance;
      cp2y = target.y - Math.sign(dy) * controlDistance * 0.3;
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
    const processedAddresses = new Set();
    const nodesToProcess = [];

    // First try to find a node with no previous that has a next (real start of a chain)
    for (const addr of addresses) {
      const page = addressObjectMap[addr];
      if (
        !isValidAddress(page.previousAddress) &&
        isValidAddress(page.nextAddress)
      ) {
        startAddress = addr;
        break;
      }
    }

    // If no proper chain start found, then any node with no previous
    if (!startAddress) {
      for (const addr of addresses) {
        const page = addressObjectMap[addr];
        if (!isValidAddress(page.previousAddress)) {
          startAddress = addr;
          break;
        }
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

    // First process the main chain
    while (
      isValidAddress(currentAddr) &&
      !processedAddresses.has(currentAddr)
    ) {
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

      // Mark as processed
      processedAddresses.add(currentAddr);

      // Move to next page
      currentAddr = page.nextAddress;
      nextX += styles.page.width + 50;
    }

    // Now process any isolated nodes that weren't part of the main chain
    let isolatedNodeX = nextX;
    const isolatedNodeY = height / 2 + 150; // Place isolated nodes below the main chain
    let hasIsolatedNodes = false;

    addresses.forEach((addr) => {
      if (!processedAddresses.has(addr)) {
        hasIsolatedNodes = true;
        const page = addressObjectMap[addr];

        // Add isolated node to pageNodes
        pageNodes.push({
          address: addr,
          value: page.value,
          previousAddress: page.previousAddress,
          nextAddress: page.nextAddress,
          isCurrent: addr === currentPageAddress,
          x: isolatedNodeX,
          y: isolatedNodeY,
          isIsolated: true, // Mark as isolated for visual distinction
        });

        // Save position
        pagePositions[addr] = {
          x: isolatedNodeX,
          y: isolatedNodeY,
          width: styles.page.width,
          height: 130,
        };

        // Mark as processed
        processedAddresses.add(addr);

        // Move to next position
        isolatedNodeX += styles.page.width + 50;
      }
    });

    // Add helper text when isolated nodes are present
    // if (hasIsolatedNodes) {
    //   container
    //     .append("text")
    //     .attr("x", width / 2)
    //     .attr("y", height / 2 + 130)
    //     .attr("text-anchor", "middle")
    //     .attr("font-size", "13px")
    //     .attr("fill", "#9c5805")
    //     .attr("font-weight", "bold")
    //     .text("Isolated Nodes (not yet connected to main chain):");
    // }

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
          y: 80 + styles.instanceVars.height, // Remove the gap of 5px
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
          node.isCurrent
            ? styles.page.currentFill
            : node.isIsolated
            ? "#fcf5e5"
            : styles.page.fill // Light yellow for isolated nodes
        )
        .attr(
          "stroke",
          node.isCurrent
            ? styles.page.currentStroke
            : node.isIsolated
            ? "#eab308"
            : styles.page.stroke // Amber for isolated nodes
        )
        .attr("stroke-width", node.isCurrent ? 2 : node.isIsolated ? 2 : 1)
        .attr("stroke-dasharray", node.isIsolated ? "5,5" : "none") // Dashed border for isolated
        .attr("rx", 5);

      // Title section background
      pageGroup
        .append("rect")
        .attr("width", styles.page.width)
        .attr("height", 25)
        .attr(
          "fill",
          node.isCurrent
            ? styles.page.currentStroke
            : node.isIsolated
            ? "#eab308"
            : styles.page.stroke
        )
        .attr("fill-opacity", node.isIsolated ? 0.2 : 0.3)
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
    if (false) {
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

    // Helper function to determine the best exit/entry points for arrows
    const getConnectionPoints = (sourceNode, targetNode, connectionType) => {
      const source = pagePositions[sourceNode];
      const target = pagePositions[targetNode];

      if (!source || !target) {
        return { sourcePoint: null, targetPoint: null };
      }

      // Determine if nodes are in same row or column
      const isHorizontal = Math.abs(source.y - target.y) < 50;
      const isVertical = Math.abs(source.x - target.x) < 50;
      const isLeftToRight = source.x < target.x;
      const isTopToBottom = source.y < target.y;

      let sourcePoint, targetPoint;

      // Calculate edge points based on connection type and relative positions
      if (connectionType === "next") {
        // For next pointers - prefer right-to-left connections
        if (isLeftToRight) {
          // Source at right edge of "next" field
          sourcePoint = {
            x: source.x + styles.page.width,
            y: source.y + 100, // Near the next field
          };
          // Target at left edge
          targetPoint = {
            x: target.x,
            y: target.y + 25, // Top section of target
          };
        } else {
          // If target is to the left, exit from bottom
          sourcePoint = {
            x: source.x + styles.page.width - 50,
            y: source.y + styles.page.height,
          };
          // Enter from bottom right
          targetPoint = {
            x: target.x + styles.page.width - 50,
            y: target.y + styles.page.height,
          };
        }
      } else if (connectionType === "prev") {
        // For prev pointers - similar to next pointers but reversed direction
        if (!isLeftToRight) {
          // Source at left edge of "prev" field
          sourcePoint = {
            x: source.x,
            y: source.y + 70, // Near the prev field
          };
          // Target at right edge, at the header/address section
          targetPoint = {
            x: target.x + styles.page.width,
            y: target.y + 12, // Target the header/address area
          };
        } else {
          // If target is to the right, use different exit/entry points
          sourcePoint = {
            x: source.x,
            y: source.y + 70, // Near the prev field
          };
          // Enter at address/header section from left
          targetPoint = {
            x: target.x,
            y: target.y + 12, // Target the header/address area
          };
        }
      } else {
        // Default - connect centers
        sourcePoint = {
          x: source.x + styles.page.width / 2,
          y: source.y + styles.page.height / 2,
        };
        targetPoint = {
          x: target.x + styles.page.width / 2,
          y: target.y + styles.page.height / 2,
        };
      }

      return { sourcePoint, targetPoint };
    };

    connections.forEach((conn) => {
      let sourcePoint, targetPoint;

      // Special case for 'current' source
      if (conn.source === "current") {
        sourcePoint = conn.sourcePoint;

        // Get target position
        const targetPos = pagePositions[conn.target];
        if (!targetPos) return;

        // Current pointer should connect to the top of the box
        targetPoint = {
          x: targetPos.x + styles.page.width / 2,
          y: targetPos.y + 0.5, // Adjust to eliminate any gap - connect directly to the box
        };
      } else {
        // Use the helper function to get optimal connection points
        const points = getConnectionPoints(conn.source, conn.target, conn.type);
        if (!points.sourcePoint || !points.targetPoint) return;

        sourcePoint = points.sourcePoint;
        targetPoint = points.targetPoint;
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
        .attr("stroke-opacity", 0.8)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

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
    // Only operate in snapshot mode and only within the current operation
    if (
      snapshotMode &&
      operations[currentHistoryIndex]?.memorySnapshots?.length > 0
    ) {
      setCurrentSnapshotIndex(0);
    }
  };

  const goToLast = () => {
    // Only operate in snapshot mode and only within the current operation
    if (
      snapshotMode &&
      operations[currentHistoryIndex]?.memorySnapshots?.length > 0
    ) {
      setCurrentSnapshotIndex(
        operations[currentHistoryIndex].memorySnapshots.length - 1
      );
    }
  };

  const goToPrevious = () => {
    // Only operate in snapshot mode and only within the current operation
    if (snapshotMode && currentSnapshotIndex > 0) {
      setCurrentSnapshotIndex(currentSnapshotIndex - 1);
    }
  };

  const goToNext = () => {
    // Only operate in snapshot mode and only within the current operation
    if (snapshotMode) {
      const maxSnapshot =
        operations[currentHistoryIndex]?.memorySnapshots?.length - 1;
      if (currentSnapshotIndex < maxSnapshot) {
        setCurrentSnapshotIndex(currentSnapshotIndex + 1);
      }
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

  // Modify the selectOperation function to be more robust
  const selectOperation = (index) => {
    if (index < 0 || index >= operations.length) {
      return;
    }

    try {
      // Get the operation
      const operation = operations[index];

      // If operation has snapshots, get the last one
      let snapshotIndex = -1;
      let snapshot = null;
      if (operation.memorySnapshots && operation.memorySnapshots.length > 0) {
        snapshotIndex = operation.memorySnapshots.length - 1;
        snapshot = operation.memorySnapshots[snapshotIndex];
      }

      // Clear the existing visualization
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll("*").remove();
      }

      // Save selected operation and snapshot in refs for direct access
      selectedOperationRef.current = operation;
      selectedSnapshotRef.current = snapshot;

      // Update state in one go
      setCurrentHistoryIndex(index);
      setCurrentSnapshotIndex(snapshotIndex);
      setSnapshotMode(snapshotIndex >= 0);

      // Update visualState to keep track of the selected operation and snapshot
      setVisualState((prev) => ({
        ...prev,
        operationIndex: index,
        snapshotIndex: snapshotIndex,
        operation: operation,
        snapshot: snapshot,
      }));

      // Force render
      setTimeout(() => {
        if (snapshotIndex >= 0) {
          renderVisualization(operation, snapshot);
        } else {
          renderVisualization(operation, null);
        }
      }, 50);
    } catch (error) {
      console.error("Error in selectOperation:", error);
    }
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

  // Add a specific useEffect to handle snapshot index updates
  useEffect(() => {
    if (dataStructure && operations.length > 0) {
      // This effect will run when snapshotIndex changes
      renderVisualization();
    }
  }, [dataStructure, currentSnapshotIndex, renderVisualization, operations]);

  // Add a new function to force render with specific operation and snapshot
  const forceRenderWithOperation = (operationIndex, snapshotIndex) => {
    try {
      if (
        operationIndex < 0 ||
        operationIndex >= operations.length ||
        !operations[operationIndex]
      ) {
        console.error(`Invalid operation index: ${operationIndex}`);
        return;
      }

      const operation = operations[operationIndex];

      // Always completely clear the DOM first
      const visualizationContainer = d3.select("#visualization-container");
      visualizationContainer.selectAll("*").remove();

      // Set a timeout to ensure DOM is ready
      setTimeout(() => {
        // Determine if we should use a snapshot or the operation state
        if (
          snapshotIndex >= 0 &&
          operation.memorySnapshots &&
          snapshotIndex < operation.memorySnapshots.length
        ) {
          const snapshot = operation.memorySnapshots[snapshotIndex];
          console.log(`Rendering with snapshot at index ${snapshotIndex}`);

          // Render the visualization with the operation and snapshot
          renderVisualization(operation, snapshot);

          // Update state for consistency (but rendering is already done)
          setCurrentHistoryIndex(operationIndex);
          setCurrentSnapshotIndex(snapshotIndex);
          setSnapshotMode(true);
        } else {
          console.log("Rendering with operation state (no snapshot)");

          // Render the visualization with the operation alone
          renderVisualization(operation, null);

          // Update state for consistency (but rendering is already done)
          setCurrentHistoryIndex(operationIndex);
          setCurrentSnapshotIndex(-1);
          setSnapshotMode(false);
        }
      }, 50);
    } catch (error) {
      console.error("Error in forceRenderWithOperation:", error);
    }
  };

  // Create a separate render function specifically for clicked operations
  const renderSelectedOperation = useCallback(() => {
    console.log("Rendering selected operation:", visualState);
    if (!visualState.operation || !visualState.snapshot) {
      console.log("No visualization state set");
      return;
    }

    if (!svgRef.current) {
      console.error("SVG reference is not available");
      return;
    }

    // Clear existing visualization
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    console.log("Cleared previous visualization for direct rendering");

    const width = parseInt(svg.style("width")) || 800;
    const height = parseInt(svg.style("height")) || 600;

    // Create background and content layers
    const backgroundLayer = svg.append("g").attr("class", "fixed-background");
    backgroundLayer
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#f8fafc")
      .attr("stroke", "#d1d5db");

    const contentGroup = svg.append("g").attr("class", "zoom-container");

    // Set up zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 5])
      .translateExtent([
        [-width * 3, -height * 3],
        [width * 3, height * 3],
      ])
      .on("zoom", (event) => {
        contentGroup.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    zoomRef.current = zoom;
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity);

    console.log("Direct rendering operation:", visualState.operation);
    console.log("Direct rendering snapshot:", visualState.snapshot);

    try {
      const structureType = (dataStructure.type || "").toUpperCase();

      // Create an effective operation with the snapshot data
      const effectiveOperation = { ...visualState.operation };
      const memorySnapshot = visualState.snapshot;

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

      // Special case for web browser visualization
      if (structureType === "WEB_BROWSER") {
        console.log("Direct rendering WEB_BROWSER visualization");
        renderWebBrowserVisualization(
          contentGroup,
          width,
          height,
          effectiveOperation,
          memorySnapshot
        );

        // Auto-fit the visualization
        autoFitVisualization(svg, contentGroup, zoom, width, height);
        return;
      }

      // For other data structures
      if (enableMemoryVisualization) {
        console.log("Direct rendering using memory visualization");
        renderMemoryVisualization(effectiveOperation, svgRef);
      } else {
        switch (structureType) {
          case "VECTOR":
            console.log("Direct rendering array visualization");
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

      // Auto-fit the visualization
      autoFitVisualization(svg, contentGroup, zoom, width, height);
    } catch (error) {
      console.error("Error in renderSelectedOperation:", error);

      // Show error message
      const contentGroup = svg.append("g");
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
  }, [visualState, dataStructure, enableMemoryVisualization]);

  // Effect to render selected operation when visual state changes
  useEffect(() => {
    if (visualState.operation && visualState.snapshot) {
      renderSelectedOperation();
    }
  }, [visualState, renderSelectedOperation]);

  // Add a standalone function to render a specific operation and snapshot directly
  const renderSpecificOperationDirectly = (operationObj, snapshotObj) => {
    console.log("Direct rendering operation:", operationObj);
    console.log("With snapshot:", snapshotObj);

    try {
      // First select the visualization SVG and clear it
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      // Force a slight delay to ensure DOM updates have completed
      setTimeout(() => {
        // Use our improved renderVisualization function with direct params
        renderVisualization(operationObj, snapshotObj);
        console.log("Direct visualization completed using renderVisualization");
      }, 50); // Small delay to ensure DOM is ready
    } catch (error) {
      console.error("Error rendering visualization directly:", error);
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
                            <div
                              key={originalIndex}
                              className={`w-full text-left py-2 px-1 text-xs ${
                                originalIndex === currentHistoryIndex
                                  ? "bg-blue-100 font-bold"
                                  : "hover:bg-blue-50"
                              }`}
                              onClick={() => selectOperation(originalIndex)}
                              style={{ cursor: "pointer" }}
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
                            </div>
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
                        disabled={
                          !snapshotMode ||
                          !operations[currentHistoryIndex]?.memorySnapshots
                            ?.length ||
                          currentSnapshotIndex === 0
                        }
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
                        disabled={
                          !snapshotMode ||
                          !operations[currentHistoryIndex]?.memorySnapshots
                            ?.length ||
                          currentSnapshotIndex === 0
                        }
                        className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                        title="Previous Snapshot"
                      >
                        <ChevronLeftIcon className="w-4 h-4" />
                      </button>

                      <button
                        onClick={toggleAutoPlay}
                        disabled={
                          !operations[currentHistoryIndex]?.memorySnapshots
                            ?.length ||
                          operations[currentHistoryIndex]?.memorySnapshots
                            ?.length <= 1
                        }
                        className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
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
                          !snapshotMode ||
                          !operations[currentHistoryIndex]?.memorySnapshots
                            ?.length ||
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
                          !snapshotMode ||
                          !operations[currentHistoryIndex]?.memorySnapshots
                            ?.length ||
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

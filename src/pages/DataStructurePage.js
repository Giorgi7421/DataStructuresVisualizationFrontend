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
    useState(false);
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

  // Helper function to truncate addresses for display
  const truncateAddress = (address, length = 6) => {
    if (!address) return "null";
    const stringAddress = String(address);
    if (isAddress(stringAddress)) {
      return `${stringAddress.substring(0, 2 + length)}...`;
    }
    // If it's not a typical address (e.g. could be "null", a number, or other string)
    // show a bit more if it's short, or truncate if long
    if (stringAddress.length > 10) {
      return `${stringAddress.substring(0, 8)}...`;
    }
    return stringAddress;
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

      // Get the SVG element
      const svg = d3.select(svgRef.current);

      // Clear existing visualization
      svg.selectAll("*").remove();
      console.log("Cleared previous visualization");

      // Get dimensions from parent container, or use defaults
      const parentContainer = svg.node().parentElement;
      const width = parentContainer ? parentContainer.clientWidth : 800;
      const height = parentContainer ? parentContainer.clientHeight : 600;
      svg.attr("width", width).attr("height", height); // Ensure SVG has dimensions

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
      let operation;
      let memorySnapshot = null;

      if (directOperation) {
        operation = directOperation;
        memorySnapshot = directSnapshot;
        console.log("Using directly provided operation and snapshot");
      } else if (
        currentHistoryIndex >= 0 &&
        currentHistoryIndex < operations.length
      ) {
        operation = operations[currentHistoryIndex];
        console.log(
          `Rendering operation ${currentHistoryIndex + 1}/${operations.length}`
        );

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
        contentGroup
          .append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .text("No operation selected to visualize");
        return;
      }

      if (
        !memorySnapshot &&
        operation && // Ensure operation is defined
        operation.memorySnapshots &&
        operation.memorySnapshots.length > 0
      ) {
        memorySnapshot =
          operation.memorySnapshots[operation.memorySnapshots.length - 1];
        console.log("Defaulting to last snapshot for operation");
      } else if (!memorySnapshot && operation) {
        // Ensure operation is defined
        console.log(
          `No memory snapshots available for operation ${
            operation.operationName || operation.operation
          }`
        );
      }

      console.log("Memory Snapshot for rendering:", memorySnapshot);

      try {
        const structureType = (dataStructure.type || "").toUpperCase();
        let effectiveOperation = operation ? { ...operation } : null;

        if (!effectiveOperation) {
          console.error("Effective operation is null, cannot render.");
          contentGroup
            .append("text")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .text("Cannot determine operation to render.");
          return;
        }

        // If a memory snapshot exists, use its data to override the operation's state.
        // Otherwise, the visualization will use the base operation.state if available.
        if (memorySnapshot) {
          effectiveOperation.state = {
            ...(effectiveOperation.state || {}), // Preserve existing state if any
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
            "Effective operation state (from snapshot) for rendering:",
            effectiveOperation.state
          );
        } else if (effectiveOperation.state) {
          console.log(
            "Effective operation state (from operation) for rendering:",
            effectiveOperation.state
          );
        } else {
          console.log(
            "No snapshot and no base state in operation. Visualization might be empty or show an error."
          );
          contentGroup
            .append("text")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .text(
              "No data available to visualize for this operation/snapshot."
            );
          // Potentially return here or let individual renderers handle it
        }

        if (enableMemoryVisualization) {
          console.log("Using memory visualization");
          // Assuming renderMemoryVisualization is also refactored to use contentGroup
          renderMemoryVisualization(
            effectiveOperation,
            contentGroup,
            width,
            height,
            memorySnapshot
          );
        } else {
          const type = (dataStructure.type || "").toUpperCase();
          const impl = (dataStructure.implementation || "").toUpperCase();
          let combinedType;

          if (impl && impl !== "NULL" && impl !== "") {
            combinedType = `${impl}_${type}`;
          } else {
            combinedType = type;
          }
          console.log("Combined structure type for switch:", combinedType);

          switch (combinedType) {
            case "WEB_BROWSER":
              console.log("Rendering WEB_BROWSER visualization");
              renderWebBrowserVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot
              );
              break;
            case "ARRAY_VECTOR":
              console.log("Using array visualization for ARRAY_VECTOR");
              renderArrayVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot
              );
              break;
            case "LINKED_LIST_VECTOR":
              console.log(
                "Using linked list visualization for LINKED_LIST_VECTOR (stub)"
              );
              renderLinkedListVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot
              );
              break;

            // Cases for which we show "not implemented"
            case "ARRAY_STACK":
            case "LINKED_LIST_STACK":
            case "TWO_QUEUE_STACK":
            case "ARRAY_QUEUE":
            case "LINKED_LIST_QUEUE":
            case "ARRAY_MAP":
            case "HASH_MAP":
            case "TREE_MAP":
            case "GRID":
            case "DEQUEUE":
            case "BS_TREE":
            case "AVL_TREE":
            case "EXPRESSION_TREE":
            case "HASH_SET":
            case "TREE_SET":
            case "SMALL_INT_SET":
            case "MOVE_TO_FRONT_SET":
            case "UNSORTED_VECTOR_PRIORITY_QUEUE":
            case "SORTED_LINKED_LIST_PRIORITY_QUEUE":
            case "UNSORTED_DOUBLY_LINKED_LIST_PRIORITY_QUEUE":
            case "BINARY_HEAP_PRIORITY_QUEUE":
            case "BIG_INTEGER":
            case "FILE_SYSTEM":
            case "ARRAY_EDITOR_BUFFER":
            case "TWO_STACK_EDITOR_BUFFER":
            case "LINKED_LIST_EDITOR_BUFFER":
            case "DOUBLY_LINKED_LIST_EDITOR_BUFFER":
              console.log(
                `No specific implementation for ${combinedType}, showing message.`
              );
              showNotImplementedMessage(
                contentGroup,
                width,
                height,
                combinedType
              );
              break;

            default:
              console.log(
                `Default: No specific implementation for ${combinedType}, showing message.`
              );
              showNotImplementedMessage(
                contentGroup,
                width,
                height,
                combinedType
              );
          }
        }
        // Auto-fit visualization after rendering completes
        autoFitVisualization(svg, contentGroup, zoom, width, height);
      } catch (error) {
        console.error("Error in renderVisualization:", error);
        contentGroup.selectAll("*").remove(); // Clear potentially broken content
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
      operations, // Added operations as a dependency
      currentHistoryIndex,
      currentSnapshotIndex,
      enableMemoryVisualization,
      snapshotMode,
      forceRender,
      // Removed extractElementsFromSnapshot from here, it's used internally
      // Removed specific render functions from here, they are called internally
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
  const generateCurvedPath = (
    source,
    target,
    pathType = "default",
    curveFactor = 0.4
  ) => {
    // Calculate the vector between points
    const dx = target.x - source.x;
    const dy = target.y - source.y;

    // Determine if connection is horizontal/vertical/diagonal for default behavior
    const isMainlyHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
    const isMainlyVertical = Math.abs(dy) > Math.abs(dx) * 1.5;

    const distanceTotal = Math.sqrt(dx * dx + dy * dy);
    let controlDistance = Math.min(distanceTotal * curveFactor, 80); // Use curveFactor

    let cp1x, cp1y, cp2x, cp2y;

    if (pathType === "longArcDown") {
      // Force a path that arcs downwards significantly
      // Useful for end pointers that need to go under the list
      const arcHeight = Math.max(50, distanceTotal * 0.2, Math.abs(dx) * 0.15); // Make arc proportional but with a minimum
      cp1x = source.x + dx * 0.25; // Control point starts moving towards target x
      cp1y = source.y + arcHeight; // But dips down
      cp2x = target.x - dx * 0.25; // Control point ends moving from target x
      cp2y = target.y + arcHeight; // And also dips down from target side
      // If source.y and target.y are very different, this might need refinement
      // For now, assuming source and target y are somewhat similar for this path type (e.g. var box to node row)
    } else {
      // Default pathing logic
      if (isMainlyHorizontal) {
        cp1x = source.x + Math.sign(dx) * controlDistance;
        cp1y = source.y;
        cp2x = target.x - Math.sign(dx) * controlDistance;
        cp2y = target.y;
      } else if (isMainlyVertical) {
        cp1x = source.x;
        cp1y = source.y + Math.sign(dy) * controlDistance;
        cp2x = target.x;
        cp2y = target.y - Math.sign(dy) * controlDistance;
      } else {
        cp1x = source.x + Math.sign(dx) * controlDistance;
        cp1y = source.y + Math.sign(dy) * controlDistance * 0.3;
        cp2x = target.x - Math.sign(dx) * controlDistance;
        cp2y = target.y - Math.sign(dy) * controlDistance * 0.3;
      }
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
      // Completely disabled per user request
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
      const newIndex = 0;
      setCurrentSnapshotIndex(newIndex);

      // Directly trigger rendering with the new snapshot
      const operation = operations[currentHistoryIndex];
      const snapshot = operation.memorySnapshots[newIndex];
      setTimeout(() => {
        renderVisualization(operation, snapshot);
      }, 10);
    }
  };

  const goToLast = () => {
    // Only operate in snapshot mode and only within the current operation
    if (
      snapshotMode &&
      operations[currentHistoryIndex]?.memorySnapshots?.length > 0
    ) {
      const newIndex =
        operations[currentHistoryIndex].memorySnapshots.length - 1;
      setCurrentSnapshotIndex(newIndex);

      // Directly trigger rendering with the new snapshot
      const operation = operations[currentHistoryIndex];
      const snapshot = operation.memorySnapshots[newIndex];
      setTimeout(() => {
        renderVisualization(operation, snapshot);
      }, 10);
    }
  };

  const goToPrevious = () => {
    // Only operate in snapshot mode and only within the current operation
    if (snapshotMode && currentSnapshotIndex > 0) {
      const newIndex = currentSnapshotIndex - 1;
      setCurrentSnapshotIndex(newIndex);

      // Directly trigger rendering with the new snapshot
      const operation = operations[currentHistoryIndex];
      const snapshot = operation.memorySnapshots[newIndex];
      setTimeout(() => {
        renderVisualization(operation, snapshot);
      }, 10);
    }
  };

  const goToNext = () => {
    // Only operate in snapshot mode and only within the current operation
    if (snapshotMode) {
      const maxSnapshot =
        operations[currentHistoryIndex]?.memorySnapshots?.length - 1;
      if (currentSnapshotIndex < maxSnapshot) {
        const newIndex = currentSnapshotIndex + 1;
        setCurrentSnapshotIndex(newIndex);

        // Directly trigger rendering with the new snapshot
        const operation = operations[currentHistoryIndex];
        const snapshot = operation.memorySnapshots[newIndex];
        setTimeout(() => {
          renderVisualization(operation, snapshot);
        }, 10);
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
      const newIndex = 0;
      setCurrentSnapshotIndex(newIndex);

      // Directly trigger rendering with the snapshot
      const operation = operations[currentHistoryIndex];
      const snapshot = operation.memorySnapshots[newIndex];
      setTimeout(() => {
        renderVisualization(operation, snapshot);
      }, 10);
    } else if (!newMode) {
      // When exiting snapshot mode, render the operation without a snapshot
      const operation = operations[currentHistoryIndex];
      setTimeout(() => {
        renderVisualization(operation, null);
      }, 10);
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
        const type = (dataStructure.type || "").toUpperCase();
        const impl = (dataStructure.implementation || "").toUpperCase();
        let combinedType;

        if (impl && impl !== "NULL" && impl !== "") {
          combinedType = `${impl}_${type}`;
        } else {
          combinedType = type;
        }
        console.log("Combined structure type for switch:", combinedType);

        switch (combinedType) {
          case "ARRAY_VECTOR":
            console.log("Using array visualization for ARRAY_VECTOR");
            renderArrayVisualization(
              contentGroup,
              width,
              height,
              effectiveOperation,
              memorySnapshot
            );
            break;
          case "LINKED_LIST_VECTOR":
            console.log(
              "Using linked list visualization for LINKED_LIST_VECTOR (stub)"
            );
            renderLinkedListVisualization(
              contentGroup,
              width,
              height,
              effectiveOperation,
              memorySnapshot
            );
            break;

          // Cases for which we show "not implemented"
          case "ARRAY_STACK":
          case "LINKED_LIST_STACK":
          case "TWO_QUEUE_STACK":
          case "ARRAY_QUEUE":
          case "LINKED_LIST_QUEUE":
          case "ARRAY_MAP":
          case "HASH_MAP":
          case "TREE_MAP":
          case "GRID":
          case "DEQUEUE":
          case "BS_TREE":
          case "AVL_TREE":
          case "EXPRESSION_TREE":
          case "HASH_SET":
          case "TREE_SET":
          case "SMALL_INT_SET":
          case "MOVE_TO_FRONT_SET":
          case "UNSORTED_VECTOR_PRIORITY_QUEUE":
          case "SORTED_LINKED_LIST_PRIORITY_QUEUE":
          case "UNSORTED_DOUBLY_LINKED_LIST_PRIORITY_QUEUE":
          case "BINARY_HEAP_PRIORITY_QUEUE":
          case "BIG_INTEGER":
          case "FILE_SYSTEM":
          case "ARRAY_EDITOR_BUFFER":
          case "TWO_STACK_EDITOR_BUFFER":
          case "LINKED_LIST_EDITOR_BUFFER":
          case "DOUBLY_LINKED_LIST_EDITOR_BUFFER":
            console.log(
              `No specific implementation for ${combinedType}, showing message.`
            );
            showNotImplementedMessage(
              contentGroup,
              width,
              height,
              combinedType
            );
            break;

          default:
            console.log(
              `Default: No specific implementation for ${combinedType}, showing message.`
            );
            showNotImplementedMessage(
              contentGroup,
              width,
              height,
              combinedType
            );
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

  // Function to handle memory visualization (used when enableMemoryVisualization is true)
  const renderMemoryVisualization = (operation, svgRef) => {
    console.log("Rendering memory-based visualization");

    if (!svgRef.current) {
      console.error("SVG reference is not available");
      return;
    }

    // Get the SVG and dimensions
    const svg = d3.select(svgRef.current);
    const width = parseInt(svg.style("width")) || 800;
    const height = parseInt(svg.style("height")) || 600;

    // Use the standard visualization methods based on the structure type
    if (!dataStructure) {
      console.error("Data structure information is missing");
      return;
    }

    const structureType = (dataStructure.type || "").toUpperCase();

    // Try to get the memory snapshot if available
    let memorySnapshot = null;
    if (operation.memorySnapshots && operation.memorySnapshots.length > 0) {
      if (
        snapshotMode &&
        currentSnapshotIndex >= 0 &&
        currentSnapshotIndex < operation.memorySnapshots.length
      ) {
        memorySnapshot = operation.memorySnapshots[currentSnapshotIndex];
        console.log(
          "Memory visualization using specific snapshot:",
          currentSnapshotIndex
        );
      } else {
        memorySnapshot =
          operation.memorySnapshots[operation.memorySnapshots.length - 1];
        console.log("Memory visualization using last snapshot");
      }
    }

    // Simply delegate to the appropriate visualization based on structure type
    switch (structureType) {
      case "VECTOR":
        renderArrayVisualization(svg, width, height, operation, memorySnapshot);
        break;
      case "LINKED_LIST":
        renderLinkedListVisualization(svg, width, height, operation);
        break;
      case "TREE":
        renderTreeVisualization(svg, width, height, operation);
        break;
      case "STACK":
      case "QUEUE":
        renderStackQueueVisualization(svg, width, height, operation);
        break;
      case "MAP":
        renderHashMapVisualization(svg, width, height, operation);
        break;
      default:
        renderDefaultVisualization(svg, width, height, operation);
    }
  };

  const showNotImplementedMessage = (
    contentGroup,
    width, // Original width and height might not be what we want for a targeted message
    height,
    message,
    xPosition, // Allow specifying position
    yPosition // Allow specifying position
  ) => {
    // Clear previous message if any - BE CAREFUL if contentGroup is shared and not specific to this message
    // contentGroup.selectAll(".not-implemented-message").remove();

    const displayX = xPosition !== undefined ? xPosition : width / 2;
    const displayY = yPosition !== undefined ? yPosition : height / 2;

    contentGroup
      .append("text")
      .attr("class", "not-implemented-message") // Add class for potential selective clearing
      .attr("x", displayX)
      .attr("y", displayY)
      .attr("text-anchor", xPosition !== undefined ? "start" : "middle")
      .attr("font-size", "14px")
      .attr("fill", "#475569")
      .text(message);
  };

  const renderLinkedListVisualization = (
    contentGroup, // Changed from svg
    width,
    height,
    operation, // Added operation
    memorySnapshot // Added memorySnapshot
  ) => {
    console.log(
      "Starting renderLinkedListVisualization (Step 1: VarBoxes) with op:",
      operation
    );

    const state = operation.state || {};
    const localVariables = state.localVariables || {};
    const instanceVariables = state.instanceVariables || {};
    const addressObjectMap = state.addressObjectMap || {}; // Now needed for node data

    // Define styles (scoped to this function for now)
    const styles = {
      varBox: {
        // Styles adapted from webBrowserVisualization's localVars/instanceVars
        width: 200,
        headerHeight: 25,
        fieldHeight: 25,
        padding: 10,
        fill: "#ffffff", // Main box fill is white like web-browser's var boxes
        stroke: "#94a3b8", // Gray stroke like web-browser's localVars
        titleFill: "#94a3b8", // Header fill like web-browser's var boxes
        titleFillOpacity: 0.3,
        textFill: "#334155", // Dark gray text
        valueFill: "#0ea5e9", // Keep blue for addresses in var boxes
        fieldRectFill: "white",
        fieldRectStroke: "#e2e8f0",
      },
      node: {
        // Styles adapted from webBrowserVisualization's page style
        width: 200,
        // Calculated height: header (25) + 2 fields (value, next) * 25 = 50. Padding: 10 (top) + 5 (between field & header) + 5 (between fields) + 10 (bottom) = 25+50+25 = 100
        height: 105, // Adjusted: Header(25) + Pad1(10) + Field1(25) + Pad2(5) + Field2(25) + Pad3(10) = 100. Let's use 105 to match structure.
        headerHeight: 25,
        fieldHeight: 25,
        padding: 10, // General padding (e.g. for text from edge, and bottom of node)
        fieldVPadding: 5, // Vertical padding between header & first field, and between fields themselves
        fill: "#ffffff", // White fill like a web page
        stroke: "#94a3b8", // Gray stroke
        textFill: "#334155", // Dark gray text for labels
        valueTextFill: "#334155", // Dark gray for actual value data
        addressTextFill: "#0284c7", // Blue for address text (like next pointers)
        spacingX: 50, // Increased spacing between nodes
        spacingY: 40, // Vertical space (if implementing grid/vertical)
      },
      connection: {
        strokeWidth: 1.5, // Keep slightly thinner than web-browser's default 2
        arrowSize: 7, // Slightly smaller arrow
        instanceVarColor: "#334155", // Dark gray for pointers from instance vars (like 'head')
        nextColor: "#2563eb", // Keep distinct blue for next pointers in list
        // prevColor removed as per request
      },
    };

    // Add arrowhead definitions
    let defs = contentGroup.select("defs");
    if (defs.empty()) {
      defs = contentGroup.append("defs");
    }
    // Arrow for 'next' pointers - blue
    if (defs.select("#ll-next-arrow").empty()) {
      defs
        .append("marker")
        .attr("id", "ll-next-arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", styles.connection.arrowSize - 1) // Adjust refX if arrow head seems detached
        .attr("refY", 0)
        .attr("markerWidth", styles.connection.arrowSize)
        .attr("markerHeight", styles.connection.arrowSize)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", styles.connection.nextColor);
    }
    // Arrow for instance variable pointers (e.g. head) - dark gray
    if (defs.select("#ll-instance-var-arrow").empty()) {
      defs
        .append("marker")
        .attr("id", "ll-instance-var-arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", styles.connection.arrowSize - 1)
        .attr("refY", 0)
        .attr("markerWidth", styles.connection.arrowSize)
        .attr("markerHeight", styles.connection.arrowSize)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", styles.connection.instanceVarColor);
    }

    const firstColX = 30;
    const varBoxTopMargin = 30;
    let yOffset = varBoxTopMargin;

    // --- 1. Render Local Variables Box (Styled like Web Browser) ---
    const localVarsGroup = contentGroup
      .append("g")
      .attr("class", "local-variables-group");

    if (Object.keys(localVariables).length > 0) {
      const localVarCount = Object.keys(localVariables).length;
      const localVarsInternalHeight =
        localVarCount * styles.varBox.fieldHeight +
        (localVarCount > 0 ? styles.varBox.padding * (localVarCount - 1) : 0);
      const localVarsHeight =
        styles.varBox.headerHeight +
        (localVarCount > 0
          ? styles.varBox.padding * 2 +
            localVarCount * styles.varBox.fieldHeight
          : styles.varBox.padding);

      localVarsGroup
        .append("rect") // Main box
        .attr("x", firstColX)
        .attr("y", yOffset)
        .attr("width", styles.varBox.width)
        .attr("height", localVarsHeight)
        .attr("fill", styles.varBox.fill)
        .attr("stroke", styles.varBox.stroke)
        .attr("stroke-width", 1)
        .attr("rx", 5);
      localVarsGroup
        .append("rect") // Titlebar
        .attr("x", firstColX)
        .attr("y", yOffset)
        .attr("width", styles.varBox.width)
        .attr("height", styles.varBox.headerHeight)
        .attr("fill", styles.varBox.titleFill)
        .attr("fill-opacity", styles.varBox.titleFillOpacity)
        .attr("stroke", styles.varBox.stroke) // Match main stroke for consistency
        .attr("stroke-width", 1) // Ensure title bar stroke is visible if fill is very light
        .attr("rx", 5)
        .attr("ry", 0);
      localVarsGroup
        .append("text") // Title text
        .attr("x", firstColX + styles.varBox.width / 2)
        .attr("y", yOffset + styles.varBox.headerHeight / 2 + 5)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .attr("font-size", "13px")
        .attr("fill", styles.varBox.textFill)
        .text("Local Variables");

      let fieldContentY =
        yOffset + styles.varBox.headerHeight + styles.varBox.padding;
      Object.entries(localVariables).forEach(([key, value]) => {
        // Field container rect (like web browser)
        localVarsGroup
          .append("rect")
          .attr("x", firstColX + styles.varBox.padding / 2)
          .attr("y", fieldContentY - styles.varBox.padding / 2 + 2)
          .attr("width", styles.varBox.width - styles.varBox.padding)
          .attr("height", styles.varBox.fieldHeight)
          .attr("fill", styles.varBox.fieldRectFill)
          .attr("stroke", styles.varBox.fieldRectStroke)
          .attr("rx", 3);

        localVarsGroup // Key text
          .append("text")
          .attr("x", firstColX + styles.varBox.padding)
          .attr("y", fieldContentY + styles.varBox.fieldHeight / 2 - 2)
          .attr("font-size", "12px")
          .attr("fill", styles.varBox.textFill)
          .text(`${key}:`);
        localVarsGroup // Value text
          .append("text")
          .attr("x", firstColX + styles.varBox.width - styles.varBox.padding)
          .attr("y", fieldContentY + styles.varBox.fieldHeight / 2 - 2)
          .attr("text-anchor", "end")
          .attr("font-size", "12px")
          .attr("font-weight", isAddress(value) ? "bold" : "normal")
          .attr(
            "fill",
            isAddress(value) ? styles.varBox.valueFill : styles.varBox.textFill
          )
          .text(truncateAddress(String(value)));
        fieldContentY += styles.varBox.fieldHeight + styles.varBox.padding / 2; // Add small gap between fields
      });
      yOffset += localVarsHeight + 20;
    }

    // --- 2. Render Instance Variables Box (Styled like Web Browser) ---
    const instanceVarsGroup = contentGroup
      .append("g")
      .attr("class", "instance-variables-group");

    if (Object.keys(instanceVariables).length > 0) {
      const instanceVarCount = Object.keys(instanceVariables).length;
      const instanceVarsHeight =
        styles.varBox.headerHeight +
        (instanceVarCount > 0
          ? styles.varBox.padding * 2 +
            instanceVarCount * styles.varBox.fieldHeight
          : styles.varBox.padding);

      instanceVarsGroup
        .append("rect") // Main box
        .attr("x", firstColX)
        .attr("y", yOffset)
        .attr("width", styles.varBox.width)
        .attr("height", instanceVarsHeight)
        // instanceVars in web-browser has a slightly different fill. Let's use a common fill for varBoxes now for simplicity or use a specific one.
        // For now, using the same fill as localVars for internal consistency here.
        .attr("fill", styles.varBox.fill)
        .attr("stroke", styles.varBox.stroke) // But can use instanceVar specific stroke if desired, e.g. styles.instanceVars.stroke from web browser
        .attr("stroke-width", 1)
        .attr("rx", 5);
      instanceVarsGroup
        .append("rect") // Titlebar
        .attr("x", firstColX)
        .attr("y", yOffset)
        .attr("width", styles.varBox.width)
        .attr("height", styles.varBox.headerHeight)
        .attr("fill", styles.varBox.titleFill)
        .attr("fill-opacity", styles.varBox.titleFillOpacity)
        .attr("stroke", styles.varBox.stroke)
        .attr("stroke-width", 1)
        .attr("rx", 5)
        .attr("ry", 0);
      instanceVarsGroup
        .append("text") // Title text
        .attr("x", firstColX + styles.varBox.width / 2)
        .attr("y", yOffset + styles.varBox.headerHeight / 2 + 5)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .attr("font-size", "13px")
        .attr("fill", styles.varBox.textFill)
        .text("Instance Variables");

      let fieldContentY =
        yOffset + styles.varBox.headerHeight + styles.varBox.padding;
      Object.entries(instanceVariables).forEach(([key, value]) => {
        // Field container rect
        instanceVarsGroup
          .append("rect")
          .attr("x", firstColX + styles.varBox.padding / 2)
          .attr("y", fieldContentY - styles.varBox.padding / 2 + 2)
          .attr("width", styles.varBox.width - styles.varBox.padding)
          .attr("height", styles.varBox.fieldHeight)
          .attr("fill", styles.varBox.fieldRectFill)
          .attr("stroke", styles.varBox.fieldRectStroke)
          .attr("rx", 3);

        instanceVarsGroup // Key text
          .append("text")
          .attr("x", firstColX + styles.varBox.padding)
          .attr("y", fieldContentY + styles.varBox.fieldHeight / 2 - 2)
          .attr("font-size", "12px")
          .attr("fill", styles.varBox.textFill)
          .text(`${key}:`);
        instanceVarsGroup // Value text
          .append("text")
          .attr("x", firstColX + styles.varBox.width - styles.varBox.padding)
          .attr("y", fieldContentY + styles.varBox.fieldHeight / 2 - 2)
          .attr("text-anchor", "end")
          .attr("font-size", "12px")
          .attr("font-weight", isAddress(value) ? "bold" : "normal")
          .attr(
            "fill",
            isAddress(value) ? styles.varBox.valueFill : styles.varBox.textFill
          )
          .text(truncateAddress(String(value)));
        fieldContentY += styles.varBox.fieldHeight + styles.varBox.padding / 2;
      });
    }

    // --- Prepare Linked List Node Data (Step 2a) ---
    const nodes = [];
    const nodePositions = {};
    const visited = new Set();

    let nodeStartX =
      firstColX + styles.varBox.width + (styles.node.spacingX || 50) + 40;
    let nodeStartY = varBoxTopMargin; // Align top of nodes with top of var boxes for a cleaner look

    let currentX = nodeStartX;
    let currentYNode = nodeStartY;

    // Determine starting point (e.g., 'head', or first node found if no head)
    let startAddress =
      instanceVariables.start ||
      instanceVariables.head ||
      instanceVariables.front;
    if (!startAddress || startAddress === "0x0" || startAddress === "null") {
      const allNodeAddresses = Object.keys(addressObjectMap);
      const pointedToAddresses = new Set();
      allNodeAddresses.forEach((addr) => {
        const obj = addressObjectMap[addr];
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          if (obj.next && obj.next !== "0x0" && obj.next !== "null")
            pointedToAddresses.add(obj.next);
          if (obj.prev && obj.prev !== "0x0" && obj.prev !== "null")
            pointedToAddresses.add(obj.prev); // For doubly linked
        }
      });
      const potentialStarts = allNodeAddresses.filter(
        (addr) =>
          addressObjectMap[addr] &&
          typeof addressObjectMap[addr] === "object" &&
          !Array.isArray(addressObjectMap[addr]) &&
          !pointedToAddresses.has(addr)
      );
      if (potentialStarts.length > 0) {
        startAddress = potentialStarts[0];
        console.log(
          "No explicit 'head' found, using heuristically determined start node:",
          startAddress
        );
      } else if (allNodeAddresses.length > 0) {
        // Fallback: try to find the first object that looks like a node
        const firstPotentialNode = allNodeAddresses.find(
          (addr) =>
            addressObjectMap[addr] &&
            typeof addressObjectMap[addr] === "object" &&
            !Array.isArray(addressObjectMap[addr]) &&
            (addressObjectMap[addr].hasOwnProperty("data") ||
              addressObjectMap[addr].hasOwnProperty("value") ||
              addressObjectMap[addr].hasOwnProperty("next"))
        );
        if (firstPotentialNode) {
          startAddress = firstPotentialNode;
          console.log(
            "No 'head' or clear unpointed start, falling back to first potential node object in map:",
            startAddress
          );
        } else {
          console.log(
            "Could not determine a start node for the linked list from addressObjectMap."
          );
        }
      } else {
        console.log("addressObjectMap is empty, cannot determine start node.");
      }
    }

    let currentAddress = startAddress;
    let nodesProcessedCount = 0;
    const MAX_NODES_TO_RENDER = 50; // Safety break

    while (
      currentAddress &&
      currentAddress !== "0x0" &&
      currentAddress !== "null" &&
      !visited.has(currentAddress) &&
      nodesProcessedCount < MAX_NODES_TO_RENDER
    ) {
      visited.add(currentAddress);
      const nodeData = addressObjectMap[currentAddress];

      if (
        !nodeData ||
        typeof nodeData !== "object" ||
        Array.isArray(nodeData)
      ) {
        console.warn(
          `Address ${currentAddress} in list does not point to a valid node object in addressObjectMap. Stopping traversal here.`
        );
        break;
      }

      nodes.push({
        id: currentAddress, // Unique ID for D3 keys
        address: currentAddress,
        dataVal:
          nodeData.data !== undefined
            ? nodeData.data
            : nodeData.value !== undefined
            ? nodeData.value
            : "N/A",
        nextAddress: nodeData.nextAddress, // Changed from nodeData.next
        // prevAddress: nodeData.prev, // This was already correctly removed/commented if not used
        x: currentX,
        y: currentYNode,
      });
      nodePositions[currentAddress] = {
        x: currentX,
        y: currentYNode,
        width: styles.node.width,
        height: styles.node.height,
      };

      currentX += styles.node.width + styles.node.spacingX;
      // For now, a simple horizontal list. Vertical/grid layout would modify currentYNode here.

      currentAddress = nodeData.nextAddress; // Changed from nodeData.next
      nodesProcessedCount++;
    }

    if (nodesProcessedCount === MAX_NODES_TO_RENDER) {
      console.warn(
        "Reached MAX_NODES_TO_RENDER limit during linked list traversal. List might be truncated in visualization."
      );
    }

    // Update placeholder message logic based on node preparation
    const nodesPlaceholderX = nodeStartX;
    const nodesPlaceholderY = nodeStartY + styles.node.height / 2;

    if (nodes.length > 0) {
      showNotImplementedMessage(
        contentGroup,
        width,
        height,
        `Found ${nodes.length} nodes. Rendering coming next...`,
        nodesPlaceholderX,
        nodesPlaceholderY - styles.node.height / 2 - 10
      ); // Move msg above where nodes will be
    } else if (
      !startAddress ||
      startAddress === "0x0" ||
      startAddress === "null"
    ) {
      showNotImplementedMessage(
        contentGroup,
        width,
        height,
        "Could not find a starting node (e.g., 'head').",
        nodesPlaceholderX,
        nodesPlaceholderY
      );
    } else {
      showNotImplementedMessage(
        contentGroup,
        width,
        height,
        "List is empty or start node data is invalid.",
        nodesPlaceholderX,
        nodesPlaceholderY
      );
    }

    console.log(
      "Finished renderLinkedListVisualization (Step 1 + 2a: VarBoxes and Node Data Prep)"
    );
    console.log("Prepared nodes:", nodes);
    console.log("Node positions:", nodePositions);

    // --- Render Nodes and Connections (Step 2b) ---
    if (nodes.length > 0) {
      // Clear any "not implemented" messages specifically for nodes before drawing actual nodes
      contentGroup
        .selectAll(".not-implemented-message")
        .filter(function () {
          return (
            d3.select(this).text().startsWith("Found") ||
            d3.select(this).text().startsWith("Could not find") ||
            d3.select(this).text().startsWith("List is empty")
          );
        })
        .remove();

      const nodesGroup = contentGroup
        .append("g")
        .attr("class", "linked-list-nodes");

      // Render each node (Styled like Web Browser Page)
      nodes.forEach((node) => {
        const nodeGroup = nodesGroup
          .append("g")
          .attr("class", "ll-node")
          .attr("transform", `translate(${node.x}, ${node.y})`);

        // Node box (like web-browser page rect)
        nodeGroup
          .append("rect")
          .attr("width", styles.node.width)
          .attr("height", styles.node.height)
          .attr("fill", styles.node.fill)
          .attr("stroke", styles.node.stroke)
          .attr("stroke-width", 1) // Web browser page uses 1 or 2 if current
          .attr("rx", 5);

        // Node address header (like web-browser page title section)
        nodeGroup
          .append("rect")
          .attr("width", styles.node.width)
          .attr("height", styles.node.headerHeight)
          .attr("fill", styles.node.stroke) // Web-browser page title uses page.stroke with opacity
          .attr("fill-opacity", 0.3)
          .attr("rx", 5)
          .attr("ry", 0);
        nodeGroup
          .append("text") // Address text
          .attr("x", styles.node.width / 2)
          .attr("y", styles.node.headerHeight / 2 + 4) // Centered in header
          .attr("text-anchor", "middle")
          .attr("font-size", "13px") // Larger like web-browser page titles
          .attr("font-weight", "bold")
          .attr("fill", styles.node.textFill)
          .text(truncateAddress(node.address, 8));

        // Divider line after header (like web-browser page)
        nodeGroup
          .append("line")
          .attr("x1", 0)
          .attr("y1", styles.node.headerHeight)
          .attr("x2", styles.node.width)
          .attr("y2", styles.node.headerHeight)
          .attr("stroke", styles.node.stroke)
          .attr("stroke-width", 1);

        // Start Y for first field: Header height + specific vertical padding
        let fieldCurrentY =
          styles.node.headerHeight + styles.node.fieldVPadding;

        // Field container rects (like web-browser page fields)
        // Value field rect
        nodeGroup
          .append("rect")
          .attr("x", styles.node.padding / 2) // Small horizontal padding for rect
          .attr("y", fieldCurrentY)
          .attr("width", styles.node.width - styles.node.padding) // Rect width takes into account padding on both sides
          .attr("height", styles.node.fieldHeight)
          .attr("fill", "none") // web-browser page fields use fill:none
          .attr("stroke", "#e2e8f0") // light stroke for field separator
          .attr("rx", 3);

        // Data/Value field text
        nodeGroup
          .append("text")
          .attr("x", styles.node.padding) // Text starts after main node padding
          .attr(
            "y",
            fieldCurrentY +
              styles.node.fieldHeight / 2 +
              styles.node.padding / 2 -
              2
          ) // Adjusted for better centering within field rect
          .attr("font-size", "13px") // Match web-browser page field text size
          .attr("font-weight", "bold")
          .attr("fill", styles.node.textFill)
          .text("value:");
        nodeGroup
          .append("text")
          .attr("x", styles.node.width - styles.node.padding) // Text ends before main node padding (anchor end)
          .attr(
            "y",
            fieldCurrentY +
              styles.node.fieldHeight / 2 +
              styles.node.padding / 2 -
              2
          ) // Adjusted for better centering
          .attr("text-anchor", "end")
          .attr("font-size", "13px")
          .attr("font-weight", isAddress(node.dataVal) ? "bold" : "normal")
          .attr(
            "fill",
            isAddress(node.dataVal)
              ? styles.node.addressTextFill
              : styles.node.valueTextFill
          )
          .text(truncateAddress(String(node.dataVal)));
        fieldCurrentY += styles.node.fieldHeight + styles.node.fieldVPadding;

        // Next pointer field rect
        nodeGroup
          .append("rect")
          .attr("x", styles.node.padding / 2)
          .attr("y", fieldCurrentY)
          .attr("width", styles.node.width - styles.node.padding)
          .attr("height", styles.node.fieldHeight)
          .attr("fill", "none")
          .attr("stroke", "#e2e8f0")
          .attr("rx", 3);

        // Next pointer field text
        nodeGroup
          .append("text")
          .attr("x", styles.node.padding)
          .attr(
            "y",
            fieldCurrentY +
              styles.node.fieldHeight / 2 +
              styles.node.padding / 2 -
              2
          ) // Adjusted for better centering
          .attr("font-size", "13px")
          .attr("font-weight", "bold")
          .attr("fill", styles.node.textFill)
          .text("next:");
        nodeGroup
          .append("text")
          .attr("x", styles.node.width - styles.node.padding)
          .attr(
            "y",
            fieldCurrentY +
              styles.node.fieldHeight / 2 +
              styles.node.padding / 2 -
              2
          ) // Adjusted for better centering
          .attr("text-anchor", "end")
          .attr("font-size", "13px")
          .attr("font-weight", "bold")
          .attr("fill", styles.connection.nextColor) // Use specific nextColor for the address value
          .text(truncateAddress(node.nextAddress));

        // Removed Prev pointer field rendering
      });

      // Render connections
      const connectionsGroup = contentGroup
        .append("g")
        .attr("class", "ll-connections");
      nodes.forEach((node) => {
        // Next connection
        if (
          node.nextAddress &&
          node.nextAddress !== "0x0" &&
          node.nextAddress !== "null" &&
          nodePositions[node.nextAddress]
        ) {
          const sourcePos = nodePositions[node.address];
          const targetPos = nodePositions[node.nextAddress];

          const sourcePoint = {
            x: sourcePos.x + sourcePos.width,
            y:
              sourcePos.y +
              styles.node.headerHeight +
              styles.node.fieldVPadding + // Padding after header
              styles.node.fieldHeight + // Height of value field
              styles.node.fieldVPadding + // Padding after value field
              styles.node.fieldHeight / 2, // Middle of the next field itself
          };
          const targetPoint = {
            x: targetPos.x, // Connect to left edge of target node
            y: targetPos.y + targetPos.height / 2,
          };

          connectionsGroup
            .append("path") // Changed from line to path
            .attr("d", generateCurvedPath(sourcePoint, targetPoint)) // Use curved path
            .attr("fill", "none") // Paths should not be filled for arrows
            .attr("stroke", styles.connection.nextColor)
            .attr("stroke-width", styles.connection.strokeWidth)
            .attr("marker-end", "url(#ll-next-arrow)");
        }
        // Removed Prev connection rendering
      });

      // Connections from Instance Variables to nodes (e.g., head, tail pointers)
      Object.entries(instanceVariables).forEach(([varName, varValue]) => {
        if (isAddress(varValue) && nodePositions[varValue]) {
          // Calculate sourceY for the instance variable field
          let varBoxYOffset = varBoxTopMargin;
          if (Object.keys(localVariables).length > 0) {
            const localVarCount = Object.keys(localVariables).length;
            varBoxYOffset +=
              styles.varBox.headerHeight +
              (localVarCount > 0
                ? styles.varBox.padding * 2 +
                  localVarCount * styles.varBox.fieldHeight
                : styles.varBox.padding) +
              20;
          }
          const varIndex = Object.keys(instanceVariables).indexOf(varName);

          let sourcePoint;
          let targetPoint;
          const targetNodePos = nodePositions[varValue];
          let pathType = "default"; // Default path type
          let dAttribute = ""; // To store the path 'd' attribute string

          if (varName === "end" && nodes.length > 1 && targetNodePos) {
            const varBoxInstanceHeight =
              styles.varBox.headerHeight +
              (Object.keys(instanceVariables).length > 0
                ? styles.varBox.padding * 2 +
                  Object.keys(instanceVariables).length *
                    styles.varBox.fieldHeight
                : styles.varBox.padding);

            sourcePoint = {
              x: firstColX + styles.varBox.width / 2,
              y: varBoxYOffset + varBoxInstanceHeight, // Bottom-middle of the var box
            };
            targetPoint = {
              x: targetNodePos.x + targetNodePos.width / 2,
              y: targetNodePos.y + targetNodePos.height, // Bottom-middle of target node
            };

            const verticalDip = Math.max(30, styles.node.height / 2); // How far down the path should go
            const cornerRadius = 10; // Radius for curved corners

            // Start path
            dAttribute = `M ${sourcePoint.x} ${sourcePoint.y}`;
            // Line down
            dAttribute += ` V ${sourcePoint.y + verticalDip - cornerRadius}`;
            // Curve for first corner (down then right)
            dAttribute += ` Q ${sourcePoint.x} ${
              sourcePoint.y + verticalDip
            }, ${sourcePoint.x + cornerRadius} ${sourcePoint.y + verticalDip}`;
            // Horizontal line to the right, towards target X
            dAttribute += ` H ${targetPoint.x - cornerRadius}`;
            // Curve for second corner (right then up)
            dAttribute += ` Q ${targetPoint.x} ${
              sourcePoint.y + verticalDip
            }, ${targetPoint.x} ${sourcePoint.y + verticalDip - cornerRadius}`;
            // Line up to target
            dAttribute += ` V ${targetPoint.y}`;
          } else {
            // Default connection for other instance variables (like 'start') or if 'end' is the only node
            sourcePoint = {
              x: firstColX + styles.varBox.width,
              y:
                varBoxYOffset +
                styles.varBox.headerHeight +
                styles.varBox.padding +
                varIndex *
                  (styles.varBox.fieldHeight + styles.varBox.padding / 2) +
                styles.varBox.fieldHeight / 2 -
                2,
            };
            targetPoint = {
              x: targetNodePos ? targetNodePos.x : currentX, // Fallback if targetNodePos is somehow undefined for start
              y: targetNodePos
                ? targetNodePos.y + targetNodePos.height / 2
                : currentYNode,
            };
            pathType = "default"; // Will be used by generateCurvedPath
            dAttribute = generateCurvedPath(sourcePoint, targetPoint, pathType);
          }

          if (dAttribute) {
            // Ensure dAttribute is set
            connectionsGroup
              .append("path")
              .attr("d", dAttribute)
              .attr("fill", "none")
              .attr("stroke", styles.connection.instanceVarColor)
              .attr("stroke-width", styles.connection.strokeWidth)
              .attr("marker-end", "url(#ll-instance-var-arrow)");
          }
        }
      });
    } else if (
      !startAddress ||
      startAddress === "0x0" ||
      startAddress === "null"
    ) {
      showNotImplementedMessage(
        contentGroup,
        width,
        height,
        "Could not find a starting node (e.g., 'head').",
        nodesPlaceholderX,
        nodesPlaceholderY
      );
    }
  };

  const renderTreeVisualization = (
    contentGroup, // Changed from svg
    width,
    height,
    operation, // Added operation
    memorySnapshot // Added memorySnapshot
  ) => {
    console.log("Render Tree (stub) for op:", operation);
    showNotImplementedMessage(contentGroup, width, height, "Tree");
  };

  const renderStackQueueVisualization = (
    contentGroup, // Changed from svg
    width,
    height,
    operation, // Added operation
    memorySnapshot // Added memorySnapshot
  ) => {
    console.log("Render Stack/Queue (stub) for op:", operation);
    showNotImplementedMessage(contentGroup, width, height, "Stack/Queue");
  };

  const renderHashMapVisualization = (
    contentGroup, // Changed from svg
    width,
    height,
    operation, // Added operation
    memorySnapshot // Added memorySnapshot
  ) => {
    console.log("Render HashMap (stub) for op:", operation);
    showNotImplementedMessage(contentGroup, width, height, "HashMap");
  };

  const renderDefaultVisualization = (
    contentGroup, // Changed from svg
    width,
    height,
    operation, // Added operation
    memorySnapshot // Added memorySnapshot
  ) => {
    console.log("Render Default (stub) for op:", operation);
    showNotImplementedMessage(
      contentGroup,
      width,
      height,
      operation?.state?.structureType || dataStructure?.type || "Unknown"
    );
  };

  // Function to render Array/Vector visualization
  const renderArrayVisualization = (
    contentGroup,
    width,
    height,
    operation,
    memorySnapshot = null
  ) => {
    console.log("Rendering array visualization with operation:", operation);
    console.log("With memory snapshot:", memorySnapshot);

    let svgDefs = d3.select(svgRef.current).select("defs");
    if (svgDefs.empty()) {
      svgDefs = d3.select(svgRef.current).append("defs");
    }
    if (svgDefs.select("#array-arrow").empty()) {
      svgDefs
        .append("marker")
        .attr("id", "array-arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#0284c7");
    }
    if (svgDefs.select("#var-ref-arrow").empty()) {
      svgDefs
        .append("marker")
        .attr("id", "var-ref-arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#334155");
    }

    const arrayState = operation.state || {};
    const localVariables = arrayState.localVariables || {};
    const instanceVariables = arrayState.instanceVariables || {};
    const addressObjectMap = arrayState.addressObjectMap || {};

    // Determine the array to visualize
    let effectiveArrayAddress = null;
    let arrayObjectInMap = null; // The actual array object from the map

    const ivArrayAddress = instanceVariables.array; // Address from instance variable

    if (
      ivArrayAddress &&
      addressObjectMap[ivArrayAddress] &&
      Array.isArray(addressObjectMap[ivArrayAddress])
    ) {
      // Priority 1: Use the array pointed to by instanceVariables.array
      effectiveArrayAddress = ivArrayAddress;
      arrayObjectInMap = addressObjectMap[ivArrayAddress];
    } else {
      // Priority 2: instanceVariables.array is not set, or doesn't point to a valid array.
      // Look for a unique candidate array in addressObjectMap.
      const candidateArrayAddresses = Object.keys(addressObjectMap).filter(
        (addr) => Array.isArray(addressObjectMap[addr])
      );

      if (candidateArrayAddresses.length === 1) {
        effectiveArrayAddress = candidateArrayAddresses[0];
        arrayObjectInMap = addressObjectMap[effectiveArrayAddress];
        console.log(
          "Displaying an array found in addressObjectMap not (yet) pointed to by instanceVariables.array:",
          effectiveArrayAddress
        );
      } else if (candidateArrayAddresses.length > 1) {
        console.warn(
          "Multiple arrays in addressObjectMap, and instanceVariables.array is not specific. Cannot determine which array to display."
        );
      }
      // If 0 candidates, effectiveArrayAddress and arrayObjectInMap remain null.
    }

    // Determine size, elements, and capacity for display
    const sizeFromInstanceVars =
      instanceVariables.count ?? instanceVariables.size ?? 0;
    let arrayElements = []; // Still useful for connections source/target logic
    // let calculatedCapacityForCells = 0; // No longer needed with simpler logic

    if (arrayObjectInMap) {
      // arrayElements are primarily for knowing what values *might* have connections
      // We slice up to arrayObjectInMap.length because any of these could be pointers
      arrayElements = arrayObjectInMap.slice(0, arrayObjectInMap.length);

      // let tempCapacity = instanceVariables.capacity || 0; // Old logic
      // if (tempCapacity === 0) { // Old logic
      //   tempCapacity = arrayObjectInMap.length; // Old logic
      // }
      // calculatedCapacityForCells = Math.max(tempCapacity, sizeFromInstanceVars); // Old logic
      // calculatedCapacityForCells = Math.min(calculatedCapacityForCells, arrayObjectInMap.length); // Old logic
    }

    const hasArrayObjectToDisplay =
      !!effectiveArrayAddress && !!arrayObjectInMap;
    // const displayCapacity = hasArrayObjectToDisplay ? calculatedCapacityForCells : 0; // Old logic
    const displayCapacity =
      hasArrayObjectToDisplay && arrayObjectInMap ? arrayObjectInMap.length : 0;

    console.log("Array Visualization Info:", {
      instanceArrayVarPointsTo: ivArrayAddress,
      effectiveArrayAddressRendered: effectiveArrayAddress,
      sizeFromInstance: sizeFromInstanceVars,
      capacityFromInstance: instanceVariables.capacity,
      finalDisplayCapacityCells: displayCapacity,
      elementsInVisualization: arrayElements.length,
      hasArrayObjectToDisplay,
      arrayObjectInMapExists: !!arrayObjectInMap,
    });

    const styles = {
      array: {
        elementWidth: 60,
        elementHeight: 60,
        fill: "#ffffff",
        unusedFill: "#f8fafc",
        stroke: "#94a3b8",
        textColor: "#334155",
      },
      localVars: {
        width: 200,
        fill: "#f8fafc",
        stroke: "#94a3b8",
        textColor: "#334155",
      },
      instanceVars: {
        width: 200,
        fill: "#f1f5f9",
        stroke: "#64748b",
        textColor: "#334155",
      },
      connection: { stroke: "#64748b", width: 2, varRefColor: "#334155" },
    };
    const pagePositions = {};
    const cellSize = styles.array.elementWidth;

    const firstColX = 50;
    const varBoxTopMargin = 20;
    const varBoxSpacing = 20;

    // 1. Render Local Variables Box
    const localVarsBox = contentGroup
      .append("g")
      .attr("class", "local-variables");
    const localVarCount = Object.keys(localVariables).length;
    const localVarsHeight = Math.max(65, 25 + 5 + localVarCount * 30);
    localVarsBox
      .append("rect")
      .attr("x", firstColX)
      .attr("y", varBoxTopMargin)
      .attr("width", styles.localVars.width)
      .attr("height", localVarsHeight)
      .attr("fill", styles.localVars.fill)
      .attr("stroke", styles.localVars.stroke)
      .attr("stroke-width", 1)
      .attr("rx", 5);
    localVarsBox
      .append("rect")
      .attr("x", firstColX)
      .attr("y", varBoxTopMargin)
      .attr("width", styles.localVars.width)
      .attr("height", 25)
      .attr("fill", styles.localVars.stroke)
      .attr("fill-opacity", 0.3)
      .attr("stroke", "none")
      .attr("rx", 5)
      .attr("ry", 0);
    localVarsBox
      .append("text")
      .attr("x", firstColX + styles.localVars.width / 2)
      .attr("y", varBoxTopMargin + 17)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("font-weight", "bold")
      .attr("fill", styles.localVars.textColor)
      .text("Local Variables");
    localVarsBox
      .append("line")
      .attr("x1", firstColX)
      .attr("y1", varBoxTopMargin + 25)
      .attr("x2", firstColX + styles.localVars.width)
      .attr("y2", varBoxTopMargin + 25)
      .attr("stroke", styles.localVars.stroke)
      .attr("stroke-width", 1);
    let yOffset = 30;
    Object.entries(localVariables).forEach(([key, value], index) => {
      localVarsBox
        .append("rect")
        .attr("x", firstColX + 10)
        .attr("y", varBoxTopMargin + yOffset)
        .attr("width", styles.localVars.width - 20)
        .attr("height", 25)
        .attr("fill", "white")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .attr("rx", 3);
      localVarsBox
        .append("text")
        .attr("x", firstColX + 20)
        .attr("y", varBoxTopMargin + yOffset + 17)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", styles.localVars.textColor)
        .text(key + ":");
      const isRef = isAddress(value);
      localVarsBox
        .append("text")
        .attr("x", firstColX + styles.localVars.width - 20)
        .attr("y", varBoxTopMargin + yOffset + 17)
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", isRef ? "#0284c7" : styles.localVars.textColor)
        .text(
          String(value).length > 10
            ? String(value).substring(0, 9) + "..."
            : value
        );
      pagePositions[`local_${key}`] = {
        x: firstColX,
        y: varBoxTopMargin + yOffset,
        width: styles.localVars.width,
        height: 25,
        value: value,
      };
      yOffset += 30;
    });

    // 2. Render Instance Variables Box (Below Local Variables)
    const instanceVarsStartY =
      varBoxTopMargin + localVarsHeight + varBoxSpacing;
    const instanceVarsBox = contentGroup
      .append("g")
      .attr("class", "instance-variables");
    const instanceVarCount = Object.keys(instanceVariables).length;
    const instanceVarsHeight = Math.max(65, 25 + 5 + instanceVarCount * 30);
    instanceVarsBox
      .append("rect")
      .attr("x", firstColX)
      .attr("y", instanceVarsStartY)
      .attr("width", styles.instanceVars.width)
      .attr("height", instanceVarsHeight)
      .attr("fill", styles.instanceVars.fill)
      .attr("stroke", styles.instanceVars.stroke)
      .attr("stroke-width", 1)
      .attr("rx", 5);
    instanceVarsBox
      .append("rect")
      .attr("x", firstColX)
      .attr("y", instanceVarsStartY)
      .attr("width", styles.instanceVars.width)
      .attr("height", 25)
      .attr("fill", styles.instanceVars.stroke)
      .attr("fill-opacity", 0.3)
      .attr("stroke", "none")
      .attr("rx", 5)
      .attr("ry", 0);
    instanceVarsBox
      .append("text")
      .attr("x", firstColX + styles.instanceVars.width / 2)
      .attr("y", instanceVarsStartY + 17)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("font-weight", "bold")
      .attr("fill", styles.instanceVars.textColor)
      .text("Instance Variables");
    instanceVarsBox
      .append("line")
      .attr("x1", firstColX)
      .attr("y1", instanceVarsStartY + 25)
      .attr("x2", firstColX + styles.instanceVars.width)
      .attr("y2", instanceVarsStartY + 25)
      .attr("stroke", styles.instanceVars.stroke)
      .attr("stroke-width", 1);
    yOffset = 30;
    Object.entries(instanceVariables).forEach(([key, value], index) => {
      instanceVarsBox
        .append("rect")
        .attr("x", firstColX + 10)
        .attr("y", instanceVarsStartY + yOffset)
        .attr("width", styles.instanceVars.width - 20)
        .attr("height", 25)
        .attr("fill", "white")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .attr("rx", 3);
      instanceVarsBox
        .append("text")
        .attr("x", firstColX + 20)
        .attr("y", instanceVarsStartY + yOffset + 17)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", styles.instanceVars.textColor)
        .text(key + ":");
      const isRef = isAddress(value) || key === "array";
      instanceVarsBox
        .append("text")
        .attr("x", firstColX + styles.instanceVars.width - 20)
        .attr("y", instanceVarsStartY + yOffset + 17)
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", isRef ? "#0284c7" : styles.instanceVars.textColor)
        .text(
          String(value).length > 10
            ? String(value).substring(0, 9) + "..."
            : String(value)
        );
      pagePositions[`instance_${key}`] = {
        x: firstColX,
        y: instanceVarsStartY + yOffset,
        width: styles.instanceVars.width,
        height: 25,
        value: value,
      };
      yOffset += 30;
    });

    // Position Array and Array Ref Box to the right of the variable boxes
    const arrayRefBoxWidth = 110;
    const arrayRefBoxX = firstColX + styles.localVars.width + 50;
    const arrayStartX =
      arrayRefBoxX + (hasArrayObjectToDisplay ? arrayRefBoxWidth + 20 : 0); // Start cells after ref box if it exists
    // const arraySectionY = varBoxTopMargin; // Align top of array stuff with top of local vars
    const arraySectionY = instanceVarsStartY; // Align top of array stuff with top of instance vars

    // 3. Draw the array reference box (if array object exists)
    if (hasArrayObjectToDisplay) {
      const arrayRefBox = contentGroup
        .append("g")
        .attr("class", "array-reference");
      arrayRefBox
        .append("rect")
        .attr("x", arrayRefBoxX)
        .attr("y", arraySectionY)
        .attr("width", arrayRefBoxWidth)
        .attr("height", cellSize)
        .attr("fill", "#f0f9ff")
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 1)
        .attr("rx", 4);
      arrayRefBox
        .append("rect")
        .attr("x", arrayRefBoxX)
        .attr("y", arraySectionY)
        .attr("width", arrayRefBoxWidth)
        .attr("height", 25)
        .attr("fill", "#94a3b8")
        .attr("fill-opacity", 0.3)
        .attr("stroke", "none")
        .attr("rx", 4)
        .attr("ry", 0);
      arrayRefBox
        .append("text")
        .attr("x", arrayRefBoxX + arrayRefBoxWidth / 2)
        .attr("y", arraySectionY + 17)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#334155")
        .text("array");
      arrayRefBox
        .append("text")
        .attr("x", arrayRefBoxX + arrayRefBoxWidth / 2)
        .attr("y", arraySectionY + 45)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", "#0284c7")
        .text(effectiveArrayAddress.substring(0, 8)); // Use effectiveArrayAddress here
      if (displayCapacity > 0) {
        arrayRefBox
          .append("path")
          .attr(
            "d",
            `M ${arrayRefBoxX + arrayRefBoxWidth} ${
              arraySectionY + cellSize / 2
            } L ${arrayStartX - 3} ${arraySectionY + cellSize / 2}`
          )
          .attr("stroke", "#0284c7")
          .attr("stroke-width", 1.5)
          .attr("fill", "none")
          .attr("marker-end", "url(#array-arrow)");
      }
      pagePositions["array_ref"] = {
        x: arrayRefBoxX,
        y: arraySectionY,
        width: arrayRefBoxWidth,
        height: cellSize,
        value: effectiveArrayAddress,
      };
    }

    // 4. Draw array cells only if displayCapacity > 0
    if (displayCapacity > 0) {
      const arrayCells = contentGroup.append("g").attr("class", "array-cells");
      for (let i = 0; i < displayCapacity; i++) {
        const x = arrayStartX + i * cellSize;
        const y = arraySectionY;
        arrayCells
          .append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", cellSize)
          .attr("height", cellSize)
          .attr(
            "fill",
            i < sizeFromInstanceVars
              ? styles.array.fill
              : styles.array.unusedFill
          )
          .attr("stroke", styles.array.stroke)
          .attr("stroke-width", 1)
          .attr("rx", 4);
        arrayCells
          .append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", cellSize)
          .attr("height", 25)
          .attr("fill", "#94a3b8")
          .attr("fill-opacity", 0.3)
          .attr("stroke", "none")
          .attr("rx", 4)
          .attr("ry", 0);
        arrayCells
          .append("text")
          .attr("x", x + cellSize / 2)
          .attr("y", y + 17)
          .attr("text-anchor", "middle")
          .attr("font-size", "11px")
          .attr("font-weight", "bold")
          .attr("fill", "#475569")
          .text(i);
        arrayCells
          .append("line")
          .attr("x1", x)
          .attr("y1", y + 25)
          .attr("x2", x + cellSize)
          .attr("y2", y + 25)
          .attr("stroke", styles.array.stroke)
          .attr("stroke-width", 1);
        if (i < arrayElements.length) {
          const value = arrayElements[i];
          const isRef = isAddress(value);
          arrayCells
            .append("text")
            .attr("x", x + cellSize / 2)
            .attr("y", y + cellSize / 2 + 10)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("fill", isRef ? "#0284c7" : "#0f172a")
            .text(
              value !== undefined && value !== null ? String(value) : "null"
            );
          pagePositions[`array_cell_${i}`] = {
            x: x,
            y: y,
            width: cellSize,
            height: cellSize,
            value: value,
          };
        }
      }
    } else if (hasArrayObjectToDisplay) {
      // arrayAddress exists, but displayCapacity is 0 (empty array object)
      contentGroup
        .append("text")
        .attr("x", arrayStartX)
        .attr("y", arraySectionY + cellSize / 2)
        .attr("text-anchor", "start")
        .attr("font-style", "italic")
        .attr("fill", "#6b7280")
        .text("(empty array structure)");
    }

    // 5. Size indicator removed

    // 6. Draw connections
    const connectionsGroup = contentGroup
      .append("g")
      .attr("class", "connections");
    const connections = [];
    const isValidAddress = (addr) =>
      addr && addr !== "null" && addr !== "0x0" && addr in addressObjectMap;

    Object.entries(localVariables).forEach(([key, value]) => {
      if (isAddress(value)) {
        if (value === effectiveArrayAddress)
          connections.push({
            source: `local_${key}`,
            target: "array_ref",
            type: "reference",
          });
        else if (isValidAddress(value) && pagePositions[value])
          connections.push({
            source: `local_${key}`,
            target: value,
            type: "reference",
          });
      }
    });
    Object.entries(instanceVariables).forEach(([key, value]) => {
      if (isAddress(value) || key === "array") {
        if (value === effectiveArrayAddress || key === "array")
          connections.push({
            source: `instance_${key}`,
            target: "array_ref",
            type: "reference",
          });
        else if (isValidAddress(value) && pagePositions[value])
          connections.push({
            source: `instance_${key}`,
            target: value,
            type: "reference",
          });
      }
    });
    for (let i = 0; i < arrayElements.length; i++) {
      const value = arrayElements[i];
      if (isAddress(value) && isValidAddress(value) && pagePositions[value])
        connections.push({
          source: `array_cell_${i}`,
          target: value,
          type: "reference",
        });
    }

    const getConnectionPoints = (sourceNode, targetNode) => {
      const source = pagePositions[sourceNode];
      const target = pagePositions[targetNode];
      if (!source || !target) return { sourcePoint: null, targetPoint: null };
      let sp, tp;

      // Source points are always from the right side of variable/ref boxes for this layout
      sp = { x: source.x + source.width, y: source.y + source.height / 2 };
      if (sourceNode.startsWith("array_cell_")) {
        // Except for array cells, from bottom
        sp = { x: source.x + source.width / 2, y: source.y + source.height };
      }

      // Target points
      if (targetNode === "array_ref") {
        // To left of array_ref box
        tp = { x: target.x, y: target.y + target.height / 2 };
      } else if (targetNode.startsWith("array_cell_")) {
        // To top-center of cell
        tp = { x: target.x + target.width / 2, y: target.y };
      } else if (pagePositions[targetNode]) {
        // To left of a generic box (another var box for example)
        tp = { x: target.x, y: target.y + target.height / 2 };
      } else {
        // Default center (should not happen often with this layout)
        tp = {
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
        };
      }
      return { sourcePoint: sp, targetPoint: tp };
    };

    connections.forEach((conn) => {
      const points = getConnectionPoints(conn.source, conn.target);
      if (!points.sourcePoint || !points.targetPoint) return;
      const path = generateCurvedPath(points.sourcePoint, points.targetPoint);
      connectionsGroup
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", styles.connection.varRefColor)
        .attr("stroke-width", styles.connection.width)
        .attr("marker-end", "url(#var-ref-arrow)")
        .attr("stroke-opacity", 0.8)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
    });
  };

  // Effect to monitor snapshot index changes and update the visualization
  useEffect(() => {
    // Only run this effect when we're in snapshot mode and have a valid operation
    if (snapshotMode && operations[currentHistoryIndex]) {
      const operation = operations[currentHistoryIndex];

      // Make sure we have snapshots and a valid index
      if (
        operation.memorySnapshots &&
        currentSnapshotIndex >= 0 &&
        currentSnapshotIndex < operation.memorySnapshots.length
      ) {
        const snapshot = operation.memorySnapshots[currentSnapshotIndex];
        console.log(
          `Snapshot navigation: Rendering snapshot ${
            currentSnapshotIndex + 1
          }/${operation.memorySnapshots.length}`
        );

        // Update visualization state
        setVisualState({
          operationIndex: currentHistoryIndex,
          snapshotIndex: currentSnapshotIndex,
          operation: operation,
          snapshot: snapshot,
        });

        // Directly render the visualization with the current snapshot
        renderVisualization(operation, snapshot);
      }
    }
  }, [
    currentSnapshotIndex,
    snapshotMode,
    operations,
    currentHistoryIndex,
    renderVisualization,
  ]);

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

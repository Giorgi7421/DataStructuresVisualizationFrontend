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
      // Revised for ERD-style orthogonal connector with ROUNDED corners: Down, Horizontal, Up
      const verticalDipFromSource = 30;
      const cornerRadius = 8; // Increased radius for more visible rounding

      let path = `M ${source.x} ${source.y}`;
      const firstVerticalY = source.y + verticalDipFromSource;
      const targetHorizontalSign = Math.sign(target.x - source.x);

      // Segment 1: Go down to the start of the first curve
      path += ` V ${firstVerticalY - cornerRadius}`;
      // Corner 1: Rounded turn from vertical (down) to horizontal (right or left)
      path += ` Q ${source.x} ${firstVerticalY}, ${
        source.x + targetHorizontalSign * cornerRadius
      } ${firstVerticalY}`;
      // Segment 2: Go horizontal towards the start of the second curve
      path += ` H ${target.x - targetHorizontalSign * cornerRadius}`;
      // Corner 2: Rounded turn from horizontal to vertical (up)
      path += ` Q ${target.x} ${firstVerticalY}, ${target.x} ${
        firstVerticalY - cornerRadius
      }`;
      // Segment 3: Go vertical up to target's Y
      path += ` V ${target.y}`;

      console.log("[generateCurvedPath] longArcDown Data (Rounded):", {
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        generatedPath: path,
      });
      return path;
    } else if (pathType === "arcUpHigh") {
      // New: Force a path that arcs upwards significantly
      const arcHeight = Math.max(80, distanceTotal * 0.3, Math.abs(dx) * 0.25); // Increased arc height
      cp1x = source.x + dx * 0.3;
      cp1y = source.y - arcHeight;
      cp2x = target.x - dx * 0.3;
      cp2y = target.y - arcHeight;
    } else if (pathType === "orthogonalNext") {
      // ERD-style for node-to-node next pointers: H, V, H
      const horizontalOffset = 20; // Use a fixed horizontal offset
      let path = `M ${source.x} ${source.y}`;
      // Segment 1: Horizontal line out from source
      path += ` H ${source.x + horizontalOffset}`;
      // Segment 2: Vertical line to align with target Y
      path += ` V ${target.y}`;
      // Segment 3: Horizontal line into target
      path += ` H ${target.x}`;
      console.log("[generateCurvedPath] orthogonalNext Data:", {
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        generatedPath: path,
      });
      return path;
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

  // *** NEW Universal Orthogonal Path Generator ***
  const generateOrthogonalPath = (
    source,
    target,
    cornerRadius = 5,
    hint = "auto",
    initialOffset = 30, // New parameter for initial segment length
    detourTargetY = null // New parameter for V-H-V detour
  ) => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;

    let path = `M ${source.x} ${source.y}`;
    let orientation = hint;

    // Basic orientation heuristic (can be refined)
    if (hint === "auto") {
      // If target is mostly horizontal from source, prefer H-V-H
      // If target is mostly vertical, or if hint='VHV' prefer V-H-V
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        orientation = "H-V-H";
      } else {
        orientation = "V-H-V";
      }
      // Special case override: if source/target suggests a bottom-to-bottom connection (like 'end' pointer)
      // This is tricky without knowing box heights, rely on explicit hint for now.
    }

    if (orientation === "H-V-H") {
      // Horizontal -> Vertical -> Horizontal
      // const midX = source.x + dx / 2; // Old midpoint
      const sourceSignX = Math.sign(dx) || 1; // Ensure sign is not 0 if dx is 0
      const targetSignY = Math.sign(dy) || 1; // Ensure sign is not 0 if dy is 0

      const turn1X = source.x + sourceSignX * initialOffset;
      const turn1Y = source.y;
      const turn2X = turn1X; // Vertical segment shares this X
      const turn2Y = target.y;

      // Ensure radius isn't larger than segment length
      const effectiveRadiusH1 = Math.min(
        cornerRadius,
        Math.abs(turn1X - source.x)
      );
      const effectiveRadiusV = Math.min(
        cornerRadius,
        Math.abs(turn2Y - turn1Y)
      );
      const effectiveRadiusH2 = Math.min(
        cornerRadius,
        Math.abs(target.x - turn2X)
      );

      // Segment 1: Horizontal from source to turn1X (before corner)
      path += ` H ${turn1X - sourceSignX * effectiveRadiusH1}`;
      // Corner 1: Rounded turn from horizontal to vertical
      path += ` Q ${turn1X} ${turn1Y}, ${turn1X} ${
        turn1Y + targetSignY * effectiveRadiusV
      }`;
      // Segment 2: Vertical from turn1Y to turn2Y (before corner)
      path += ` V ${turn2Y - targetSignY * effectiveRadiusV}`;
      // Corner 2: Rounded turn from vertical to horizontal
      path += ` Q ${turn2X} ${turn2Y}, ${
        turn2X + sourceSignX * effectiveRadiusH2
      } ${turn2Y}`;
      // Segment 3: Horizontal into target X
      path += ` H ${target.x}`;
    } else if (orientation === "V-H-V") {
      // Vertical -> Horizontal -> Vertical
      // const midY = source.y + dy / 2; // Old midpoint
      const sourceSignY = Math.sign(dy) || 1;
      const targetSignX = Math.sign(dx) || 1;

      let turn1Yactual;
      // Check detour condition *first*
      let useDetour = false;
      if (
        detourTargetY !== null &&
        hint === "V-H-V" &&
        detourTargetY > source.y
      ) {
        console.log(
          `[generateOrthogonalPath] V-H-V: Applying detour. SourceY: ${source.y}, DetourTargetY: ${detourTargetY}`
        );
        turn1Yactual = detourTargetY; // Use the detour Y
        useDetour = true;
      } else {
        // If no valid detour, calculate based on initial offset
        turn1Yactual = source.y + sourceSignY * initialOffset;
        if (detourTargetY !== null && hint === "V-H-V") {
          // Log if detour was provided but not applied
          console.log(
            `[generateOrthogonalPath] V-H-V: DetourY (${detourTargetY}) provided but NOT applied (condition detourTargetY > source.y failed). SourceY: ${source.y}`
          );
        }
      }

      const turn1X = source.x;
      // const turn1Y = source.y + sourceSignY * initialOffset; // Old way
      const turn1Y = turn1Yactual; // Use the correctly determined Y for the horizontal segment
      const turn2X = target.x;
      const turn2Y = turn1Y; // Horizontal segment shares this Y

      // Determine local signs for vertical segments, especially important for detours
      const signV1 = useDetour ? 1 : sourceSignY; // If detouring down, first segment is always down (+1)
      const signV2 = useDetour
        ? Math.sign(target.y - turn1Y) || -1
        : sourceSignY; // If detouring, second segment direction is from detourY to targetY

      // Ensure radius isn't larger than segment length
      const effectiveRadiusV1 = Math.min(
        cornerRadius,
        Math.abs(turn1Y - source.y)
      );
      const effectiveRadiusH = Math.min(
        cornerRadius,
        Math.abs(turn2X - turn1X)
      );
      const effectiveRadiusV2 = Math.min(
        cornerRadius,
        Math.abs(target.y - turn2Y)
      );

      // Segment 1: Vertical from source to turn1Y (before corner)
      path += ` V ${turn1Y - signV1 * effectiveRadiusV1}`;
      // Corner 1: Rounded turn from vertical to horizontal
      path += ` Q ${turn1X} ${turn1Y}, ${
        turn1X + targetSignX * effectiveRadiusH
      } ${turn1Y}`;
      // Segment 2: Horizontal from turn1X to turn2X (before corner)
      path += ` H ${turn2X - targetSignX * effectiveRadiusH}`;
      // Corner 2: Rounded turn from horizontal to vertical
      path += ` Q ${turn2X} ${turn2Y}, ${turn2X} ${
        turn2Y + signV2 * effectiveRadiusV2
      }`;
      // Segment 3: Vertical into target Y
      path += ` V ${target.y}`;

      if (useDetour && orientation === "V-H-V") {
        console.log("[generateOrthogonalPath] V-H-V DETOUR path constructed:");
        console.log(
          `  Source: (${source.x}, ${source.y}), Target: (${target.x}, ${target.y}), DetourY: ${turn1Yactual}`
        );
        console.log(`  Path: ${path}`);
      }
    } else if (orientation === "H-V_to_target_top") {
      // Horizontal -> Vertical (directly to target top-center)
      const sourceSignX = Math.sign(dx) || 1;
      const targetSignY = Math.sign(dy) || 1; // Should typically be 1 (down) or -1 (up)

      // First turn X-coordinate is the target's X (top-center)
      const turn1X = target.x;
      const turn1Y = source.y; // Horizontal segment is at source's Y

      const effectiveRadiusH1 = Math.min(
        cornerRadius,
        Math.abs(turn1X - source.x)
      );
      const effectiveRadiusV = Math.min(
        cornerRadius,
        Math.abs(target.y - turn1Y) // Vertical segment length to target.y
      );

      // Segment 1: Horizontal from source to turn1X (before corner)
      path += ` H ${turn1X - sourceSignX * effectiveRadiusH1}`;
      // Corner 1: Rounded turn from horizontal to vertical
      path += ` Q ${turn1X} ${turn1Y}, ${turn1X} ${
        turn1Y + targetSignY * effectiveRadiusV
      }`;
      // Segment 2: Vertical from turn1Y to target.y (ends path)
      path += ` V ${target.y}`;

      console.log(
        "[generateOrthogonalPath] H-V_to_target_top path constructed:"
      );
      console.log(
        `  Source: (${source.x}, ${source.y}), Target: (${target.x}, ${target.y})`
      );
      console.log(`  Path: ${path}`);
    } else {
      // Fallback to straight line if orientation is unknown
      console.warn(
        `[generateOrthogonalPath] Unknown orientation: ${orientation}. Drawing straight line.`
      );
      path += ` L ${target.x} ${target.y}`;
    }

    console.log(
      `[generateOrthogonalPath] Hint: ${hint}, Orientation: ${orientation}, Path: ${path}`
    );
    return path;
  };

  // *** NEW Hardcoded Path Generator for 'end' pointer ***
  const generateHardcodedEndPointerPath = (
    sourceConnectionPoint, // {x, y} - the actual point on the left of the 'end' field
    targetNodePosition, // {x, y, width, height} - of the last node
    verticalDrop = 75, // How much to go down initially (increased from 50)
    horizontalClearance = 20, // How much to go left initially from source before main rightward travel
    cornerRadius = 8
  ) => {
    let path = `M ${sourceConnectionPoint.x} ${sourceConnectionPoint.y}`;
    const p0 = sourceConnectionPoint;

    // --- Sharp Corners ---

    // 1. Go left a bit initially
    const p1x = p0.x - horizontalClearance;
    path += ` H ${p1x}`;

    // 2. Go down (main vertical drop)
    const p2y = p0.y + verticalDrop;
    path += ` V ${p2y}`;

    // 3. Go right to align under the target node's center
    const targetCenterX = targetNodePosition.x + targetNodePosition.width / 2;
    path += ` H ${targetCenterX}`;

    // 4. Go up to meet the bottom-center of the target node
    const targetAttachY = targetNodePosition.y + targetNodePosition.height;
    path += ` V ${targetAttachY}`;

    console.log("[generateHardcodedEndPointerPath - SHARP] Constructed:", {
      path,
      p0,
      p1x,
      p2y,
      targetCenterX,
      targetAttachY,
      verticalDrop,
      horizontalClearance,
    });
    return path;
  };

  // *** NEW Smart Detour Path Generator (for specific cases like 'end' pointer) ***
  const generateSmartDetourPath = (
    sourcePoint,
    targetNodePos,
    standoff = 30,
    cornerRadius = 8
  ) => {
    let path = `M ${sourcePoint.x} ${sourcePoint.y}`;

    // This version is specifically for a V-H-V path, starting by going DOWN.
    // sourcePoint: actual starting coordinate {x, y}
    // targetNodePos: {x, y, width, height} of the target node
    // standoff: how far down the first vertical segment goes to establish the horizontal path level.

    const horizontalPathY = sourcePoint.y + standoff; // Y-level of the main horizontal segment
    const sourceSegmentEndX = sourcePoint.x;
    const sourceSegmentEndY = horizontalPathY;

    const targetAttachX = targetNodePos.x + targetNodePos.width / 2; // Attach to bottom-center of target node
    const targetAttachY = targetNodePos.y + targetNodePos.height;

    // Intermediate points for the horizontal segment
    const horizontalSegmentStartX = sourcePoint.x;
    const horizontalSegmentEndX = targetAttachX;

    // Signs for corner radius calculations
    const signY_sourceToHorizontal =
      Math.sign(horizontalPathY - sourcePoint.y) || 1; // Should be +1 (down)
    const signX_horizontal =
      Math.sign(horizontalSegmentEndX - horizontalSegmentStartX) || 1;
    const signY_horizontalToTarget =
      Math.sign(targetAttachY - horizontalPathY) || 1; // From horizontal to target

    // Effective radii, ensuring they are not larger than segment lengths
    const rV1 = Math.min(
      cornerRadius,
      Math.abs(horizontalPathY - sourcePoint.y)
    );
    const rH = Math.min(
      cornerRadius,
      Math.abs(horizontalSegmentEndX - horizontalSegmentStartX)
    );
    const rV2 = Math.min(
      cornerRadius,
      Math.abs(targetAttachY - horizontalPathY)
    );

    // 1. Initial Vertical Segment (Down)
    path += ` V ${horizontalPathY - signY_sourceToHorizontal * rV1}`;

    // 2. First Corner (to Horizontal)
    path += ` Q ${sourceSegmentEndX} ${horizontalPathY}, ${
      horizontalSegmentStartX + signX_horizontal * rH
    } ${horizontalPathY}`;

    // 3. Horizontal Segment
    path += ` H ${horizontalSegmentEndX - signX_horizontal * rH}`;

    // 4. Second Corner (to Vertical to reach target)
    path += ` Q ${horizontalSegmentEndX} ${horizontalPathY}, ${horizontalSegmentEndX} ${
      horizontalPathY + signY_horizontalToTarget * rV2
    }`;

    // 5. Final Vertical Segment (to Target)
    path += ` V ${targetAttachY}`;

    console.log("[generateSmartDetourPath] Path constructed:", {
      path,
      sourcePoint,
      targetNodeX: targetNodePos.x,
      targetNodeY: targetNodePos.y,
      targetNodeWidth: targetNodePos.width,
      targetNodeHeight: targetNodePos.height,
      standoff,
      horizontalPathY,
      targetAttachX,
      targetAttachY,
    });

    return path;
  };

  // *** NEW REUSABLE HELPER FUNCTION (Step 1: Definition Only) ***
  // Helper function to render a generic variable box (for local or instance variables)
  const renderVariableBox = (
    group, // D3 group to append to
    title, // String: "Local Variables", "Instance Variables"
    variables, // Object: { varName: value, ... }
    x, // Number: top-left X coordinate
    y, // Number: top-left Y coordinate
    styleConfig, // Object: styling parameters (widths, heights, colors, padding)
    type, // String: "local" or "instance" (for connection point naming)
    isAddressFn // Function: checks if a value is an address (e.g., isAddress)
  ) => {
    // ... (implementation of renderVariableBox as previously defined) ...
    // (Assuming the full body of renderVariableBox is here)
    const boxGroup = group
      .append("g")
      .attr("class", `${type}-variables-box-group`);
    const connectionPoints = [];
    const defaultConfig = {
      width: 180,
      headerHeight: 25,
      fieldHeight: 25,
      fieldSpacing: 5,
      padding: 10,
      fill: "#f9f9f9",
      stroke: "#cccccc",
      titleFill: "#eeeeee",
      titleStroke: "#cccccc",
      titleTextFill: "#333333",
      keyTextFill: "#333333",
      valueTextFill: "#333333",
      addressValueFill: "#0000cc",
      fieldRectFill: "#ffffff",
      fieldRectStroke: "#dddddd",
      fontSize: "12px",
      titleFontSize: "13px",
    };
    const s = { ...defaultConfig, ...styleConfig };
    const varCount = Object.keys(variables).length;
    const contentHeight =
      varCount * s.fieldHeight +
      (varCount > 0 ? (varCount - 1) * s.fieldSpacing : 0);
    const boxHeight =
      s.headerHeight +
      (varCount > 0 ? s.padding * 2 + contentHeight : s.padding);
    boxGroup
      .append("rect")
      .attr("x", x)
      .attr("y", y)
      .attr("width", s.width)
      .attr("height", boxHeight)
      .attr("fill", s.fill)
      .attr("stroke", s.stroke)
      .attr("stroke-width", 1)
      .attr("rx", 5);
    boxGroup
      .append("rect")
      .attr("x", x)
      .attr("y", y)
      .attr("width", s.width)
      .attr("height", s.headerHeight)
      .attr("fill", s.titleFill)
      .attr(
        "fill-opacity",
        s.titleFillOpacity !== undefined ? s.titleFillOpacity : 1
      )
      .attr("stroke", s.titleStroke || s.stroke)
      .attr("stroke-width", 1)
      .attr("rx", 5)
      .attr("ry", 0);
    boxGroup
      .append("text")
      .attr("x", x + s.width / 2)
      .attr("y", y + s.headerHeight / 2 + parseFloat(s.titleFontSize) / 3)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", s.titleFontSize)
      .attr("fill", s.titleTextFill)
      .text(title);
    if (varCount > 0) {
      boxGroup
        .append("line")
        .attr("x1", x)
        .attr("y1", y + s.headerHeight)
        .attr("x2", x + s.width)
        .attr("y2", y + s.headerHeight)
        .attr("stroke", s.titleStroke || s.stroke)
        .attr("stroke-width", 0.5);
    }
    let fieldCurrentY = y + s.headerHeight + s.padding;
    Object.entries(variables).forEach(([key, value]) => {
      const fieldGroup = boxGroup.append("g").attr("class", `var-field-${key}`);
      if (s.fieldRectFill || s.fieldRectStroke) {
        fieldGroup
          .append("rect")
          .attr("x", x + s.padding / 2)
          .attr("y", fieldCurrentY - s.padding / 2)
          .attr("width", s.width - s.padding)
          .attr("height", s.fieldHeight)
          .attr(
            "fill",
            s.fieldRectFill === "none" ? "transparent" : s.fieldRectFill
          )
          .attr(
            "stroke",
            s.fieldRectStroke === "none" ? "transparent" : s.fieldRectStroke
          )
          .attr("stroke-width", 1)
          .attr("rx", 3);
      }
      fieldGroup
        .append("text")
        .attr("x", x + s.padding)
        .attr(
          "y",
          fieldCurrentY + s.fieldHeight / 2 - parseFloat(s.fontSize) / 3 + 2
        )
        .attr("font-size", s.fontSize)
        .attr("font-weight", "bold")
        .attr("fill", s.keyTextFill)
        .text(`${key}:`);
      const stringValue = String(value);
      const isAddr = isAddressFn(stringValue);
      fieldGroup
        .append("text")
        .attr("x", x + s.width - s.padding)
        .attr(
          "y",
          fieldCurrentY + s.fieldHeight / 2 - parseFloat(s.fontSize) / 3 + 2
        )
        .attr("text-anchor", "end")
        .attr("font-size", s.fontSize)
        .attr("font-weight", isAddr ? "bold" : "normal")
        .attr("fill", isAddr ? s.addressValueFill : s.valueTextFill)
        .text(stringValue);
      if (isAddr) {
        const connectionData = {
          sourceName: `${type}-${key}`,
          sourceCoords: {
            // This is the RIGHT side exit point
            x: x + s.width,
            y:
              fieldCurrentY +
              s.fieldHeight / 2 -
              parseFloat(s.fontSize) / 3 +
              2 -
              s.padding / 2 +
              s.fieldHeight / 2,
          },
          targetAddress: stringValue,
          type: type,
          varName: key,
        };

        if (type === "instance") {
          connectionData.leftSourceCoords = {
            x: x, // Left edge of the var box
            y: connectionData.sourceCoords.y, // Same Y as the right side exit
          };
        }
        connectionPoints.push(connectionData);
      }
      fieldCurrentY += s.fieldHeight + s.fieldSpacing;
    });
    return { height: boxHeight, connectionPoints: connectionPoints };
  };

  // *** NEW REUSABLE HELPER FUNCTION (Step 3: Definition Only) ***
  // Helper function to define standard arrowhead markers in the SVG <defs>
  // Placed immediately AFTER renderVariableBox and BEFORE renderWebBrowserVisualization
  const defineArrowheads = (defs, globalStyles) => {
    const createMarker = (id, color, size = 8, refX = 8) => {
      if (defs.select(`#${id}`).empty()) {
        defs
          .append("marker")
          .attr("id", id)
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", refX)
          .attr("refY", 0)
          .attr("markerWidth", size)
          .attr("markerHeight", size)
          .attr("orient", "auto-start-reverse")
          .append("path")
          .attr("d", "M0,-5L10,0L0,5")
          .attr("fill", color);
      }
    };

    const connStyles = globalStyles?.connection || {};
    const defaultBlue = "#0284c7";
    const defaultDarkGray = "#334155";
    const defaultSlate = "#64748b";
    const defaultRed = "#ef4444";
    const defaultGreen = "#166534";

    createMarker("array-arrow", connStyles.arrayArrowColor || defaultBlue);
    createMarker("var-ref-arrow", connStyles.varRefColor || defaultDarkGray);
    createMarker("next-arrow", connStyles.nextColor || defaultBlue);
    createMarker("prev-arrow", connStyles.prevColor || defaultRed);
    createMarker("current-arrow", connStyles.currentColor || defaultGreen);
    createMarker(
      "ll-next-arrow",
      connStyles.llNextColor || connStyles.nextColor || defaultBlue,
      7,
      7
    );
    createMarker(
      "ll-instance-var-arrow",
      connStyles.llInstanceVarColor ||
        connStyles.varRefColor ||
        defaultDarkGray,
      7,
      7
    );
  };

  // *** NEW REUSABLE HELPER FUNCTION (Step 6: Definition Only) ***
  // Helper function to render a generic node (like a LL node or Web Browser page)
  const renderGenericNode = (
    group, // D3 group to append the node elements to
    nodeSpec, // Object: { x, y, address, title?, fields: {key:val,...}, isCurrent?, isIsolated?, style? }
    styleConfig, // Object: styling parameters (widths, heights, colors, padding etc)
    positionsMap, // Object: map where position data {x, y, width, height} will be stored, keyed by address
    isAddressFn, // Function: checks if a value is an address
    truncateAddrFn // Function: truncates address for display
  ) => {
    console.log(
      `[renderGenericNode] START processing node: ${nodeSpec?.address}`
    );
    // Default styles and validation
    const defaultConfig = {
      width: 180,
      headerHeight: 25,
      fieldHeight: 25,
      fieldSpacing: 5,
      padding: 10,
      fill: "#ffffff",
      stroke: "#cccccc",
      titleFill: "#eeeeee",
      titleStroke: "#cccccc",
      titleTextFill: "#333333",
      keyTextFill: "#334155",
      valueTextFill: "#334155",
      addressTextFill: "#0ea5e9", // Use a distinct address color
      fieldRectFill: "none",
      fieldRectStroke: "#e2e8f0",
      fontSize: "12px",
      titleFontSize: "13px",
      currentFill: "#f0f9ff",
      currentStroke: "#0284c7",
      currentStrokeWidth: 1.5, // Light blue theme for current
      isolatedFill: "#fefce8",
      isolatedStroke: "#ca8a04",
      isolatedStrokeWidth: 1.5,
      isolatedDasharray: "4,4", // Yellow theme for isolated
    };
    // Merge default, global styleConfig, and node-specific style overrides
    const s = { ...defaultConfig, ...styleConfig, ...(nodeSpec.style || {}) };
    const { x, y, address, title, fields, isCurrent, isIsolated } = nodeSpec;

    // Calculate overall node height
    const fieldCount = fields ? Object.keys(fields).length : 0;
    const fieldsAreaHeight =
      fieldCount * s.fieldHeight +
      (fieldCount > 0 ? (fieldCount - 1) * s.fieldSpacing : 0);
    // Ensure minimum height for header+padding even if no fields
    const nodeHeight =
      s.headerHeight +
      (fieldCount > 0 ? s.padding * 2 + fieldsAreaHeight : s.padding);

    // Create group for the node, positioned at x, y
    const nodeGroup = group
      .append("g")
      .attr("class", `generic-node ${address}`)
      .attr("transform", `translate(${x}, ${y})`);

    // Draw main node rectangle with conditional styling
    nodeGroup
      .append("rect")
      .attr("class", "node-body")
      .attr("width", s.width)
      .attr("height", nodeHeight)
      .attr(
        "fill",
        isCurrent ? s.currentFill : isIsolated ? s.isolatedFill : s.fill
      )
      .attr(
        "stroke",
        isCurrent ? s.currentStroke : isIsolated ? s.isolatedStroke : s.stroke
      )
      .attr(
        "stroke-width",
        isCurrent
          ? s.currentStrokeWidth
          : isIsolated
          ? s.isolatedStrokeWidth
          : 1
      )
      .attr("stroke-dasharray", isIsolated ? s.isolatedDasharray : "none")
      .attr("rx", 5); // Rounded corners for the main box

    // Draw title bar rectangle with conditional styling
    nodeGroup
      .append("rect")
      .attr("class", "node-header-bg")
      .attr("width", s.width)
      .attr("height", s.headerHeight)
      .attr(
        "fill",
        isCurrent
          ? s.currentStroke
          : isIsolated
          ? s.isolatedStroke
          : s.titleFill
      )
      .attr(
        "fill-opacity",
        isCurrent || isIsolated
          ? 0.3
          : s.titleFillOpacity !== undefined
          ? s.titleFillOpacity
          : 1
      )
      .attr("stroke", "none") // No stroke for the header bg itself, main box provides border
      .attr("rx", 5)
      .attr("ry", 0); // Keep top corners rounded

    // Draw title text (use provided title or truncated address)
    nodeGroup
      .append("text")
      .attr("class", "node-title")
      .attr("x", s.width / 2)
      .attr("y", s.headerHeight / 2 + parseFloat(s.titleFontSize) / 3) // Approx vertical center
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", s.titleFontSize)
      .attr("fill", s.titleTextFill)
      .text(title || truncateAddrFn(address)); // Use provided title or fallback to truncated address

    // Draw divider line below header (only if fields exist)
    if (fieldCount > 0) {
      nodeGroup
        .append("line")
        .attr("class", "header-divider")
        .attr("x1", 0)
        .attr("y1", s.headerHeight)
        .attr("x2", s.width)
        .attr("y2", s.headerHeight)
        .attr("stroke", s.titleStroke || s.stroke)
        .attr("stroke-width", 0.5);
    }

    // Render fields if they exist
    if (fields && fieldCount > 0) {
      let fieldCurrentYOffset = s.headerHeight + s.padding; // Start fields below header + padding
      console.log(
        `[renderGenericNode] Node ${nodeSpec?.address}: Processing ${fieldCount} fields...`
      );
      Object.entries(fields).forEach(([key, value]) => {
        const fieldGroup = nodeGroup
          .append("g")
          .attr("class", `node-field-group-${key}`);
        const fieldY = fieldCurrentYOffset; // Y relative to nodeGroup origin (top-left)

        // Optional field background/border rectangle
        if (s.fieldRectFill !== "none" || s.fieldRectStroke !== "none") {
          fieldGroup
            .append("rect")
            .attr("class", "field-bg")
            .attr("x", s.padding / 2)
            .attr(
              "y",
              fieldY - s.fieldHeight / 2 - s.padding / 2 + s.fieldHeight / 2
            ) // Position background rect around the field content area
            .attr("width", s.width - s.padding)
            .attr("height", s.fieldHeight)
            .attr(
              "fill",
              s.fieldRectFill === "none" ? "transparent" : s.fieldRectFill
            )
            .attr(
              "stroke",
              s.fieldRectStroke === "none" ? "transparent" : s.fieldRectStroke
            )
            .attr("stroke-width", 0.5)
            .attr("rx", 3);
        }

        // Field key text
        fieldGroup
          .append("text")
          .attr("class", "field-key")
          .attr("x", s.padding)
          .attr(
            "y",
            fieldY + s.fieldHeight / 2 - parseFloat(s.fontSize) / 3 + 2
          ) // Approx vert center
          .attr("font-size", s.fontSize)
          .attr("font-weight", "bold")
          .attr("fill", s.keyTextFill)
          .text(`${key}:`);

        // Field value text
        const stringValue = String(value); // Ensure value is string for checks/display
        const isAddr = isAddressFn(stringValue);
        fieldGroup
          .append("text")
          .attr("class", "field-value")
          .attr("x", s.width - s.padding)
          .attr(
            "y",
            fieldY + s.fieldHeight / 2 - parseFloat(s.fontSize) / 3 + 2
          ) // Approx vert center
          .attr("text-anchor", "end")
          .attr("font-size", s.fontSize)
          .attr("font-weight", isAddr ? "bold" : "normal")
          .attr("fill", isAddr ? s.addressTextFill : s.valueTextFill)
          .text(truncateAddrFn(stringValue)); // Use truncateAddress for display

        // Move to Y position for the next field
        fieldCurrentYOffset += s.fieldHeight + s.fieldSpacing;
      });
      console.log(
        `[renderGenericNode] Node ${nodeSpec?.address}: FINISHED processing fields.`
      );
    }

    // Store position and dimensions in the shared map
    if (positionsMap && address) {
      positionsMap[address] = {
        x: x,
        y: y,
        width: s.width,
        height: nodeHeight,
      };
    } else if (!address) {
      console.warn(
        "renderGenericNode called without an address in nodeSpec. Position not stored."
      );
    }
    console.log(
      `[renderGenericNode] END processing node: ${nodeSpec?.address}`
    );
  };

  // Add this new function for web browser visualization
  const renderWebBrowserVisualization = (
    contentGroup, // Changed from container
    width,
    height,
    operation,
    memorySnapshot
  ) => {
    console.log("Rendering Web Browser visualization");

    // Extract data (remains the same)
    let browserData = memorySnapshot || operation.state || {};
    const localVariables = browserData.localVariables || {};
    const instanceVariables = browserData.instanceVariables || {};
    const addressObjectMap = browserData.addressObjectMap || {};
    const currentPageAddress = instanceVariables.current;

    // Adjusted styles for renderGenericNode compatibility
    const styles = {
      page: {
        // Styles for renderGenericNode
        width: 200,
        headerHeight: 25,
        fieldHeight: 25,
        fieldSpacing: 5,
        padding: 10,
        fill: "#ffffff",
        stroke: "#94a3b8",
        titleFill: "#94a3b8",
        titleStroke: "#94a3b8",
        titleTextFill: "#334155",
        keyTextFill: "#334155",
        valueTextFill: "#334155",
        addressTextFill: "#0284c7", // Address color for next/prev
        fieldRectFill: "none",
        fieldRectStroke: "#e2e8f0",
        fontSize: "12px",
        titleFontSize: "13px",
        currentFill: "#f1f5f9",
        currentStroke: "#64748b",
        currentStrokeWidth: 1.5,
        isolatedFill: "#fcf5e5",
        isolatedStroke: "#eab308",
        isolatedStrokeWidth: 1.5,
        isolatedDasharray: "4,4",
      },
      varBox: {
        // Styles for renderVariableBox
        width: 200,
        headerHeight: 25,
        fieldHeight: 25,
        fieldSpacing: 5,
        padding: 10,
        fill: "#ffffff",
        stroke: "#94a3b8",
        titleFill: "#94a3b8",
        titleFillOpacity: 0.3,
        titleStroke: "#94a3b8",
        textFill: "#334155",
        valueTextFill: "#334155",
        addressValueFill: "#0ea5e9",
        fieldRectFill: "white",
        fieldRectStroke: "#e2e8f0",
      },
      connection: {
        // Styles for connections and arrowheads
        stroke: "#64748b",
        width: 1.5,
        nextColor: "#64748b", // Gray used for marker fill
        prevColor: "#64748b", // Gray used for marker fill
        currentColor: "#334155", // Dark gray used for marker fill
      },
    };

    // Use helper to define arrowheads
    let defs = contentGroup.select("defs");
    if (defs.empty()) {
      defs = contentGroup.append("defs");
    }
    defineArrowheads(defs, styles);

    const pagePositions = {}; // Stores positions of ALL elements (nodes and var boxes)
    const allConnections = []; // Stores ALL connection data points

    const firstColX = 50;
    const varBoxTopMargin = 30;
    const varBoxSpacing = 20;

    // Render Local Variables using helper (if not already done)
    let localVarsBottomY = varBoxTopMargin;
    // Assuming renderVariableBox is integrated here from previous steps
    // ... (Call to renderVariableBox for localVariables, updates allConnections and pagePositions) ...
    if (Object.keys(localVariables).length > 0) {
      const localVarsResult = renderVariableBox(
        contentGroup,
        "Local Variables",
        localVariables,
        firstColX,
        varBoxTopMargin,
        styles.varBox,
        "local",
        isAddress
      );
      allConnections.push(...localVarsResult.connectionPoints);
      pagePositions["local_vars_box"] = {
        x: firstColX,
        y: varBoxTopMargin,
        width: styles.varBox.width,
        height: localVarsResult.height,
      };
      localVarsBottomY = varBoxTopMargin + localVarsResult.height;
    } else {
      localVarsBottomY = varBoxTopMargin - varBoxSpacing;
    }

    // Render Instance Variables using helper (if not already done)
    const instanceVarsX = width - styles.varBox.width - 50;
    const instanceVarsStartY = varBoxTopMargin;
    let instanceVarsBottomY = instanceVarsStartY;
    // Assuming renderVariableBox is integrated here from previous steps
    // ... (Call to renderVariableBox for instanceVariables, updates allConnections and pagePositions) ...
    if (Object.keys(instanceVariables).length > 0) {
      const instanceVarsResult = renderVariableBox(
        contentGroup,
        "Instance Variables",
        instanceVariables,
        instanceVarsX,
        instanceVarsStartY,
        styles.varBox,
        "instance",
        isAddress
      );
      allConnections.push(...instanceVarsResult.connectionPoints);
      pagePositions["instance_vars_box"] = {
        x: instanceVarsX,
        y: instanceVarsStartY,
        width: styles.varBox.width,
        height: instanceVarsResult.height,
      };
      instanceVarsBottomY = instanceVarsStartY + instanceVarsResult.height;
    } else {
      instanceVarsBottomY = instanceVarsStartY - varBoxSpacing;
    }

    // --- Prepare Node Specifications ---
    const nodeSpecs = [];
    const processedAddresses = new Set();
    const pageLikeAddresses = Object.keys(addressObjectMap).filter(
      (addr) =>
        addressObjectMap[addr] &&
        typeof addressObjectMap[addr] === "object" &&
        !Array.isArray(addressObjectMap[addr]) &&
        (addressObjectMap[addr].hasOwnProperty("value") ||
          addressObjectMap[addr].hasOwnProperty("url") ||
          addressObjectMap[addr].hasOwnProperty("title"))
    );
    const isValidPageAddress = (addr) =>
      addr && addr !== "null" && addr !== "0x0" && addressObjectMap[addr];

    // Find start address logic (same as before)
    let startAddress =
      instanceVariables.first || instanceVariables.historyStart;
    // ... (rest of the start address finding logic) ...
    if (!isValidPageAddress(startAddress)) {
      for (const addr of pageLikeAddresses) {
        const page = addressObjectMap[addr];
        if (
          page &&
          !isValidPageAddress(page.previousAddress) &&
          isValidPageAddress(page.nextAddress)
        ) {
          startAddress = addr;
          break;
        }
      }
    }
    if (!isValidPageAddress(startAddress)) {
      for (const addr of pageLikeAddresses) {
        const page = addressObjectMap[addr];
        if (page && !isValidPageAddress(page.previousAddress)) {
          startAddress = addr;
          break;
        }
      }
    }
    if (!isValidPageAddress(startAddress) && pageLikeAddresses.length > 0)
      startAddress = pageLikeAddresses[0];

    // Build main chain specs
    let currentLayoutAddr = startAddress;
    let nextX = firstColX + styles.varBox.width + 80;
    const pageChainY = Math.max(localVarsBottomY, instanceVarsBottomY) / 2 + 40; // Try to center vertically between var boxes

    while (
      isValidPageAddress(currentLayoutAddr) &&
      !processedAddresses.has(currentLayoutAddr) &&
      processedAddresses.size < 50
    ) {
      const pageData = addressObjectMap[currentLayoutAddr];
      nodeSpecs.push({
        x: nextX,
        y: pageChainY,
        address: currentLayoutAddr,
        title:
          pageData.title ||
          pageData.url ||
          truncateAddress(currentLayoutAddr, 6), // Use truncateAddress here
        fields: {
          // Key names match what renderGenericNode expects
          value: pageData.value || pageData.url || "N/A",
          prev: pageData.previousAddress || "null", // Pass raw address or null
          next: pageData.nextAddress || "null",
        },
        isCurrent: currentLayoutAddr === currentPageAddress,
        isIsolated: false,
        style: styles.page, // Pass the base page style config
      });
      processedAddresses.add(currentLayoutAddr);
      currentLayoutAddr = pageData.nextAddress;
      nextX += styles.page.width + 50;
    }

    // Build isolated node specs
    let isolatedNodeX = firstColX;
    let isolatedNodeY = Math.max(localVarsBottomY, instanceVarsBottomY) + 80;

    pageLikeAddresses.forEach((addr) => {
      if (!processedAddresses.has(addr)) {
        const pageData = addressObjectMap[addr];
        nodeSpecs.push({
          x: isolatedNodeX,
          y: isolatedNodeY,
          address: addr,
          title: pageData.title || pageData.url || truncateAddress(addr, 6),
          fields: {
            value: pageData.value || pageData.url || "N/A",
            prev: pageData.previousAddress || "null",
            next: pageData.nextAddress || "null",
          },
          isCurrent: addr === currentPageAddress,
          isIsolated: true,
          style: styles.page,
        });
        processedAddresses.add(addr);
        isolatedNodeX += styles.page.width + 50;
        if (isolatedNodeX + styles.page.width > width - 50) {
          isolatedNodeX = firstColX;
          isolatedNodeY += (styles.page.height || 130) + 40; // Use calculated or default height
        }
      }
    });

    // --- Render Nodes using Helper ---
    // REMOVE the old page rendering loop (pageNodes.forEach with d3 appends)
    /*
    pageNodes.forEach((node) => { 
        const pageGroup = container.append("g")... 
        // ... all the rect/text/line appends ...
    });
    */
    // Call renderGenericNode for each prepared spec
    nodeSpecs.forEach((spec) => {
      renderGenericNode(
        contentGroup,
        spec,
        spec.style,
        pagePositions,
        isAddress,
        truncateAddress
      );
    });

    // --- Setup Connections (using allConnections and pagePositions) ---
    // Add connections originating from page nodes (next/prev pointers)
    nodeSpecs.forEach((spec) => {
      const pageData = addressObjectMap[spec.address] || {}; // Get original data again for raw addresses
      if (
        isValidPageAddress(pageData.nextAddress) &&
        pagePositions[pageData.nextAddress]
      ) {
        allConnections.push({
          sourceName: spec.address,
          targetAddress: pageData.nextAddress,
          type: "next",
        });
      }
      if (
        isValidPageAddress(pageData.previousAddress) &&
        pagePositions[pageData.previousAddress]
      ) {
        allConnections.push({
          sourceName: spec.address,
          targetAddress: pageData.previousAddress,
          type: "prev",
        });
      }
    });
    // Note: Connections from var boxes (like 'current') are already in allConnections from renderVariableBox calls

    // --- Render Connections (uses pagePositions populated by renderGenericNode and renderVariableBox) ---
    const connectionsGroup = contentGroup
      .append("g")
      .attr("class", "connections-group");
    allConnections.forEach((conn) => {
      let sourcePoint, targetPoint;
      let markerId = null;
      let color = styles.connection.stroke;
      let pathType = "default";

      // Get source position data
      const sourceBoxPos = pagePositions[conn.sourceName]; // Might be a var box or a node
      const sourceNodePos = pagePositions[conn.sourceName]; // Could be a node

      if (conn.sourceCoords) {
        // Provided by renderVariableBox
        sourcePoint = conn.sourceCoords;
      } else if (sourceNodePos) {
        // Calculate source point for page node field (next/prev)
        // Approx Y pos of fields within the generic node structure
        const headerAndPadding = styles.page.headerHeight + styles.page.padding;
        const fieldMidYOffset =
          conn.type === "next"
            ? headerAndPadding +
              styles.page.fieldHeight +
              styles.page.fieldSpacing +
              styles.page.fieldHeight / 2 // Approx middle of 'next' field
            : headerAndPadding + styles.page.fieldHeight / 2; // Approx middle of 'prev' field (assuming value, prev, next order)

        sourcePoint = {
          x: sourceNodePos.x + (conn.type === "next" ? sourceNodePos.width : 0), // Exit right for next, left for prev
          y: sourceNodePos.y + fieldMidYOffset,
        };
      } else {
        console.warn(
          "WebBrowserViz: Cannot find source position for connection",
          conn
        );
        return;
      }

      // Get target position data (must be a node)
      const targetPosData = pagePositions[conn.targetAddress];
      if (!targetPosData) {
        console.warn(
          "WebBrowserViz: Cannot find target node position for",
          conn.targetAddress,
          conn
        );
        return;
      }

      // Determine target point and connection style based on type
      if (conn.type === "next") {
        targetPoint = {
          x: targetPosData.x,
          y: targetPosData.y + styles.page.headerHeight / 2,
        }; // Target left-middle of header
        markerId = "next-arrow";
        color = styles.connection.nextColor;
      } else if (conn.type === "prev") {
        targetPoint = {
          x: targetPosData.x + targetPosData.width,
          y: targetPosData.y + styles.page.headerHeight / 2,
        }; // Target right-middle of header
        markerId = "prev-arrow";
        color = styles.connection.prevColor;
      } else if (conn.type === "instance" && conn.varName === "current") {
        targetPoint = {
          x: targetPosData.x + targetPosData.width / 2,
          y: targetPosData.y,
        }; // Target top-center of page
        markerId = "current-arrow";
        color = styles.connection.currentColor;
        pathType = "arcUp"; // Make current pointer arc nicely
      } else {
        // Default for other var->address pointers (if any)
        targetPoint = {
          x: targetPosData.x,
          y: targetPosData.y + targetPosData.height / 2,
        }; // Target left-middle
        markerId = "var-ref-arrow";
        color = styles.connection.varRefColor || styles.connection.stroke; // Use varRefColor if defined
      }

      if (sourcePoint && targetPoint) {
        const path = generateCurvedPath(sourcePoint, targetPoint, pathType);
        connectionsGroup
          .append("path")
          .attr("d", path)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", styles.connection.width)
          .attr("marker-end", markerId ? `url(#${markerId})` : null)
          .attr("stroke-opacity", 0.9)
          .attr("stroke-linecap", "round");
      }
    });

    console.log(
      "Finished Web Browser Visualization render using renderGenericNode."
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

    const arrayState = operation.state || {};
    const localVariables = arrayState.localVariables || {};
    const instanceVariables = arrayState.instanceVariables || {};
    const addressObjectMap = arrayState.addressObjectMap || {};

    // Define styles, including a sub-object for the variable box helper
    const styles = {
      array: {
        elementWidth: 60,
        elementHeight: 60,
        fill: "#ffffff",
        unusedFill: "#f8fafc",
        stroke: "#94a3b8",
        textColor: "#334155",
      },
      // Style config object for the renderVariableBox helper
      varBox: {
        width: 200,
        headerHeight: 25,
        fieldHeight: 25,
        fieldSpacing: 5,
        padding: 10,
        fill: "#ffffff",
        stroke: "#94a3b8", // Main box colors
        titleFill: "#e2e8f0",
        titleStroke: "#94a3b8", // Header colors
        titleTextFill: "#334155",
        keyTextFill: "#334155",
        valueTextFill: "#334155", // Text colors
        addressValueFill: "#0ea5e9", // Specific color for address values
        fieldRectFill: "white",
        fieldRectStroke: "#e2e8f0", // Field background/border
        fontSize: "12px",
        titleFontSize: "13px",
      },
      connection: {
        stroke: "#64748b",
        width: 1.5,
        varRefColor: "#334155", // Color for var -> array ref box connections
        arrayArrowColor: "#0284c7", // Color for array ref box -> cell, or cell -> array ref box
      },
    };

    // Define Arrowheads
    // (Assuming defineArrowheads helper will be created and integrated in a later step)
    // For now, keep inline definitions needed by this specific visualization
    let defs = contentGroup.select("defs");
    if (defs.empty()) {
      defs = contentGroup.append("defs");
    }
    // REMOVE the old inline definitions for #array-arrow and #var-ref-arrow
    /*
    if (defs.select("#array-arrow").empty()) {
      defs.append("marker").attr("id", "array-arrow").attr("viewBox", "0 -5 10 10")
          .attr("refX", 8).attr("refY", 0).attr("markerWidth", 8).attr("markerHeight", 8)
          .attr("orient", "auto-start-reverse").append("path").attr("d", "M0,-5L10,0L0,5")
          .attr("fill", styles.connection.arrayArrowColor);
    }
    if (defs.select("#var-ref-arrow").empty()) {
      defs.append("marker").attr("id", "var-ref-arrow").attr("viewBox", "0 -5 10 10")
          .attr("refX", 8).attr("refY", 0).attr("markerWidth", 8).attr("markerHeight", 8)
          .attr("orient", "auto-start-reverse").append("path").attr("d", "M0,-5L10,0L0,5")
          .attr("fill", styles.connection.varRefColor);
    }
    */
    // Call the helper function to define all standard arrowheads
    defineArrowheads(defs, styles);

    // Determine the array to visualize (existing logic)
    let effectiveArrayAddress = null;
    let arrayObjectInMap = null;
    const ivArrayAddress = instanceVariables.array;
    if (
      ivArrayAddress &&
      addressObjectMap[ivArrayAddress] &&
      Array.isArray(addressObjectMap[ivArrayAddress])
    ) {
      effectiveArrayAddress = ivArrayAddress;
      arrayObjectInMap = addressObjectMap[ivArrayAddress];
    } else {
      const candidateArrays = Object.entries(addressObjectMap).filter(
        ([addr, obj]) => Array.isArray(obj)
      );
      if (candidateArrays.length === 1) {
        effectiveArrayAddress = candidateArrays[0][0];
        arrayObjectInMap = candidateArrays[0][1];
      } else {
        console.warn("ArrayViz: Cannot uniquely determine array to display.");
      }
    }
    const sizeFromInstanceVars =
      instanceVariables.count ?? instanceVariables.size ?? 0;
    let arrayElements = arrayObjectInMap ? arrayObjectInMap.slice() : [];
    const hasArrayObjectToDisplay =
      !!effectiveArrayAddress && !!arrayObjectInMap;
    const displayCapacity =
      hasArrayObjectToDisplay && arrayObjectInMap ? arrayObjectInMap.length : 0;

    const pagePositions = {}; // Store positions of ALL rendered elements (var boxes, ref box, cells)
    const allConnections = []; // Store ALL connection data points {sourceName, sourceCoords, targetAddress, type, varName}

    const cellSize = styles.array.elementWidth;
    const firstColX = 50;
    const varBoxTopMargin = 20;
    const varBoxSpacing = 20;

    // --- Use helper for Local Variables ---
    let localVarsBottomY = varBoxTopMargin;
    if (Object.keys(localVariables).length > 0) {
      const localVarsResult = renderVariableBox(
        contentGroup,
        "Local Variables",
        localVariables,
        firstColX,
        varBoxTopMargin,
        styles.varBox,
        "local",
        isAddress
      );
      allConnections.push(...localVarsResult.connectionPoints);
      pagePositions["local_vars_box"] = {
        x: firstColX,
        y: varBoxTopMargin,
        width: styles.varBox.width,
        height: localVarsResult.height,
      };
      localVarsBottomY = varBoxTopMargin + localVarsResult.height;
    } else {
      localVarsBottomY = varBoxTopMargin - varBoxSpacing;
    }

    // --- Use helper for Instance Variables ---
    const instanceVarsStartY = localVarsBottomY + varBoxSpacing;
    if (Object.keys(instanceVariables).length > 0) {
      const instanceVarsResult = renderVariableBox(
        contentGroup,
        "Instance Variables",
        instanceVariables,
        firstColX,
        instanceVarsStartY,
        styles.varBox,
        "instance",
        isAddress
      );
      allConnections.push(...instanceVarsResult.connectionPoints);
      pagePositions["instance_vars_box"] = {
        x: firstColX,
        y: instanceVarsStartY,
        width: styles.varBox.width,
        height: instanceVarsResult.height,
      };
      // instanceVarsBottomY = instanceVarsStartY + instanceVarsResult.height; // Not strictly needed for current layout
    }

    // --- Render Array Ref Box and Array Cells (largely existing logic) ---
    const arrayRefBoxWidth = 110;
    const arrayRefBoxX = firstColX + styles.varBox.width + 50;
    const arrayStartX =
      arrayRefBoxX + (hasArrayObjectToDisplay ? arrayRefBoxWidth + 20 : 0);
    const arraySectionY = varBoxTopMargin;

    if (hasArrayObjectToDisplay) {
      const arrayRefBoxGroup = contentGroup
        .append("g")
        .attr("class", "array-reference-group");
      arrayRefBoxGroup
        .append("rect")
        .attr("x", arrayRefBoxX)
        .attr("y", arraySectionY)
        .attr("width", arrayRefBoxWidth)
        .attr("height", cellSize)
        .attr("fill", "#f0f9ff")
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 1)
        .attr("rx", 4);
      arrayRefBoxGroup
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
      arrayRefBoxGroup
        .append("text")
        .attr("x", arrayRefBoxX + arrayRefBoxWidth / 2)
        .attr("y", arraySectionY + 17)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#334155")
        .text("array");
      arrayRefBoxGroup
        .append("text")
        .attr("x", arrayRefBoxX + arrayRefBoxWidth / 2)
        .attr("y", arraySectionY + 45)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", styles.connection.arrayArrowColor)
        .text(truncateAddress(effectiveArrayAddress));

      pagePositions["array_ref_box"] = {
        x: arrayRefBoxX,
        y: arraySectionY,
        width: arrayRefBoxWidth,
        height: cellSize,
        address: effectiveArrayAddress,
      };

      if (displayCapacity > 0) {
        arrayRefBoxGroup
          .append("path")
          .attr(
            "d",
            `M ${arrayRefBoxX + arrayRefBoxWidth} ${
              arraySectionY + cellSize / 2
            } L ${arrayStartX - 3} ${arraySectionY + cellSize / 2}`
          )
          .attr("stroke", styles.connection.arrayArrowColor)
          .attr("stroke-width", styles.connection.width)
          .attr("fill", "none")
          .attr("marker-end", "url(#array-arrow)");
      }
    }

    if (displayCapacity > 0) {
      const arrayCellsGroup = contentGroup
        .append("g")
        .attr("class", "array-cells-group");
      for (let i = 0; i < displayCapacity; i++) {
        const x = arrayStartX + i * cellSize;
        const y = arraySectionY;
        const cellGroup = arrayCellsGroup
          .append("g")
          .attr("class", `array-cell-${i}-group`);

        cellGroup
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
        cellGroup
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
        cellGroup
          .append("text")
          .attr("x", x + cellSize / 2)
          .attr("y", y + 17)
          .attr("text-anchor", "middle")
          .attr("font-size", "11px")
          .attr("font-weight", "bold")
          .attr("fill", "#475569")
          .text(i);
        cellGroup
          .append("line")
          .attr("x1", x)
          .attr("y1", y + 25)
          .attr("x2", x + cellSize)
          .attr("y2", y + 25)
          .attr("stroke", styles.array.stroke)
          .attr("stroke-width", 0.5);

        pagePositions[`array_cell_${i}`] = {
          x: x,
          y: y,
          width: cellSize,
          height: cellSize,
        };

        if (i < arrayElements.length) {
          const value = arrayElements[i];
          const stringValue = String(value);
          const isRef = isAddress(stringValue);
          cellGroup
            .append("text")
            .attr("x", x + cellSize / 2)
            .attr("y", y + cellSize / 2 + 10)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr(
              "fill",
              isRef ? styles.connection.arrayArrowColor : styles.array.textColor
            )
            .text(
              value !== undefined && value !== null
                ? truncateAddress(stringValue)
                : "null"
            );

          pagePositions[`array_cell_${i}`].value = stringValue; // Store raw value for connection logic

          if (isRef) {
            allConnections.push({
              sourceName: `array_cell_${i}`,
              // sourceCoords will be calculated in the connection loop
              targetAddress: stringValue,
              type: "arrayContentPointer",
            });
          }
        }
      }
    } else if (hasArrayObjectToDisplay) {
      contentGroup
        .append("text")
        .attr("x", arrayStartX)
        .attr("y", arraySectionY + cellSize / 2)
        .attr("text-anchor", "start")
        .attr("font-style", "italic")
        .attr("fill", "#6b7280")
        .text("(empty array structure)");
    }

    // --- Render Connections ---
    const connectionsGroup = contentGroup
      .append("g")
      .attr("class", "connections-group");
    allConnections.forEach((conn) => {
      let sourcePoint, targetPoint;
      let pathType = "default";
      let markerId = null;
      let color = styles.connection.stroke; // Default connection color

      if (conn.sourceCoords) {
        // From renderVariableBox
        sourcePoint = conn.sourceCoords;
      } else if (conn.sourceName && pagePositions[conn.sourceName]) {
        // From array cell
        const sourcePos = pagePositions[conn.sourceName];
        sourcePoint = {
          x: sourcePos.x + sourcePos.width / 2,
          y: sourcePos.y + sourcePos.height,
        }; // Exit bottom-center of cell
      } else {
        console.warn("ArrayViz Connection: Cannot find source point for", conn);
        return;
      }

      // Determine target: must be array_ref_box or another array_cell
      let targetPosData = null;
      if (
        pagePositions["array_ref_box"] &&
        conn.targetAddress === pagePositions["array_ref_box"].address
      ) {
        targetPosData = pagePositions["array_ref_box"];
        targetPoint = {
          x: targetPosData.x,
          y: targetPosData.y + targetPosData.height / 2,
        }; // Target left-middle of ref box
      } else {
        // Is target another cell? (less common for simple array pointers, but possible)
        const targetCellKey = Object.keys(pagePositions).find(
          (key) =>
            key.startsWith("array_cell_") &&
            pagePositions[key].value === conn.targetAddress
        );
        if (targetCellKey) {
          targetPosData = pagePositions[targetCellKey];
          targetPoint = {
            x: targetPosData.x + targetPosData.width / 2,
            y: targetPosData.y,
          }; // Target top-center of cell
        } else {
          console.warn(
            "ArrayViz Connection: Cannot find target position for",
            conn.targetAddress,
            conn
          );
          return;
        }
      }

      // Style based on connection type
      if (conn.type === "instance" || conn.type === "local") {
        // Pointers from var boxes
        markerId = "var-ref-arrow";
        color = styles.connection.varRefColor;
        // Specific path for instance var 'array' if it points to the array_ref_box
        if (
          conn.varName === "array" &&
          targetPosData === pagePositions["array_ref_box"]
        ) {
          // Default path is fine, from right of var box to left of array_ref_box
        } else {
          // Could add other path types here if needed for other var box pointers
        }
      } else if (conn.type === "arrayContentPointer") {
        // Pointer from an array cell
        markerId = "array-arrow";
        color = styles.connection.arrayArrowColor;
        pathType = "arcUp"; // Example: make cell pointers arc slightly
      }

      if (sourcePoint && targetPoint) {
        const path = generateCurvedPath(sourcePoint, targetPoint, pathType);
        connectionsGroup
          .append("path")
          .attr("d", path)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", styles.connection.width)
          .attr("marker-end", markerId ? `url(#${markerId})` : null)
          .attr("stroke-opacity", 0.85)
          .attr("stroke-linecap", "round");
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
      "TOP OF renderLinkedListVisualization. Op:",
      operation,
      "Snap:",
      memorySnapshot
    );

    const state = memorySnapshot || operation.state || {}; // Prioritize snapshot
    const localVariables = state.localVariables || {};
    const instanceVariables = state.instanceVariables || {};
    const addressObjectMap = state.addressObjectMap || {};

    // Define styles, adjusting node styles for renderGenericNode
    const styles = {
      varBox: {
        // Style for renderVariableBox
        width: 200,
        headerHeight: 25,
        fieldHeight: 25,
        fieldSpacing: 5,
        padding: 10,
        fill: "#ffffff",
        stroke: "#94a3b8",
        titleFill: "#94a3b8",
        titleFillOpacity: 0.3,
        titleStroke: "#94a3b8",
        textFill: "#334155",
        valueTextFill: "#334155",
        addressValueFill: "#0ea5e9",
        fieldRectFill: "white",
        fieldRectStroke: "#e2e8f0",
        fontSize: "12px",
        titleFontSize: "13px",
      },
      node: {
        // Styles for renderGenericNode
        width: 180, // Slightly narrower nodes for LL?
        headerHeight: 25,
        fieldHeight: 25,
        fieldSpacing: 5,
        padding: 10,
        fill: "#ffffff",
        stroke: "#94a3b8",
        titleFill: "#94a3b8",
        titleStroke: "#94a3b8",
        titleTextFill: "#334155",
        keyTextFill: "#334155",
        valueTextFill: "#334155",
        addressTextFill: "#0284c7", // Blue for addresses
        fieldRectFill: "none",
        fieldRectStroke: "#e2e8f0", // Use borders for fields
        fontSize: "12px",
        titleFontSize: "13px",
        // No specific current/isolated styles defined here, renderGenericNode defaults will be used if needed
      },
      connection: {
        strokeWidth: 1.5,
        instanceVarColor: "#334155", // Used by defineArrowheads for #ll-instance-var-arrow
        nextColor: "#2563eb", // Used by defineArrowheads for #ll-next-arrow
        // Define marker IDs used in this viz
        llInstanceVarMarkerId: "ll-instance-var-arrow",
        llNextMarkerId: "ll-next-arrow",
      },
      layout: {
        // Layout specific parameters
        nodeSpacingX: 60, // Increased from 40
        varBoxSpacingY: 20,
        nodesStartYOffset: 30, // DEPRECATED by layered layout
        nodesStartXOffset: 60, // Space between var boxes and first node
        layerSpacingY: 120, // NEW: Vertical space between layers
      },
    };

    // Define Arrowheads using helper
    let defs = contentGroup.select("defs");
    if (defs.empty()) {
      defs = contentGroup.append("defs");
    }
    defineArrowheads(defs, styles); // Defines #ll-next-arrow, #ll-instance-var-arrow etc.
    // REMOVE old inline LL arrowhead defs if they still exist here

    const nodePositions = {}; // Stores positions calculated by helpers { x, y, width, height }
    const allConnections = []; // Stores connection data { sourceName?, sourceCoords?, targetAddress, type, varName? }

    const firstColX = 30;
    const varBoxTopMargin = 30;
    // Remove currentY, topLayerBottomY initialization here

    // --- Layer Calculation Prep ---
    let instanceVarsBoxHeight = 0;
    let localVarsBoxHeight = 0;
    const instanceVarsBoxWidth = styles.varBox.width || 180;
    const localVarsBoxWidth = styles.varBox.width || 180;
    const layerSpacingY = styles.layout.layerSpacingY || 120;
    let nodeStartX = firstColX; // Default start for middle layer

    // --- Render TOP LAYER: Instance Variables (Centered) ---
    let topLayerBottomY = varBoxTopMargin; // Start calculation
    if (Object.keys(instanceVariables).length > 0) {
      const instanceVarsX = width / 2 - instanceVarsBoxWidth / 2; // Center the box
      const instanceVarsY = varBoxTopMargin;
      const instanceVarsResult = renderVariableBox(
        contentGroup,
        "Instance Variables",
        instanceVariables,
        instanceVarsX,
        instanceVarsY,
        styles.varBox,
        "instance",
        isAddress
      );
      allConnections.push(...instanceVarsResult.connectionPoints);
      instanceVarsBoxHeight = instanceVarsResult.height;
      nodePositions["instance_vars_box"] = {
        x: instanceVarsX,
        y: instanceVarsY,
        width: instanceVarsBoxWidth,
        height: instanceVarsBoxHeight,
      };
      topLayerBottomY = instanceVarsY + instanceVarsBoxHeight;
      nodeStartX = firstColX; // Can keep nodes starting left even if vars centered
    } else {
      // If no instance vars, top layer doesn't take space
      topLayerBottomY = 0;
    }

    // --- Calculate MIDDLE LAYER Y Position ---
    const middleLayerY =
      topLayerBottomY > 0 ? topLayerBottomY + layerSpacingY : varBoxTopMargin; // Add spacing only if top layer existed

    // --- Prepare Linked List Node Specs (Main Chain) ---
    const nodeSpecs = [];
    const mainListSpecs = []; // Separate array for main list nodes first
    const orphanSpecs = []; // Separate array for orphan nodes
    const visited = new Set();
    const MAX_NODES_TO_RENDER = 50;

    nodeStartX = // Changed 'let nodeStartX =' to 'nodeStartX ='
      firstColX + styles.varBox.width + styles.layout.nodesStartXOffset;
    let nodeStartY = varBoxTopMargin + styles.layout.nodesStartYOffset;
    let currentX = nodeStartX;
    let currentYNode = nodeStartY;

    // Determine starting node address
    let startAddress =
      instanceVariables.start ||
      instanceVariables.head ||
      instanceVariables.front;
    if (
      !startAddress ||
      startAddress === "0x0" ||
      startAddress === "null" ||
      !addressObjectMap[startAddress]
    ) {
      // Find first node in map not pointed to by another node's 'next' (simple heuristic)
      const allNodeAddrs = Object.keys(addressObjectMap).filter(
        (addr) =>
          addressObjectMap[addr] &&
          typeof addressObjectMap[addr] === "object" &&
          !Array.isArray(addressObjectMap[addr])
      );
      const pointedToAddrs = new Set();
      allNodeAddrs.forEach((addr) => {
        const nodeData = addressObjectMap[addr];
        if (
          nodeData &&
          nodeData.nextAddress &&
          nodeData.nextAddress !== "0x0" &&
          nodeData.nextAddress !== "null"
        ) {
          pointedToAddrs.add(nodeData.nextAddress);
        }
      });
      const potentialStarts = allNodeAddrs.filter(
        (addr) => !pointedToAddrs.has(addr)
      );
      if (potentialStarts.length > 0) {
        startAddress = potentialStarts[0]; // Use the first one found
      } else if (allNodeAddrs.length > 0) {
        startAddress = allNodeAddrs[0]; // Fallback if all nodes are pointed to (e.g., circular list)
      }
    }

    let currentAddress = startAddress;
    let nodesProcessedCount = 0;

    // --- Layout MAIN LIST nodes in Middle Layer ---
    let middleLayerMaxNodeHeight = styles.node.height || 100; // Estimate or use config
    currentX = nodeStartX; // Use calculated nodeStartX

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
          `LinkedListViz: Invalid node data for address ${currentAddress}.`
        );
        break;
      }

      // Prepare the spec for renderGenericNode - add to mainListSpecs
      const nodeFields = {};
      if (nodeData.data !== undefined) {
        nodeFields.value = nodeData.data;
      } else if (nodeData.value !== undefined) {
        nodeFields.value = nodeData.value;
      } else {
        nodeFields.value = "N/A"; // Fallback if no value/data field
      }

      if (nodeData.nextAddress !== undefined) {
        nodeFields.next = nodeData.nextAddress;
      } else if (nodeData.next !== undefined) {
        nodeFields.next = nodeData.next;
      } else {
        nodeFields.next = "null"; // Default if no next pointer
      }

      // Optionally add prev if it exists (for potential doubly-linked data)
      if (nodeData.previousAddress !== undefined) {
        nodeFields.prev = nodeData.previousAddress;
      } else if (nodeData.prev !== undefined) {
        nodeFields.prev = nodeData.prev;
      }

      mainListSpecs.push({
        x: currentX,
        y: middleLayerY, // Position node in the middle layer
        address: currentAddress,
        title:
          nodeData.title || nodeData.url || truncateAddress(currentAddress, 6),
        fields: nodeFields, // Use the dynamically created fields object
        isIsolated: false,
        style: styles.node, // Use the defined node style
      });

      // Update max height seen in this layer for bottom layer calculation
      // (Need to estimate or get actual height from renderGenericNode later - tricky chicken/egg)
      // For now, let's assume styles.node.height is representative
      // A better way might be to calculate after rendering, but let's try this first.
      middleLayerMaxNodeHeight = Math.max(
        middleLayerMaxNodeHeight,
        styles.node.height || 100
      );

      // Prepare connection data for this node's 'next' pointer
      if (
        nodeData.nextAddress &&
        nodeData.nextAddress !== "0x0" &&
        nodeData.nextAddress !== "null"
      ) {
        allConnections.push({
          sourceName: currentAddress, // Connection originates from this node
          targetAddress: nodeData.nextAddress,
          type: "ll_next", // Specific type for styling/marker
        });
      }
      // Add connection for 'prev' if doubly linked

      currentX += styles.node.width + styles.layout.nodeSpacingX;
      currentAddress = nodeData.nextAddress;
      nodesProcessedCount++;
    }

    if (nodesProcessedCount === MAX_NODES_TO_RENDER) {
      console.warn("LinkedListViz: Reached max node render limit.");
    }

    console.log(
      "[LinkedListViz] Before rendering MAIN LIST nodes. mainListSpecs:",
      mainListSpecs,
      "nodePositions so far:",
      nodePositions
    );

    // --- Render MAIN LIST Nodes first using Helper ---
    mainListSpecs.forEach((spec) => {
      try {
        renderGenericNode(
          contentGroup,
          spec,
          spec.style,
          nodePositions,
          isAddress,
          truncateAddress
        );
      } catch (e) {
        console.error(
          "[LinkedListViz] Error rendering MAIN LIST node:",
          spec.address,
          e
        );
      }
    });

    console.log("[LinkedListViz] FINISHED rendering MAIN LIST nodes.");

    // --- Calculate BOTTOM LAYER Y Position ---
    const middleLayerBottomY = middleLayerY + middleLayerMaxNodeHeight;
    const bottomLayerStartY = middleLayerBottomY + layerSpacingY;

    // --- Render BOTTOM LAYER Part 1: Local Variables ---
    let currentBottomLayerY = bottomLayerStartY;
    let bottomLayerOrphanStartX = firstColX; // Orphans start left if no local vars
    if (Object.keys(localVariables).length > 0) {
      const localVarsX = width / 2 - localVarsBoxWidth / 2; // Center the local variables box
      const localVarsY = bottomLayerStartY;
      const localVarsResult = renderVariableBox(
        contentGroup,
        "Local Variables",
        localVariables,
        localVarsX,
        localVarsY,
        styles.varBox,
        "local",
        isAddress
      );
      allConnections.push(...localVarsResult.connectionPoints);
      localVarsBoxHeight = localVarsResult.height;
      nodePositions["local_vars_box"] = {
        x: localVarsX,
        y: localVarsY,
        width: localVarsBoxWidth,
        height: localVarsBoxHeight,
      };
      currentBottomLayerY = localVarsY + localVarsBoxHeight; // Update bottom Y based on this box
      bottomLayerOrphanStartX =
        localVarsX + localVarsBoxWidth + (styles.layout.nodeSpacingX || 60); // Start orphans after local vars
    }

    // --- Render BOTTOM LAYER Part 2: Orphan Nodes ---
    let orphanNodeX = bottomLayerOrphanStartX;
    let orphanNodeY = bottomLayerStartY; // Start orphans at same Y as local vars
    let bottomLayerMaxNodeHeight = Math.max(
      styles.node.height || 100,
      localVarsBoxHeight
    ); // Consider local var height for wrapping

    const allPotentialNodeAddresses = Object.keys(addressObjectMap).filter(
      (addr) =>
        addressObjectMap[addr] &&
        typeof addressObjectMap[addr] === "object" &&
        !Array.isArray(addressObjectMap[addr]) &&
        (addressObjectMap[addr].hasOwnProperty("data") ||
          addressObjectMap[addr].hasOwnProperty("value") ||
          addressObjectMap[addr].hasOwnProperty("nextAddress"))
    );

    allPotentialNodeAddresses.forEach((addr) => {
      if (!visited.has(addr)) {
        // If not part of the main chain (already visited)
        const nodeData = addressObjectMap[addr];
        if (!nodeData) return; // Should not happen due to filter, but good check

        const orphanNodeFields = {};
        if (nodeData.data !== undefined) {
          orphanNodeFields.value = nodeData.data;
        } else if (nodeData.value !== undefined) {
          orphanNodeFields.value = nodeData.value;
        } else {
          orphanNodeFields.value = "N/A";
        }

        if (nodeData.nextAddress !== undefined) {
          orphanNodeFields.next = nodeData.nextAddress;
        } else if (nodeData.next !== undefined) {
          orphanNodeFields.next = nodeData.next;
        } else {
          orphanNodeFields.next = "null";
        }

        if (nodeData.previousAddress !== undefined) {
          orphanNodeFields.prev = nodeData.previousAddress;
        } else if (nodeData.prev !== undefined) {
          orphanNodeFields.prev = nodeData.prev;
        }

        orphanSpecs.push({
          x: orphanNodeX,
          y: orphanNodeY, // Position orphan in the bottom layer
          address: addr,
          title: nodeData.title || nodeData.url || truncateAddress(addr, 6),
          fields: orphanNodeFields, // Use the dynamically created fields object
          isIsolated: true, // Mark as isolated for styling by renderGenericNode
          style: styles.node,
        });
        visited.add(addr); // Add to visited to avoid re-processing if map has duplicates somehow

        // Add its 'next' connection to allConnections if it points to a known node
        if (
          nodeData.nextAddress &&
          nodeData.nextAddress !== "0x0" &&
          nodeData.nextAddress !== "null"
        ) {
          allConnections.push({
            sourceName: addr,
            targetAddress: nodeData.nextAddress,
            type: "ll_next_orphan", // Potentially style orphan next pointers differently
          });
        }

        orphanNodeX += (styles.node.width || 180) + styles.layout.nodeSpacingX;
        if (orphanNodeX + (styles.node.width || 180) > width - firstColX) {
          // Wrap to next line
          orphanNodeX = firstColX;
          orphanNodeY += bottomLayerMaxNodeHeight + styles.layout.nodeSpacingX; // Use estimated height + spacing for row wrap
        }
        // Update max height for this layer if needed (less critical than middle layer)
        bottomLayerMaxNodeHeight = Math.max(
          bottomLayerMaxNodeHeight,
          styles.node.height || 100
        );
      }
    });
    // --- END: Logic for Unreferenced/Orphan Nodes ---

    console.log(
      "[LinkedListViz] Before rendering ORPHAN nodes. orphanSpecs:",
      orphanSpecs
    );

    // --- Render ORPHAN Nodes using Helper ---
    orphanSpecs.forEach((spec) => {
      try {
        renderGenericNode(
          contentGroup,
          spec,
          spec.style,
          nodePositions,
          isAddress,
          truncateAddress
        );
      } catch (e) {
        console.error(
          "[LinkedListViz] Error rendering ORPHAN node:",
          spec.address,
          e
        );
      }
    });

    console.log("[LinkedListViz] FINISHED rendering ORPHAN nodes.");

    // --- Render Connections ---
    const connectionsGroup = contentGroup
      .append("g")
      .attr("class", "connections-group");
    allConnections.forEach((conn) => {
      let sourcePoint, targetPoint;
      let path = ""; // Initialize path to empty string
      let markerId = null;
      let color = styles.connection.stroke; // Default stroke
      let pathType = "default";
      let pathOrientationHint = "auto"; // <<< Declare OUTSIDE with a default
      const cornerRadius = styles.connection.cornerRadius || 8; // Define cornerRadius upfront
      let strokeWidth = styles.connection.strokeWidth || 1.5; // Define strokeWidth upfront with default

      // Get source position (must be a var box or a node)
      const sourcePosData = nodePositions[conn.sourceName];
      if (conn.sourceCoords) {
        // From renderVariableBox
        sourcePoint = conn.sourceCoords;
      } else if (sourcePosData && conn.type === "ll_next") {
        // From node's 'next' field
        // Calculate approx middle-right of the 'next' field box based on generic node structure
        const fieldYOffset =
          styles.node.headerHeight +
          styles.node.padding +
          styles.node.fieldHeight +
          styles.node.fieldSpacing +
          styles.node.fieldHeight / 2;
        sourcePoint = {
          x: sourcePosData.x + sourcePosData.width,
          y: sourcePosData.y + fieldYOffset,
        };
      } else if (sourcePosData) {
        // Default exit for other node pointers (e.g. prev)
        // Simple center-left exit for now if not 'next'
        sourcePoint = {
          x: sourcePosData.x,
          y: sourcePosData.y + sourcePosData.height / 2,
        };
      } else {
        console.warn(
          "LL Viz Connection: Cannot find source position for:",
          conn
        );
        return;
      }

      // Get target position (must be a node for ll_next, ll_prev; could be node or var box?)
      const targetPosData = nodePositions[conn.targetAddress];
      if (!targetPosData) {
        console.warn(
          "LL Viz Connection: Cannot find target position for:",
          conn.targetAddress,
          conn
        );
        return;
      }

      // Determine target point and style based on connection type
      if (conn.type === "instance" || conn.type === "local") {
        // From var box
        markerId =
          styles.connection.llInstanceVarMarkerId || "ll-instance-var-arrow";
        color = styles.connection.instanceVarColor; // Default color for instance vars
        // let strokeWidth = styles.connection.strokeWidth || 1.5; // REMOVE: Defined upfront
        pathOrientationHint = "H-V-H"; // Re-assign default for this type

        // Define standard source/target points first
        sourcePoint = conn.sourceCoords; // From renderVariableBox (right edge of field)
        targetPoint = {
          // Target left-middle of node
          x: targetPosData.x,
          y: targetPosData.y + targetPosData.height / 2,
        };

        // Special case for 'end' pointer requires V-H-V
        if (
          conn.varName === "end" &&
          mainListSpecs.length > 0 &&
          targetPosData.address ===
            mainListSpecs[mainListSpecs.length - 1].address
        ) {
          pathOrientationHint = "V-H-V"; // Re-assign for 'end'

          // --- Original sourcePoint & targetPosData for 'end' pointer ---
          if (nodePositions["instance_vars_box"]) {
            // For 'end', the conceptual source is bottom-center of the instance_vars_box for V-H-V path
            // However, generateHardcodedEndPointerPath uses conn.leftSourceCoords which is tied to field's Y.
            // We will use conn.leftSourceCoords for generateHardcodedEndPointerPath as intended.
          } else {
            console.warn(
              "[LinkedListViz] 'end' pointer: Instance vars box position not found! Using default sourcePoint from conn.sourceCoords.",
              conn.sourceCoords
            );
          }

          // *** Use the new generateHardcodedEndPointerPath for 'end' pointer ***
          if (conn.leftSourceCoords) {
            const verticalDropForEnd = 75; // Can be adjusted
            const horizontalClearanceForEnd = 20; // Clearance from var box left edge
            console.log(
              "[LinkedListViz] 'end' pointer using generateHardcodedEndPointerPath. LeftSource:",
              conn.leftSourceCoords,
              "Target Node:",
              targetPosData
            );
            path = generateHardcodedEndPointerPath(
              conn.leftSourceCoords, // This uses the field's Y level, exiting left
              targetPosData,
              verticalDropForEnd,
              horizontalClearanceForEnd,
              cornerRadius
            );
            color = "red";
            strokeWidth = 3;
            connectionsGroup
              .append("circle")
              .attr("cx", conn.leftSourceCoords.x)
              .attr("cy", conn.leftSourceCoords.y)
              .attr("r", 4)
              .attr("fill", "red");
          } else {
            console.error(
              "[LinkedListViz] 'end' pointer missing leftSourceCoords!",
              conn
            );
            path = "";
          }
        } else {
          // New structure for instance and local vars (non-'end')
          if (conn.type === "instance") {
            pathOrientationHint = "H-V_to_target_top";
            sourcePoint = conn.sourceCoords; // Default, refined below
            const instanceBoxPos = nodePositions["instance_vars_box"];
            if (instanceBoxPos && conn.leftSourceCoords) {
              const targetNodeCenterX =
                targetPosData.x + targetPosData.width / 2;
              const instanceBoxCenter =
                instanceBoxPos.x + instanceBoxPos.width / 2;
              if (targetNodeCenterX < instanceBoxCenter) {
                sourcePoint = conn.leftSourceCoords;
              } else {
                // sourcePoint remains conn.sourceCoords (right exit)
              }
            }

            targetPoint = {
              x: targetPosData.x + targetPosData.width / 2,
              y: targetPosData.y, // Corrected: Target very top edge for H-V_to_target_top path
            };

            const tempInitialOffsetInst = 10; // Small default, H-V_to_target_top uses target.x

            console.log(
              `[LinkedListViz] INSTANCE Var '${conn.varName}' CALLING generateOrthogonalPath (H-V_to_target_top):`,
              JSON.stringify(
                {
                  sourcePoint: { x: sourcePoint.x, y: sourcePoint.y },
                  targetPoint: { x: targetPoint.x, y: targetPoint.y },
                  cornerRadius,
                  pathOrientationHint,
                  initialOffset: tempInitialOffsetInst,
                  detourTargetY: null,
                },
                null,
                2
              )
            );
            path = generateOrthogonalPath(
              sourcePoint,
              targetPoint,
              cornerRadius,
              pathOrientationHint,
              tempInitialOffsetInst,
              null
            );
          } else if (conn.type === "local") {
            pathOrientationHint = "H-V-H";
            sourcePoint = conn.sourceCoords; // Locals always exit right

            targetPoint = {
              x: targetPosData.x, // Target left-edge of node
              y: targetPosData.y + targetPosData.height / 2, // Target middle-Y of node
            };

            const localInitialOffset = 30;

            console.log(
              `[LinkedListViz] LOCAL Var '${conn.varName}' CALLING generateOrthogonalPath (H-V-H default):`,
              JSON.stringify(
                {
                  sourcePoint: { x: sourcePoint.x, y: sourcePoint.y },
                  targetPoint: { x: targetPoint.x, y: targetPoint.y },
                  cornerRadius,
                  pathOrientationHint,
                  initialOffset: localInitialOffset,
                  detourTargetY: null,
                },
                null,
                2
              )
            );
            path = generateOrthogonalPath(
              sourcePoint,
              targetPoint,
              cornerRadius,
              pathOrientationHint,
              localInitialOffset,
              null
            );
          } else {
            // Fallback for any other types caught here
            path = "";
            console.warn(
              `[LinkedListViz] Unhandled connection type in var block: ${conn.type}`
            );
          }
        }
      } else if (conn.type === "ll_next" || conn.type === "ll_next_orphan") {
        // Node-to-node or Orphan-to-node next pointers
        markerId = styles.connection.llNextMarkerId || "ll-next-arrow";
        color = styles.connection.nextColor;
        // let strokeWidth = styles.connection.strokeWidth || 1.5; // REMOVE: Defined upfront
        pathOrientationHint = "H-V-H"; // Re-assign default for this type

        // Source: middle-right of the 'next' field area
        const fieldYOffset =
          styles.node.headerHeight +
          styles.node.padding +
          styles.node.fieldHeight +
          styles.node.fieldSpacing +
          styles.node.fieldHeight / 2;
        sourcePoint = {
          x: sourcePosData.x + sourcePosData.width,
          y: sourcePosData.y + fieldYOffset,
        };
        // Target: middle-left of the target node
        targetPoint = {
          x: targetPosData.x,
          y: targetPosData.y + targetPosData.height / 2,
        };

        // If orphan is far away, V-H-V might be better? (Experiment if needed)
        // const dxOrphan = Math.abs(targetPoint.x - sourcePoint.x);
        // if (conn.type === "ll_next_orphan" && dxOrphan > (styles.node.width || 180) * 2) {
        //     pathOrientationHint = 'V-H-V'; // Or maybe H-V-H is still better?
        // }

        // For ll_next, use the original generateOrthogonalPath
        path = generateOrthogonalPath(
          sourcePoint,
          targetPoint,
          cornerRadius,
          pathOrientationHint,
          undefined,
          null // No detour target for standard next pointers
        );
      }
      // Add case for ll_prev if doubly linked (likely H-V-H from left-middle to right-middle)

      if (sourcePoint && targetPoint) {
        // *** Call the NEW orthogonal path function ***
        // const cornerRadius = styles.connection.cornerRadius || 8; // Use style or default - MOVED UP

        // console.log("[LinkedListViz] 'end' pointer CALLING generateOrthogonalPath with:", JSON.stringify(
        //   {
        //     sourcePoint: {x: sourcePoint.x, y: sourcePoint.y}, // stringify sourcePoint
        //     targetPoint: {x: targetPoint.x, y: targetPoint.y}, // stringify targetPoint
        //     cornerRadius,
        //     pathOrientationHint, // Should be "V-H-V"
        //     initialOffset: undefined, // Explicitly showing it's not set here
        //     detourTargetY: forcedDetourY,
        //   },
        //   null,
        //   2
        // ));

        // const path = generateOrthogonalPath( // THIS IS NOW CONDITIONAL
        //   sourcePoint,
        //   targetPoint,
        //   cornerRadius,
        //   pathOrientationHint,
        //   undefined, // Let initialOffset use its default in generateOrthogonalPath, unless we need to override
        //   pathOrientationHint === "V-H-V" && conn.varName === "end"
        //     ? forcedDetourY // Pass the forced detour Y
        //     : null // Pass null for other connections
        // );

        connectionsGroup
          .append("path")
          .attr("d", path)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", strokeWidth) // Use the determined strokeWidth
          .attr("marker-end", markerId ? `url(#${markerId})` : null)
          .attr("stroke-opacity", 0.9)
          .attr("stroke-linecap", "round");

        if (conn.varName === "end" && pathOrientationHint === "V-H-V" && path) {
          // Also check if path is non-empty
          console.log("[LinkedListViz] 'end' pointer RETURNED path:", path);
        }
      }
    });

    console.log(
      "Finished LinkedList Visualization render using renderGenericNode."
    );
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

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
import {
  isAddress,
  truncateAddress,
  generateCurvedPath,
  generateOrthogonalPath,
  generateHardcodedEndPointerPath,
  generateSmartDetourPath,
  renderVariableBox,
  defineArrowheads,
  renderGenericNode,
  showNotImplementedMessage,
  autoFitVisualization,
} from "../utils/visualizationUtils";
import { renderArrayStructureVisualization } from "../visualizations/ArrayStructureVisualization";
import { renderLinkedStructureVisualization } from "../visualizations/LinkedStructureVisualization";
import { renderDoublyLinkedStructureVisualization } from "../visualizations/DoublyLinkedStructure";
import { renderGridStructureVisualization } from "../visualizations/GridStructureVisualization";

// Add this mapping near the top, after imports
const dsOperationArgs = {
  VECTOR: {
    set: { args: ["index", "element"], method: "patch" },
    removeAt: { args: ["index"], method: "patch" },
    insertAt: { args: ["index", "element"], method: "patch" },
    clear: { args: [], method: "patch" },
    add: { args: ["element"], method: "patch" },
    size: { args: [], method: "get" },
    isEmpty: { args: [], method: "get" },
    get: { args: ["index"], method: "get" },
  },
  TREE: {
    remove: { args: ["element"], method: "patch" },
    insert: { args: ["element"], method: "patch" },
    clear: { args: [], method: "patch" },
    search: { args: ["element"], method: "get" },
  },
  STACK: {
    push: { args: ["element"], method: "patch" },
    pop: { args: [], method: "patch" },
    clear: { args: [], method: "patch" },
    size: { args: [], method: "get" },
    peek: { args: [], method: "get" },
    isEmpty: { args: [], method: "get" },
  },
  SET: {
    remove: { args: ["element"], method: "patch" },
    clear: { args: [], method: "patch" },
    add: { args: ["element"], method: "patch" },
    size: { args: [], method: "get" },
    isEmpty: { args: [], method: "get" },
    contains: { args: ["element"], method: "get" },
  },
  QUEUE: {
    enqueue: { args: ["element"], method: "patch" },
    dequeue: { args: [], method: "patch" },
    clear: { args: [], method: "patch" },
    size: { args: [], method: "get" },
    peek: { args: [], method: "get" },
    isEmpty: { args: [], method: "get" },
  },
  EDITOR_BUFFER: {
    moveCursorToStart: { args: [], method: "patch" },
    moveCursorToEnd: { args: [], method: "patch" },
    moveCursorForward: { args: [], method: "patch" },
    moveCursorBackward: { args: [], method: "patch" },
    insertCharacter: { args: ["character"], method: "patch" },
    deleteCharacter: { args: [], method: "patch" },
  },
  DEQUE: {
    pushFront: { args: ["element"], method: "patch" },
    pushBack: { args: ["element"], method: "patch" },
    popFront: { args: [], method: "patch" },
    popBack: { args: [], method: "patch" },
    clear: { args: [], method: "patch" },
    size: { args: [], method: "get" },
    isEmpty: { args: [], method: "get" },
    getFront: { args: [], method: "get" },
    getBack: { args: [], method: "get" },
  },
  BIG_INTEGER: {
    add: { args: ["number"], method: "patch" },
    isGreaterThan: { args: ["number"], method: "get" },
  },
  GRID: {
    set: { args: ["row", "column", "element"], method: "patch" },
    numRows: { args: [], method: "get" },
    numColumns: { args: [], method: "get" },
    inBounds: { args: ["row", "column"], method: "get" },
    get: { args: ["row", "column"], method: "get" },
  },
  WEB_BROWSER: {
    visit: { args: ["url"], method: "patch" },
    forward: { args: [], method: "patch" },
    back: { args: [], method: "patch" },
  },
};

// Add this utility function near the top
function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

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
  const [operationValues, setOperationValues] = useState({});
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
  // Add this state near the top with other useState hooks
  const [pendingOperation, setPendingOperation] = useState(false);

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

  // Refactor fetchDataStructure to return the new operations array
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
        let resultForState = undefined;
        if (op.memorySnapshots && op.memorySnapshots.length > 0) {
          for (let i = op.memorySnapshots.length - 1; i >= 0; i--) {
            const currentSnapResult = op.memorySnapshots[i].getResult;
            if (currentSnapResult !== undefined && currentSnapResult !== null) {
              resultForState = currentSnapResult;
              break;
            }
          }
          if (resultForState === undefined) {
            resultForState =
              op.memorySnapshots[op.memorySnapshots.length - 1].getResult;
          }
        }
        const lastSnapshot =
          op.memorySnapshots && op.memorySnapshots.length > 0
            ? op.memorySnapshots[op.memorySnapshots.length - 1]
            : {
                instanceVariables: {},
                addressObjectMap: {},
                message: "",
                getResult: undefined,
              };
        return {
          operation: op.operationName,
          parameters: op.parameters,
          state: {
            ...lastSnapshot.instanceVariables,
            addressObjectMap: lastSnapshot.addressObjectMap,
            result: resultForState,
            message: lastSnapshot.message,
          },
          memorySnapshots: op.memorySnapshots,
        };
      });

      setOperations(formattedOperations);

      // Set current state from the last operation's final state
      if (formattedOperations.length > 0) {
        const lastOperationIndex = formattedOperations.length - 1;
        setCurrentHistoryIndex(lastOperationIndex);
        if (
          formattedOperations[lastOperationIndex].memorySnapshots &&
          formattedOperations[lastOperationIndex].memorySnapshots.length > 0
        ) {
          const lastSnapshotIndex =
            formattedOperations[lastOperationIndex].memorySnapshots.length - 1;
          setCurrentSnapshotIndex(lastSnapshotIndex);
        }
      }

      setDataStructure({
        id: dsDetails.id,
        name: dsDetails.name,
        type: dsDetails.type,
        implementation: dsDetails.implementation,
      });

      setLoading(false);
      return formattedOperations;
    } catch (err) {
      setError("Failed to load data structure: " + err.message);
      console.error(err);
      setLoading(false);
      return [];
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

        let snapshotIdentifier = `op${currentHistoryIndex}_snap${currentSnapshotIndex}`;
        if (directOperation && directSnapshot) {
          // If called with direct operation/snapshot
          // Try to find the index of directOperation and directSnapshot if possible for a more consistent ID
          // This is a bit more complex, for now, use a generic one or a timestamp if indices are not readily available
          const opIndex = operations.findIndex((op) => op === directOperation);
          let snapIndex = -1;
          if (opIndex !== -1 && directOperation.memorySnapshots) {
            snapIndex = directOperation.memorySnapshots.findIndex(
              (snap) => snap === directSnapshot
            );
          }
          if (opIndex !== -1 && snapIndex !== -1) {
            snapshotIdentifier = `op${opIndex}_snap${snapIndex}`;
          } else {
            snapshotIdentifier = `directRender_${Date.now()}`;
          }
        } else if (!operation) {
          snapshotIdentifier = "no_operation";
        }

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

          // Special cases that should not combine implementation with type
          const specialTypes = [
            "BIG_INTEGER",
            "WEB_BROWSER",
            "DEQUE",
            "FILE_SYSTEM",
            "GRID",
          ];
          if (
            impl &&
            impl !== "NULL" &&
            impl !== "" &&
            !specialTypes.includes(type)
          ) {
            combinedType = `${impl}_${type}`;
          } else {
            combinedType = type;
          }
          console.log("Combined structure type for switch:", combinedType);

          switch (combinedType) {
            case "WEB_BROWSER":
              renderDoublyLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "BIG_INTEGER":
              renderArrayStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "ARRAY_VECTOR":
              renderArrayStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "LINKED_LIST_VECTOR":
              renderLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "ARRAY_EDITOR_BUFFER":
              renderArrayStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "ARRAY_STACK":
              renderArrayStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "LINKED_LIST_STACK":
              renderLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "TWO_QUEUE_STACK":
            case "ARRAY_QUEUE":
              renderArrayStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "LINKED_LIST_QUEUE":
              renderLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "ARRAY_MAP":
            case "HASH_MAP":
            case "TREE_MAP":
            case "DEQUE":
              renderDoublyLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "BS_TREE":
            case "AVL_TREE":
            case "EXPRESSION_TREE":
            case "HASH_SET":
            case "TREE_SET":
            case "SMALL_INT_SET":
            case "MOVE_TO_FRONT_SET":
              renderLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "UNSORTED_VECTOR_PRIORITY_QUEUE":
            case "SORTED_LINKED_LIST_PRIORITY_QUEUE":
              renderLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "UNSORTED_DOUBLY_LINKED_LIST_PRIORITY_QUEUE":
              renderDoublyLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "BINARY_HEAP_PRIORITY_QUEUE":
              renderArrayStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "FILE_SYSTEM":
            case "TWO_STACK_EDITOR_BUFFER":
            case "LINKED_LIST_EDITOR_BUFFER":
              renderLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "DOUBLY_LINKED_LIST_EDITOR_BUFFER":
              renderDoublyLinkedStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
            case "GRID":
              renderGridStructureVisualization(
                contentGroup,
                width,
                height,
                effectiveOperation,
                memorySnapshot,
                snapshotIdentifier
              );
              break;
          }
        }
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
      operations,
      currentHistoryIndex,
      currentSnapshotIndex,
      enableMemoryVisualization,
      snapshotMode,
      forceRender,
    ]
  );

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

  // Replace getOperationOptions and needsValueInput with dynamic logic
  const getOperationOptions = () => {
    if (!dataStructure) return [];
    const type = dataStructure.type.toUpperCase();
    const ops = dsOperationArgs[type] || {};
    return Object.keys(ops).map((op) => ({ value: op, label: op }));
  };

  const getOperationArgs = (opValue) => {
    if (!dataStructure) return [];
    const type = dataStructure.type.toUpperCase();
    return (
      (dsOperationArgs[type] && dsOperationArgs[type][opValue]?.args) || []
    );
  };

  // Check if the selected operation needs a value input
  const needsValueInput = (opValue) => {
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
    return !noValueOperations.includes(opValue);
  };

  // Replace handleOperationSubmit with dynamic endpoint logic
  const handleOperationSubmit = async (e, opValue) => {
    e.preventDefault();

    const args = getOperationArgs(opValue);
    const value = operationValues[opValue];
    if (args.length > 0) {
      if (
        !value ||
        (Array.isArray(value)
          ? value.some((v) => !v || v.trim() === "")
          : value.trim() === "")
      ) {
        return;
      }
    }

    try {
      setProcessingOperation(true);
      setLoading(true);
      setPendingOperation(true);

      const type = dataStructure.type.toUpperCase();
      const impl = dataStructure.implementation;
      const dsName = dataStructure.name;
      // Convert opValue to kebab-case for API call
      const opName = camelToKebab(opValue);
      const argVals = Array.isArray(value) ? value : value ? [value] : [];

      const controllerMap = {
        VECTOR: "vector",
        TREE: "tree",
        STACK: "stack",
        SET: "set",
        QUEUE: "queue",
        EDITOR_BUFFER: "editor-buffer",
        DEQUE: "deque",
        BIG_INTEGER: "big-integer",
        GRID: "grid",
        WEB_BROWSER: "web-browser",
      };
      const controller = controllerMap[type];
      let endpoint = "";
      let method = "patch";
      // Use kebab-case opName for getOps check
      const getOps = [
        "size",
        "is-empty",
        "get",
        "peek",
        "contains",
        "num-rows",
        "num-columns",
        "in-bounds",
        "get-front",
        "get-back",
        "search",
        "is-greater-than",
      ];
      if (getOps.includes(opName)) method = "get";

      if (
        ["VECTOR", "TREE", "STACK", "SET", "QUEUE", "EDITOR_BUFFER"].includes(
          type
        )
      ) {
        endpoint = `/${controller}/${opName}/${
          impl ? impl + "/" : ""
        }${dsName}`;
        if (args.length > 0) {
          endpoint += "/" + argVals.map(encodeURIComponent).join("/");
        }
      } else if (
        ["DEQUE", "BIG_INTEGER", "GRID", "WEB_BROWSER"].includes(type)
      ) {
        endpoint = `/${controller}/${opName}/${dsName}`;
        if (args.length > 0) {
          endpoint += "/" + argVals.map(encodeURIComponent).join("/");
        }
      }

      const api = require("../services/api").default;
      let response;
      if (method === "get") {
        response = await api.get(endpoint);
      } else {
        response = await api.patch(endpoint);
      }

      const newOperations = await fetchDataStructure();
      if (newOperations && newOperations.length > 0) {
        setCurrentHistoryIndex(newOperations.length - 1);
      }

      // Clear only the value for this operation
      setOperationValues((prev) => ({
        ...prev,
        [opValue]: args.length > 1 ? [] : "",
      }));
      setError(null);
    } catch (err) {
      setError(
        "Failed to perform operation: " +
          (err.response?.data?.message || err.message)
      );
      console.error(err);
    } finally {
      setProcessingOperation(false);
      setLoading(false);
    }
  };

  // Add this useEffect after operations state is defined
  useEffect(() => {
    if (pendingOperation && operations && operations.length > 0) {
      setCurrentHistoryIndex(operations.length - 1);
      setPendingOperation(false);
    }
  }, [operations, pendingOperation]);

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

    // Use the main renderVisualization function with the selected operation and snapshot
    renderVisualization(visualState.operation, visualState.snapshot);
  }, [visualState, renderVisualization]);

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

    // Use the main renderVisualization function
    renderVisualization(operation, memorySnapshot);
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
              <div className="flex flex-col h-full">
                {/* Operation Form - Takes up half the space */}
                <div className="h-1/2 overflow-y-auto no-scrollbar">
                  <form
                    onSubmit={(e) => handleOperationSubmit(e, operation)}
                    className="flex flex-col divide-y divide-gray-200"
                  >
                    {getOperationOptions().map((op) => (
                      <div
                        key={op.value}
                        className="flex items-center justify-between py-0.5 h-7"
                      >
                        <div className="flex items-center">
                          <span className="text-gray-700 text-xs font-semibold whitespace-nowrap">
                            {op.label}(
                          </span>
                          {getOperationArgs(op.value).length === 0 && (
                            <span className="text-gray-700 text-xs font-semibold">
                              )
                            </span>
                          )}
                          {getOperationArgs(op.value).map((arg, idx, arr) => (
                            <span key={arg} className="flex items-center">
                              <span
                                className={`text-gray-700 text-xs font-semibold${
                                  idx === 0 ? "" : " ml-1"
                                }`}
                              >
                                {arg}:&nbsp;
                              </span>
                              <input
                                id={`operation-${op.value}-${arg}`}
                                type="text"
                                value={
                                  Array.isArray(operationValues[op.value])
                                    ? operationValues[op.value][idx] || ""
                                    : getOperationArgs(op.value).length > 1
                                    ? ""
                                    : operationValues[op.value] || ""
                                }
                                onChange={(e) => {
                                  setOperationValues((prev) => {
                                    if (getOperationArgs(op.value).length > 1) {
                                      const newVals = Array.isArray(
                                        prev[op.value]
                                      )
                                        ? [...prev[op.value]]
                                        : [];
                                      newVals[idx] = e.target.value;
                                      return { ...prev, [op.value]: newVals };
                                    } else {
                                      return {
                                        ...prev,
                                        [op.value]: e.target.value,
                                      };
                                    }
                                  });
                                }}
                                className={`${
                                  getOperationArgs(op.value).length === 3
                                    ? "w-12"
                                    : "w-16"
                                } px-1 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 h-6`}
                              />
                              {idx < arr.length - 1 && (
                                <span className="text-gray-700 text-xs font-semibold ml-1">
                                  ,
                                </span>
                              )}
                              {idx === arr.length - 1 && (
                                <span className="text-gray-700 text-xs font-semibold">
                                  )
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                        <button
                          type="submit"
                          onClick={(e) => handleOperationSubmit(e, op.value)}
                          disabled={
                            getOperationArgs(op.value).length > 0 &&
                            (!operationValues[op.value] ||
                              (Array.isArray(operationValues[op.value])
                                ? operationValues[op.value].some(
                                    (v) => !v || v.trim() === ""
                                  )
                                : operationValues[op.value]?.trim() === ""))
                          }
                          className="bg-blue-500 text-white py-0.5 px-3 rounded text-xs font-semibold hover:bg-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-300 disabled:text-gray-500 h-6 whitespace-nowrap"
                        >
                          {processingOperation ? "Processing..." : "Perform"}
                        </button>
                      </div>
                    ))}
                  </form>
                </div>

                {/* Operation History List - Takes up the other half */}
                <div
                  className="h-1/2 overflow-y-auto"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "#94a3b8 #f1f5f9",
                  }}
                >
                  <h3 className="font-bold mb-1 text-xs">Operation History</h3>
                  <div
                    className="bg-gray-100 p-2 rounded h-[calc(100%-24px)] overflow-y-auto"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "#94a3b8 #f1f5f9",
                    }}
                  >
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
                                {op.state &&
                                  op.state.result !== undefined &&
                                  op.state.result !== null && (
                                    <span className="text-black">
                                      {" "}
                                      Result: {String(op.state.result)}
                                    </span>
                                  )}
                              </div>
                              {op.state && op.state.message && (
                                <div className="mt-1 text-gray-600">
                                  {op.state.message}
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

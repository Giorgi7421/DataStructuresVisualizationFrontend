// This is a rename operation, content will be from LinkedListVisualization.js

import {
  isAddress,
  truncateAddress,
  defineArrowheads,
  renderVariableBox,
  renderGenericNode,
  generateHardcodedEndPointerPath,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

export const renderLinkedListVectorVisualization = (
  contentGroup,
  width,
  height,
  operation,
  memorySnapshot
) => {
  console.log(
    "TOP OF renderLinkedListVectorVisualization. Op:", // Renamed Log
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
      width: 250,
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
      height: 100, // Added default height, was used in calculations
    },
    connection: {
      strokeWidth: 1.5,
      instanceVarColor: "#334155", // Used by defineArrowheads for #ll-instance-var-arrow
      nextColor: "#2563eb", // Used by defineArrowheads for #ll-next-arrow
      // Define marker IDs used in this viz
      llInstanceVarMarkerId: "ll-instance-var-arrow",
      llNextMarkerId: "ll-next-arrow",
      cornerRadius: 8,
      defaultColor: "#64748b", // Fallback color
    },
    layout: {
      // Layout specific parameters
      nodeSpacingX: 60, // Increased from 40
      varBoxSpacingY: 20,
      nodesStartXOffset: 60, // Space between var boxes and first node
      layerSpacingY: 120, // NEW: Vertical space between layers
    },
  };

  // Define Arrowheads using helper
  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles);

  const nodePositions = {};
  const allConnections = [];

  const firstColX = 30;
  const varBoxTopMargin = 30;

  let instanceVarsBoxHeight = 0;
  let localVarsBoxHeight = 0;
  const instanceVarsBoxWidth = styles.varBox.width || 180;
  const localVarsBoxWidth = styles.varBox.width || 180;
  const layerSpacingY = styles.layout.layerSpacingY || 120;
  let nodeStartX = firstColX;

  let topLayerBottomY = varBoxTopMargin;
  if (Object.keys(instanceVariables).length > 0) {
    const instanceVarsX = width / 2 - instanceVarsBoxWidth / 2;
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
    nodeStartX = firstColX;
  } else {
    topLayerBottomY = 0;
  }

  const middleLayerY =
    topLayerBottomY > 0 ? topLayerBottomY + layerSpacingY : varBoxTopMargin;

  const mainListSpecs = [];
  const orphanSpecs = [];
  const visited = new Set();
  const MAX_NODES_TO_RENDER = 50;

  const mainListStartX = width / 2 + 30;
  let currentX = mainListStartX;

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
      startAddress = potentialStarts[0];
    } else if (allNodeAddrs.length > 0) {
      startAddress = allNodeAddrs[0];
    }
  }

  let currentAddress = startAddress;
  let nodesProcessedCount = 0;
  let middleLayerMaxNodeHeight = styles.node.height; // Use defined default
  currentX = mainListStartX;

  while (
    currentAddress &&
    currentAddress !== "0x0" &&
    currentAddress !== "null" &&
    !visited.has(currentAddress) &&
    nodesProcessedCount < MAX_NODES_TO_RENDER
  ) {
    visited.add(currentAddress);
    const nodeData = addressObjectMap[currentAddress];

    if (!nodeData || typeof nodeData !== "object" || Array.isArray(nodeData)) {
      console.warn(
        `LinkedListVectorViz: Invalid node data for address ${currentAddress}.` // Renamed Log
      );
      break;
    }

    const nodeFields = {};
    if (nodeData.data !== undefined) {
      nodeFields.value = nodeData.data;
    } else if (nodeData.value !== undefined) {
      nodeFields.value = nodeData.value;
    } else {
      nodeFields.value = "N/A";
    }

    if (nodeData.nextAddress !== undefined) {
      nodeFields.next = nodeData.nextAddress;
    } else if (nodeData.next !== undefined) {
      nodeFields.next = nodeData.next;
    } else {
      nodeFields.next = "null";
    }

    if (nodeData.previousAddress !== undefined) {
      nodeFields.prev = nodeData.previousAddress;
    } else if (nodeData.prev !== undefined) {
      nodeFields.prev = nodeData.prev;
    }

    mainListSpecs.push({
      x: currentX,
      y: middleLayerY,
      address: currentAddress,
      title:
        nodeData.title || nodeData.url || truncateAddress(currentAddress, 6),
      fields: nodeFields,
      isIsolated: false,
      style: styles.node,
    });

    middleLayerMaxNodeHeight = Math.max(
      middleLayerMaxNodeHeight,
      styles.node.height
    );

    if (
      nodeData.nextAddress &&
      nodeData.nextAddress !== "0x0" &&
      nodeData.nextAddress !== "null"
    ) {
      allConnections.push({
        sourceName: currentAddress,
        targetAddress: nodeData.nextAddress,
        type: "ll_next",
      });
    }

    currentX += styles.node.width + styles.layout.nodeSpacingX;
    currentAddress = nodeData.nextAddress;
    nodesProcessedCount++;
  }

  if (nodesProcessedCount === MAX_NODES_TO_RENDER) {
    console.warn("LinkedListVectorViz: Reached max node render limit."); // Renamed Log
  }

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
        "[LinkedListVectorViz] Error rendering MAIN LIST node:", // Renamed Log
        spec.address,
        e
      );
    }
  });

  // ---> START: Moved Orphan Node Logic to Middle Layer <---
  const orphanNodeStartX = firstColX; // Start orphans on the left
  const orphanNodeY = middleLayerY; // Render on middle layer Y
  let currentOrphanX = orphanNodeStartX;
  let currentOrphanY = orphanNodeY;
  let middleLayerMaxOrphanHeight = 0; // Track orphan heights separately for row wrapping

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
      const nodeData = addressObjectMap[addr];
      if (!nodeData) return;

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
      } // Note: prev field rendering might need specific handling if required

      const nodeHeight = (styles.node && styles.node.height) || 100;
      middleLayerMaxOrphanHeight = Math.max(
        middleLayerMaxOrphanHeight,
        nodeHeight
      );

      orphanSpecs.push({
        x: currentOrphanX,
        y: currentOrphanY,
        address: addr,
        title: nodeData.title || nodeData.url || truncateAddress(addr, 6),
        fields: orphanNodeFields,
        isIsolated: true,
        style: styles.node,
      });
      visited.add(addr); // Mark as visited here

      if (
        nodeData.nextAddress &&
        nodeData.nextAddress !== "0x0" &&
        nodeData.nextAddress !== "null"
      ) {
        // Connection for orphan nodes might need review based on new layout
        allConnections.push({
          sourceName: addr,
          targetAddress: nodeData.nextAddress,
          type: "ll_next_orphan",
        });
      }

      // Basic wrapping logic for orphans on the left side
      currentOrphanX += (styles.node.width || 180) + styles.layout.nodeSpacingX;
      // Wrap if next node exceeds ~half the width (leaving space for main list)
      if (
        currentOrphanX + (styles.node.width || 180) >
        width / 2 - styles.layout.nodeSpacingX
      ) {
        currentOrphanX = orphanNodeStartX;
        currentOrphanY +=
          middleLayerMaxOrphanHeight + styles.layout.nodeSpacingX;
        middleLayerMaxOrphanHeight = 0; // Reset max height for the new row
      }
    }
  });

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
        "[LinkedListVectorViz] Error rendering ORPHAN node:",
        spec.address,
        e
      );
    }
  });
  // ---> END: Moved Orphan Node Logic <---

  // Calculate bottom Y based on the maximum height reached in the middle layer
  // (Consider both main list and potentially multiple rows of orphans)
  const middleLayerMaxHeightReached = Math.max(
    middleLayerMaxNodeHeight,
    currentOrphanY + middleLayerMaxOrphanHeight - middleLayerY
  ); // Check max Y reached by orphans
  const middleLayerBottomY = middleLayerY + middleLayerMaxHeightReached;

  const bottomLayerStartY = middleLayerBottomY + layerSpacingY;

  if (Object.keys(localVariables).length > 0) {
    // Position Local Vars centered
    const localVarsX = width / 2 - localVarsBoxWidth / 2;
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
  }

  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");
  allConnections.forEach((conn) => {
    let sourcePoint, targetPoint;
    let path = "";
    let markerId = null;
    let color = styles.connection.defaultColor || "#64748b";
    let strokeWidth = styles.connection.strokeWidth;
    const cornerRadius = styles.connection.cornerRadius || 5;
    let pathOrientationHint = "auto";
    const sNode = styles.node;

    const Y_THRESHOLD =
      (sNode && typeof sNode.height === "number" ? sNode.height : 100) * 0.6; // Raised from 0.45
    // X_THRESHOLD is no longer used for path style decision
    // const X_THRESHOLD = (sNode && typeof sNode.width === 'number' ? sNode.width : 180) * 0.30;

    const HORIZONTAL_OVERSHOOT = 20; // For H-V path, non-overlapping case
    const INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP = 20; // For H-V path, overlapping case

    // 1. Determine Source BoundingBox and Specific Field Egress Coords
    let sourceBoundingBoxPosData;
    let specificFieldInitialCoords;

    if (
      conn.sourceName &&
      (conn.sourceName.startsWith("instance-") ||
        conn.sourceName.startsWith("local-"))
    ) {
      const varBoxType = conn.sourceName.startsWith("instance-")
        ? "instance_vars_box"
        : "local_vars_box";
      sourceBoundingBoxPosData = nodePositions[varBoxType];
      specificFieldInitialCoords = conn.sourceCoords;
      if (!sourceBoundingBoxPosData || !specificFieldInitialCoords) {
        console.warn(
          `[LLV Viz] Missing source VarBox data or field coords for:`,
          conn
        );
        return;
      }
    } else if (conn.sourceName) {
      sourceBoundingBoxPosData = nodePositions[conn.sourceName];
      if (!sourceBoundingBoxPosData) {
        console.warn(`[LLV Viz] Source Node not found:`, conn.sourceName, conn);
        return;
      }
      let fieldYOffset;
      const fieldNames = sourceBoundingBoxPosData.fields
        ? Object.keys(sourceBoundingBoxPosData.fields)
        : ["value", "next"];
      let fieldIndexToUse = fieldNames.indexOf("next");
      if (fieldIndexToUse === -1 && fieldNames.length > 0)
        fieldIndexToUse = fieldNames.length - 1;
      else if (fieldIndexToUse === -1) fieldIndexToUse = 1;

      if (
        sNode &&
        typeof sNode.fieldHeight === "number" &&
        typeof sNode.fieldSpacing === "number" &&
        typeof sNode.headerHeight === "number" &&
        typeof sNode.padding === "number"
      ) {
        fieldYOffset =
          sNode.headerHeight +
          sNode.padding +
          fieldIndexToUse * (sNode.fieldHeight + sNode.fieldSpacing) +
          sNode.fieldHeight / 2;
      } else {
        fieldYOffset = sourceBoundingBoxPosData.height / 2;
      }
      specificFieldInitialCoords = {
        x: sourceBoundingBoxPosData.x + sourceBoundingBoxPosData.width / 2,
        y: sourceBoundingBoxPosData.y + fieldYOffset,
      };
    } else {
      console.warn("[LLV Viz] Connection has no sourceName:", conn);
      return;
    }

    // 2. Determine Target Position Data
    const targetPosData = nodePositions[conn.targetAddress];
    if (!targetPosData) {
      if (
        (conn.type === "ll_next" || conn.type === "ll_next_orphan") &&
        (conn.targetAddress === "0x0" ||
          conn.targetAddress === "null" ||
          !conn.targetAddress)
      ) {
        if (specificFieldInitialCoords && sourceBoundingBoxPosData) {
          const egressX =
            sourceBoundingBoxPosData.x + sourceBoundingBoxPosData.width;
          const nullSymbolX = egressX + 30;
          const nullSymbolY = specificFieldInitialCoords.y;
          connectionsGroup
            .append("line")
            .attr("x1", egressX)
            .attr("y1", nullSymbolY)
            .attr("x2", nullSymbolX - 5)
            .attr("y2", nullSymbolY)
            .attr("stroke", styles.connection.nextColor || "#2563eb")
            .attr("stroke-width", strokeWidth);
          connectionsGroup
            .append("line")
            .attr("x1", nullSymbolX - 10)
            .attr("y1", nullSymbolY - 5)
            .attr("x2", nullSymbolX)
            .attr("y2", nullSymbolY + 5)
            .attr("stroke", styles.connection.nextColor || "#2563eb")
            .attr("stroke-width", strokeWidth);
        }
        return;
      }
      console.warn(
        `[LLV Viz] Target Node not found for address:`,
        conn.targetAddress,
        conn
      );
      return;
    }

    // 3. Define key coordinates for source and target
    const sourceOverallMidX =
      sourceBoundingBoxPosData.x + sourceBoundingBoxPosData.width / 2;
    const sourceFieldActualY = specificFieldInitialCoords.y; // Y from the actual field for drawing origin

    const targetOverallMidX = targetPosData.x + targetPosData.width / 2;
    const targetOverallMidY = targetPosData.y + targetPosData.height / 2;

    // Determine the Y-coordinate to use for the source side of the *path style decision*
    let decisionSourceY = sourceFieldActualY;
    if (conn.type === "ll_next" || conn.type === "ll_next_orphan") {
      if (
        sourceBoundingBoxPosData &&
        typeof sourceBoundingBoxPosData.height === "number"
      ) {
        decisionSourceY =
          sourceBoundingBoxPosData.y + sourceBoundingBoxPosData.height / 2; // Use node center Y
      } else {
        console.warn(
          "[LLV PathDecision] Missing sourceBoundingBoxPosData.height for ll_next, using field Y for decision."
        );
      }
    }

    const deltaXOverallMid = Math.abs(targetOverallMidX - sourceOverallMidX);
    const deltaYDecisionMid = Math.abs(targetOverallMidY - decisionSourceY);

    console.log(
      `[LLV Viz PathDecision] Conn: ${conn.type}-${conn.sourceName}->${
        conn.targetAddress
      }, deltaX: ${deltaXOverallMid.toFixed(
        2
      )}, deltaYDecision: ${deltaYDecisionMid.toFixed(
        2
      )}, Y_THRESH: ${Y_THRESHOLD.toFixed(2)}`
    );

    // 4. Determine Egress Side from Source and set initial sourcePoint.y
    // Egress side is based on overall X midpoints.
    const chosenEgressSide =
      targetOverallMidX < sourceOverallMidX ? "left" : "right";
    sourcePoint = { y: sourceFieldActualY }; // Actual drawing point Y uses the specific field's Y
    if (chosenEgressSide === "left") {
      sourcePoint.x = sourceBoundingBoxPosData.x;
    } else {
      sourcePoint.x =
        sourceBoundingBoxPosData.x + sourceBoundingBoxPosData.width;
    }

    // 5. Apply New Rules for Path Style and Target Point
    if (deltaYDecisionMid <= Y_THRESHOLD) {
      // Only Y-Threshold for H-V-H
      pathOrientationHint = "H-V-H";
      targetPoint = {
        x:
          sourceOverallMidX < targetOverallMidX
            ? targetPosData.x
            : targetPosData.x + targetPosData.width,
        y: targetOverallMidY,
      };
      console.log(`[LLV PathStyle] Chosen: H-V-H (Y-thresh met)`);
    } else {
      // H-V path with overlap logic
      pathOrientationHint = "H-V_to_target_top";
      const sourceRightX =
        sourceBoundingBoxPosData.x + sourceBoundingBoxPosData.width;
      const targetRightX = targetPosData.x + targetPosData.width;

      const overlap =
        Math.max(sourceBoundingBoxPosData.x, targetPosData.x) <
        Math.min(sourceRightX, targetRightX);
      console.log(
        `[LLV PathStyle] Chosen: H-V (Y-thresh NOT met). Overlap: ${overlap}`
      );

      if (!overlap) {
        // Scenario 2.1: NO Horizontal Overlap
        let approachingEdgeX;
        let overshotX;
        if (chosenEgressSide === "right") {
          // Source is to the left of target
          approachingEdgeX = targetPosData.x;
          overshotX = approachingEdgeX + HORIZONTAL_OVERSHOOT;
        } else {
          // Source is to the right of target, or egressing left towards a target on the left
          approachingEdgeX = targetRightX;
          overshotX = approachingEdgeX - HORIZONTAL_OVERSHOOT;
        }
        targetPoint = {
          x: overshotX,
          y:
            decisionSourceY < targetOverallMidY
              ? targetPosData.y
              : targetPosData.y + targetPosData.height,
        };
        console.log(
          `[LLV PathStyle H-V NoOverlap] Egress: ${chosenEgressSide}, ApproachEdgeX: ${approachingEdgeX.toFixed(
            2
          )}, OvershotX: ${overshotX.toFixed(2)}`
        );
      } else {
        // Scenario 2.2: Horizontal Overlap EXISTS
        let turnX;
        if (chosenEgressSide === "right") {
          // Egressing right, into/towards overlap zone
          turnX = sourcePoint.x + INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP;
        } else {
          // Egressing left, into/towards overlap zone
          turnX = sourcePoint.x - INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP;
        }
        targetPoint = {
          x: turnX,
          y:
            decisionSourceY < targetOverallMidY
              ? targetPosData.y
              : targetPosData.y + targetPosData.height,
        };
        console.log(
          `[LLV PathStyle H-V Overlap] Egress: ${chosenEgressSide}, TurnX: ${turnX.toFixed(
            2
          )}`
        );
      }
    }

    // 6. Set Marker and Color based on original connection type
    if (conn.type === "ll_next" || conn.type === "ll_next_orphan") {
      markerId = styles.connection.llNextMarkerId || "ll-next-arrow";
      color = styles.connection.nextColor || "#2563eb";
    } else {
      markerId =
        styles.connection.llInstanceVarMarkerId || "ll-instance-var-arrow";
      color = styles.connection.instanceVarColor || "#334155";
    }

    // 7. Generate Path
    let initialOffset = 15; // Default for H-V, can be small as targetPoint.x guides the turn
    if (pathOrientationHint === "H-V-H") {
      // For H-V-H, the offset determines the first/last horizontal segment length.
      // Make it proportional to the smaller of half the X distance or a fraction of Y distance to prevent weird turns.
      const xDistForOffset = deltaXOverallMid / 2 - cornerRadius * 2;
      const yDistForOffset = Math.abs(targetPoint.y - sourcePoint.y) * 0.4;
      initialOffset = Math.max(5, Math.min(30, xDistForOffset, yDistForOffset));
    }

    path = generateOrthogonalPath(
      sourcePoint,
      targetPoint,
      cornerRadius,
      pathOrientationHint,
      initialOffset,
      null
    );

    // 8. Draw the path
    if (path && sourcePoint && targetPoint) {
      connectionsGroup
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", strokeWidth)
        .attr("marker-end", markerId ? `url(#${markerId})` : null)
        .attr("stroke-opacity", 0.9)
        .attr("stroke-linecap", "round");
    } else {
      console.warn(
        "[LLV Viz] Path was empty or points missing, not drawn. Conn:",
        conn
      );
    }
  });

  console.log("Finished LinkedListVectorVisualization render.");
};

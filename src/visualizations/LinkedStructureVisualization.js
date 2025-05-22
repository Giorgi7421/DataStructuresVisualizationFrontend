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

export const renderLinkedStructureVisualization = (
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

  // Move visited to the top so it is available for orphan ordering
  const visited = new Set();

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
      layerSpacingY: 120, // Vertical space between layers
      orphanNodeSpacingX: 40, // Spacing between orphan nodes
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

  // Declare main chain variables ONCE at the top
  let startAddress;
  let currentAddress;
  let nodesProcessedCount;
  const MAX_NODES_TO_RENDER = 50;
  let mainChainLeftmostX;
  let currentX;

  // --- 1. INITIAL MAIN CHAIN TRAVERSAL (Populate visited set) ---
  startAddress =
    instanceVariables.start ||
    instanceVariables.head ||
    instanceVariables.front ||
    instanceVariables.stack ||
    instanceVariables.array;
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
      startAddress = allNodeAddrs[0]; // Fallback to first node if no clear start
    }
  }

  let tempCurrentAddress = startAddress;
  let nodesVisitedCount = 0;
  while (
    tempCurrentAddress &&
    tempCurrentAddress !== "0x0" &&
    tempCurrentAddress !== "null" &&
    !visited.has(tempCurrentAddress) &&
    nodesVisitedCount < MAX_NODES_TO_RENDER
  ) {
    visited.add(tempCurrentAddress);
    const nodeData = addressObjectMap[tempCurrentAddress];
    if (!nodeData || typeof nodeData !== "object" || Array.isArray(nodeData)) {
      break; // Invalid node data
    }
    tempCurrentAddress = nodeData.nextAddress || nodeData.next;
    nodesVisitedCount++;
  }

  // --- 2. ORPHAN CHAIN ORDERING (Define orderedOrphanAddrs) ---
  const orphanAddrs = Object.keys(addressObjectMap).filter(
    (addr) =>
      addressObjectMap[addr] &&
      typeof addressObjectMap[addr] === "object" &&
      !Array.isArray(addressObjectMap[addr]) &&
      !visited.has(addr) // Use the populated visited set
  );
  const orphanNexts = new Set();
  orphanAddrs.forEach((addr) => {
    const node = addressObjectMap[addr];
    const next = node.nextAddress || node.next;
    if (next && orphanAddrs.includes(next)) {
      orphanNexts.add(next);
    }
  });
  const orphanHeads = orphanAddrs.filter((addr) => !orphanNexts.has(addr));
  let orderedOrphanAddrs = [];
  orphanHeads.forEach((headAddr) => {
    let current = headAddr;
    const chainVisitedThisOrphanRun = new Set(); // Avoid cycles within a single orphan chain run
    while (
      current &&
      !chainVisitedThisOrphanRun.has(current) &&
      orphanAddrs.includes(current)
    ) {
      orderedOrphanAddrs.push(current);
      chainVisitedThisOrphanRun.add(current);
      const node = addressObjectMap[current];
      const next = node.nextAddress || node.next;
      if (next && orphanAddrs.includes(next)) {
        current = next;
      } else {
        break;
      }
    }
  });

  // --- 3. GRID SETUP (Define mainChainStartX, mainChainY, etc.) ---
  // --- GRID LAYOUT CONSTANTS ---
  const gridRows = 4;
  const gridCols = 3; // This might be adjusted by dynamic width logic later
  const cellWidth = width / gridCols;
  const cellHeight = height / gridRows;

  // --- DYNAMIC GRID LAYOUT FOR ORPHAN CHAIN ---
  const orphanNodeCount =
    orderedOrphanAddrs.length > 0 ? orderedOrphanAddrs.length : 1;
  const baseNodeWidth = styles.node.width;
  const baseSpacing = styles.layout.orphanNodeSpacingX;
  const orphanCellPadding = 20;
  const calculatedOrphanCellWidth = // Renamed to avoid conflict if gridCols is changed
    orphanNodeCount * baseNodeWidth +
    (orphanNodeCount - 1) * baseSpacing +
    2 * orphanCellPadding;

  const actualGridCols = 3; // Assuming a fixed 3-column conceptual layout for now
  const remainingWidth = Math.max(width - calculatedOrphanCellWidth, 1);
  // If only 1 column remains for other cells, it takes all remaining width.
  // If more than 1 column remains (e.g. gridCols = 3, 1 for orphans, 2 for others), divide fairly.
  const otherCellWidth =
    actualGridCols > 1 ? remainingWidth / (actualGridCols - 1) : remainingWidth;

  const cellWidths = [
    calculatedOrphanCellWidth,
    otherCellWidth,
    otherCellWidth,
  ]; // Adjust if actualGridCols changes
  // Ensure this array matches actualGridCols if it's dynamic
  if (actualGridCols === 2) cellWidths.splice(2, 1);
  if (actualGridCols === 1) cellWidths.splice(1, 2);

  const colX = [0];
  for (let i = 0; i < cellWidths.length; i++) {
    colX.push(colX[i] + cellWidths[i]);
  }

  // Cell assignments (conceptual, might need review if actualGridCols changes)
  // Instance Variables: (0,1) -> e.g. colX[1] based, if it exists
  const instanceVarsX =
    (colX[1] || 0) + (cellWidths[1] || width) / 2 - styles.varBox.width / 2;
  const instanceVarsY =
    cellHeight * 0 + cellHeight / 2 - styles.varBox.headerHeight;
  // Main Chain: (1,2) -> e.g. colX[2] based
  const mainChainY = cellHeight * 1 + cellHeight / 2 - styles.node.height / 2;
  const mainChainStartX = (colX[2] || colX[1] || 0) + 20; // Fallback if fewer columns
  // Orphan Chain: (2,0) -> e.g. colX[0] based
  const orphanCellLeft = colX[0];
  const orphanCellTop = cellHeight * 2;
  const orphanCellHeight = cellHeight;
  // Local Variables: (3,1) -> e.g. colX[1] based
  const localVarsX =
    (colX[1] || 0) + (cellWidths[1] || width) / 2 - styles.varBox.width / 2;
  const localVarsY =
    cellHeight * 3 + cellHeight / 2 - styles.varBox.headerHeight;

  // --- 4. MAIN CHAIN LAYOUT (Populate mainListSpecs) ---
  const mainListSpecs = [];
  currentAddress = startAddress; // Re-initialize for this pass
  nodesProcessedCount = 0; // Re-initialize
  mainChainLeftmostX = mainChainStartX; // Initialize with start X
  currentX = mainChainStartX; // Initialize currentX for layout

  while (
    currentAddress &&
    currentAddress !== "0x0" &&
    currentAddress !== "null" &&
    // No need to check visited.has() here if we are strictly following the main chain from startAddress
    // and assuming it's acyclic for layout purposes, or relying on MAX_NODES_TO_RENDER.
    // If main chain could have nodes also in orphan list due to complex structures, ensure `visited` logic is robust.
    nodesProcessedCount < MAX_NODES_TO_RENDER
  ) {
    // If this node was ALREADY processed by orphan logic AND ALSO part of main chain path (complex cases),
    // it would be in `visited`. The first pass (populating `visited`) is key for orphan detection.
    // This second pass is for LAYING OUT the main chain identified.
    const nodeData = addressObjectMap[currentAddress];
    if (!nodeData || typeof nodeData !== "object" || Array.isArray(nodeData)) {
      break;
    }

    const nodeFields = {};
    if (nodeData.data !== undefined) {
      nodeFields.value = nodeData.data;
    } else if (nodeData.value !== undefined) {
      nodeFields.value = nodeData.value;
    } else {
      nodeFields.value = "null";
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
      y: mainChainY,
      address: currentAddress,
      title:
        nodeData.title || nodeData.url || truncateAddress(currentAddress, 6),
      fields: nodeFields,
      isIsolated: false, // Main chain nodes are not isolated by definition here
      style: styles.node,
    });

    // ADD MAIN CHAIN CONNECTIONS HERE
    const nextNodeAddr = nodeData.nextAddress || nodeData.next;
    if (nextNodeAddr && nextNodeAddr !== "0x0" && nextNodeAddr !== "null") {
      // Ensure the target node actually exists in the map before creating a connection
      // This prevents trying to draw arrows to non-existent or invalid addresses
      if (addressObjectMap[nextNodeAddr]) {
        allConnections.push({
          sourceName: currentAddress, // The current node's address
          targetAddress: nextNodeAddr, // The next node's address
          type: "ll_next", // Standard type for main chain next pointers
        });
      }
    }
    // END OF ADDED MAIN CHAIN CONNECTIONS

    currentX += styles.node.width + styles.layout.nodeSpacingX;
    mainChainLeftmostX = Math.min(
      mainChainLeftmostX,
      currentX - (styles.node.width + styles.layout.nodeSpacingX)
    ); // track leftmost edge of the first node
    currentAddress = nextNodeAddr; // Use the already determined nextNodeAddr for the next iteration
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

  // --- 5. ORPHAN CHAIN LAYOUT ---
  let orphanStartXGrid = orphanCellLeft + orphanCellPadding;
  const orphanYGrid =
    orphanCellTop + (orphanCellHeight - styles.node.height) / 2;
  let orphanXGrid = orphanStartXGrid;
  const orphanSpecs = [];
  const orphanAddrToSpec = {};
  orderedOrphanAddrs.forEach((addr, idx) => {
    const nodeData = addressObjectMap[addr];
    const orphanNodeFields = {};
    if (nodeData.data !== undefined) {
      orphanNodeFields.value = nodeData.data;
    } else if (nodeData.value !== undefined) {
      orphanNodeFields.value = nodeData.value;
    } else {
      orphanNodeFields.value = "null";
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
    const spec = {
      x: orphanXGrid,
      y: orphanYGrid,
      address: addr,
      title: nodeData.title || nodeData.url || truncateAddress(addr, 6),
      fields: orphanNodeFields,
      isIsolated: true,
      style: { ...styles.node, width: baseNodeWidth },
    };
    orphanSpecs.push(spec);
    orphanAddrToSpec[addr] = spec;
    orphanXGrid += baseNodeWidth + baseSpacing;
    visited.add(addr);
  });
  // Draw next-pointer arrows for orphans
  orphanSpecs.forEach((spec) => {
    const nodeData = addressObjectMap[spec.address];
    const nextAddr = nodeData.nextAddress || nodeData.next;
    // Check if nextAddr is a valid node in the overall map, not just another orphan
    if (
      nextAddr &&
      nextAddr !== "0x0" &&
      nextAddr !== "null" &&
      addressObjectMap[nextAddr]
    ) {
      allConnections.push({
        sourceName: spec.address,
        targetAddress: nextAddr,
        type: "ll_next", // Use the standard 'll_next' type for styling consistency
      });
    }
  });
  // Render all orphanSpecs
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

  // --- INSTANCE VARIABLES BOX ---
  let instanceVarsBoxHeight = 0;
  if (Object.keys(instanceVariables).length > 0) {
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
      width: styles.varBox.width,
      height: instanceVarsBoxHeight,
    };
  }

  // --- LOCAL VARIABLES BOX ---
  let localVarsBoxHeight = 0;
  if (Object.keys(localVariables).length > 0) {
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
      width: styles.varBox.width,
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

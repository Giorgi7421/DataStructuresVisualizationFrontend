import {
  isAddress,
  truncateAddress,
  defineArrowheads,
  renderVariableBox,
  renderGenericNode,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

// Reimplementation: Align with LinkedListVectorVisualization standards
export const renderWebBrowserVisualization = (
  contentGroup,
  width,
  height,
  operation,
  memorySnapshot
) => {
  console.log(
    "TOP OF renderWebBrowserVisualization (Aligned with LL Standard). Op:",
    operation,
    "Snap:",
    memorySnapshot
  );

  const state = memorySnapshot || operation.state || {};
  const localVariables = state.localVariables || {};
  const instanceVariables = state.instanceVariables || {};
  const addressObjectMap = state.addressObjectMap || {};

  // --- Styles (Aligned with LinkedListVectorVisualization) ---
  const styles = {
    varBox: {
      // From LLV
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
      // From LLV - base style
      width: 180,
      headerHeight: 25,
      fieldHeight: 25,
      fieldSpacing: 5,
      padding: 10,
      fill: "#ffffff", // Standard node fill
      stroke: "#94a3b8", // Standard node stroke
      titleFill: "#94a3b8",
      titleStroke: "#94a3b8",
      titleTextFill: "#334155",
      keyTextFill: "#334155",
      valueTextFill: "#334155",
      addressTextFill: "#0284c7",
      fieldRectFill: "none",
      fieldRectStroke: "#e2e8f0",
      fontSize: "12px",
      titleFontSize: "13px",
      height: 100, // Default height
      // Specific styles for current/isolated can be applied via nodeSpec.style override
      currentFill: "#e0f2fe", // Light blue for current page (override)
      currentStroke: "#0284c7", // Stronger blue for current page (override)
      isolatedFill: "#fefce8", // Light yellow for orphans (override)
      isolatedStroke: "#ca8a04", // Darker yellow for orphans (override)
    },
    connection: {
      // From LLV
      strokeWidth: 1.5,
      instanceVarColor: "#334155", // Dark Gray for instance/local
      nextColor: "#2563eb", // Blue for 'next' pointers
      prevColor: "#dc2626", // Red for 'prev' pointers (like in LLV)
      llInstanceVarMarkerId: "browser-instance-var-arrow", // Separate marker for var arrows
      llNextMarkerId: "browser-next-arrow", // Used for ALL connections
      llPrevMarkerId: "browser-prev-arrow", // Marker for 'prev' arrows
      cornerRadius: 8,
      defaultColor: "#64748b", // Fallback color
    },
    layout: {
      // From LLV
      nodeSpacingX: 60,
      varBoxSpacingY: 20,
      nodesStartXOffset: 60, // Space between var boxes and first node if needed
      layerSpacingY: 120,
    },
  };

  // --- Define Arrowheads ---
  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles); // Uses generic arrowheads + specific ones if IDs match
  // Ensure 'browser-prev-arrow' is defined (might be redundant if defineArrowheads is smart)
  /*
  if (defs.select(`#${styles.connection.llPrevMarkerId}`).empty()) {
    defs
      .append("marker")
      .attr("id", styles.connection.llPrevMarkerId)
      .attr("viewBox", "0 -5 10 10").attr("refX", 8).attr("refY", 0)
      .attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto-start-reverse")
      .append("path").attr("d", "M10,-5L0,0L10,5").attr("fill", styles.connection.prevColor);
  }
  */

  // --- Initialization ---
  const nodePositions = {};
  const allConnections = [];
  const visited = new Set(); // To track all rendered nodes (main chain + orphans)
  const MAX_NODES_TO_RENDER = 50;

  const firstColX = 30; // Align to this X for var boxes and start of node chains
  const varBoxTopMargin = 30;
  const nodeHeight = styles.node.height; // Use default from styles
  const nodeSpacingX = styles.layout.nodeSpacingX;

  // Define var box width reliably first
  const instanceVarsBoxWidth = styles.varBox.width;
  const localVarsBoxWidth = styles.varBox.width; // Also define local box width here for clarity
  const layerSpacingY = styles.layout.layerSpacingY; // <<<--- ADD BACK
  const nodeWidth = styles.node.width; // <<<--- ADD BACK

  // --- 1. Render Instance Variables (Top, Left Aligned) ---
  let topLayerBottomY = varBoxTopMargin;
  let instanceVarsBoxInfo = null;
  if (Object.keys(instanceVariables).length > 0) {
    const instanceVarsX = firstColX; // <<<--- ALIGN LEFT
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
    instanceVarsBoxInfo = {
      x: instanceVarsX,
      y: instanceVarsY,
      width: instanceVarsBoxWidth,
      height: instanceVarsResult.height,
    };
    nodePositions["instance_vars_box"] = instanceVarsBoxInfo;
    topLayerBottomY = instanceVarsY + instanceVarsResult.height;
  } else {
    topLayerBottomY = 0;
    instanceVarsBoxInfo = {
      x: firstColX,
      y: varBoxTopMargin,
      width: 0,
      height: 0,
    }; // Placeholder if no box
  }

  console.log(
    `[WebBrowserViz Layout Debug] Instance Vars Box X: ${instanceVarsBoxInfo?.x}`
  );

  // --- 2. Render Main History Chain (Horizontally - MIDDLE, offset right of Var Boxes) ---
  const middleLayerY =
    topLayerBottomY > 0 ? topLayerBottomY + layerSpacingY : varBoxTopMargin;
  // Recalculate start X for the main chain: Start relative to center to give space
  // const mainChainStartX_old = firstColX + instanceVarsBoxWidth + nodeSpacingX;
  const mainChainStartX = width / 2 + nodeSpacingX; // <<<--- START CHAIN RIGHT OF CENTER

  console.log(
    `[WebBrowserViz Layout Debug] Calculated Main Chain Start X (Center Offset): ${mainChainStartX}` // Updated log
  );
  let mainHistoryMaxNodeHeight = nodeHeight;
  const mainHistorySpecs = [];
  let middleLayerBottomY = middleLayerY; // Track bottom edge

  // Determine the actual current page address
  const currentVisiblePageAddress =
    instanceVariables?.current || instanceVariables?.currentPageAddress;
  console.log(
    `[WebBrowserViz Layout - Simplified] Current Page Addr: ${currentVisiblePageAddress}` // Updated log message
  );

  // --- Pre-calculate Back History Length ---
  let numBackNodes = 0;
  let tempBackAddr =
    instanceVariables?.current || instanceVariables?.currentPageAddress;
  if (tempBackAddr && addressObjectMap[tempBackAddr]) {
    tempBackAddr = addressObjectMap[tempBackAddr].previousAddress; // Start one step back
    let backVisited = new Set([
      instanceVariables?.current || instanceVariables?.currentPageAddress,
    ]); // Avoid cycles starting from current
    while (
      tempBackAddr &&
      tempBackAddr !== "0x0" &&
      addressObjectMap[tempBackAddr] &&
      !backVisited.has(tempBackAddr) &&
      numBackNodes < MAX_NODES_TO_RENDER / 2 // Sanity limit
    ) {
      backVisited.add(tempBackAddr);
      numBackNodes++;
      tempBackAddr = addressObjectMap[tempBackAddr].previousAddress;
    }
  }
  console.log(
    `[WebBrowserViz Layout Debug] Calculated numBackNodes: ${numBackNodes}`
  );

  // --- Simplified Rendering: Place CURRENT node first at mainChainStartX ---
  if (
    currentVisiblePageAddress &&
    addressObjectMap[currentVisiblePageAddress]
  ) {
    const nodeData = addressObjectMap[currentVisiblePageAddress];
    visited.add(currentVisiblePageAddress); // Mark current page as visited

    const nodeFields = {
      value: nodeData.url || nodeData.value || nodeData.data || "N/A",
      prev: nodeData.previousAddress || nodeData.prev || "null",
      next: nodeData.nextAddress || nodeData.next || "null",
    };

    // --- Calculate target X positions based on back node count ---
    const targetLeftmostX = firstColX + instanceVarsBoxWidth + nodeSpacingX / 2;
    const targetCurrentPageX =
      targetLeftmostX + numBackNodes * (nodeWidth + nodeSpacingX);

    // --- Place CURRENT page at the calculated start X ---
    const currentPageX = targetCurrentPageX; // <<<--- Use PRE-CALCULATED X based on back history
    const currentPageY = middleLayerY;
    const currentPageStyle = {
      ...styles.node,
      fill: styles.node.currentFill,
      stroke: styles.node.currentStroke,
      strokeWidth: 1.5,
    };

    console.log(
      `[WebBrowserViz Layout Debug] Placing CURRENT node (${currentVisiblePageAddress}) at X: ${currentPageX}`
    ); // Log current node placement

    mainHistorySpecs.push({
      x: currentPageX,
      y: currentPageY,
      address: currentVisiblePageAddress,
      title:
        nodeData.title ||
        truncateAddress(nodeFields.value) ||
        truncateAddress(currentVisiblePageAddress, 6),
      fields: nodeFields,
      isIsolated: false,
      isCurrent: true,
      style: currentPageStyle,
    });
    nodePositions[currentVisiblePageAddress] = {
      x: currentPageX,
      y: currentPageY,
      width: nodeWidth,
      height: nodeHeight,
      fields: nodeFields,
    };
    mainHistoryMaxNodeHeight = Math.max(mainHistoryMaxNodeHeight, nodeHeight);
    middleLayerBottomY = Math.max(
      middleLayerBottomY,
      currentPageY + nodeHeight
    );

    // Add connections for current page (same as before)
    if (
      nodeFields.next &&
      nodeFields.next !== "0x0" &&
      nodeFields.next !== "null"
    ) {
      allConnections.push({
        sourceName: currentVisiblePageAddress,
        targetAddress: nodeFields.next,
        type: "ll_next",
      });
    }
    if (
      nodeFields.prev &&
      nodeFields.prev !== "0x0" &&
      nodeFields.prev !== "null"
    ) {
      allConnections.push({
        sourceName: currentVisiblePageAddress,
        targetAddress: nodeFields.prev,
        type: "ll_prev",
      });
    }

    // --- Render BACK history to the LEFT of current (relative to currentPageX) ---
    let currentBackAddress = nodeFields.prev;
    let currentBackX = currentPageX - nodeWidth - nodeSpacingX; // <<<--- Relative to current X
    let nodesProcessedBack = 0;
    while (
      currentBackAddress &&
      currentBackAddress !== "0x0" &&
      !visited.has(currentBackAddress) &&
      nodesProcessedBack < MAX_NODES_TO_RENDER / 2
    ) {
      // ---> Log X of First Back Node <---
      if (nodesProcessedBack === 0) {
        console.log(
          `[WebBrowserViz Layout Debug] Placing FIRST BACK node (${currentBackAddress}) relative to current, at calculated X: ${currentBackX}`
        );
      }
      visited.add(currentBackAddress);
      const backNodeData = addressObjectMap[currentBackAddress];
      if (!backNodeData) break;
      const backNodeFields = {
        value:
          backNodeData.url || backNodeData.value || backNodeData.data || "N/A",
        prev: backNodeData.previousAddress || backNodeData.prev || "null",
        next: backNodeData.nextAddress || backNodeData.next || "null",
      };
      const backNodeHeight = nodeHeight;
      mainHistorySpecs.push({
        x: currentBackX,
        y: middleLayerY,
        address: currentBackAddress,
        title:
          backNodeData.title ||
          truncateAddress(backNodeFields.value) ||
          truncateAddress(currentBackAddress, 6),
        fields: backNodeFields,
        isIsolated: false,
        isCurrent: false,
        style: styles.node,
      });
      nodePositions[currentBackAddress] = {
        x: currentBackX,
        y: middleLayerY,
        width: nodeWidth,
        height: backNodeHeight,
        fields: backNodeFields,
      };
      mainHistoryMaxNodeHeight = Math.max(
        mainHistoryMaxNodeHeight,
        backNodeHeight
      );
      middleLayerBottomY = Math.max(
        middleLayerBottomY,
        middleLayerY + backNodeHeight
      );
      // Add connections (same as before)
      if (
        backNodeFields.next &&
        backNodeFields.next !== "0x0" &&
        backNodeFields.next !== "null"
      ) {
        allConnections.push({
          sourceName: currentBackAddress,
          targetAddress: backNodeFields.next,
          type: "ll_next",
        });
      }
      if (
        backNodeFields.prev &&
        backNodeFields.prev !== "0x0" &&
        backNodeFields.prev !== "null"
      ) {
        allConnections.push({
          sourceName: currentBackAddress,
          targetAddress: backNodeFields.prev,
          type: "ll_prev",
        });
      }
      currentBackAddress = backNodeFields.prev;
      currentBackX -= nodeWidth + nodeSpacingX;
      nodesProcessedBack++;
    }

    // --- Render FORWARD history to the RIGHT of current (relative to currentPageX) ---
    let currentFwdAddress = nodeFields.next;
    let currentFwdX = currentPageX + nodeWidth + nodeSpacingX; // <<<--- Relative to current X
    let nodesProcessedFwd = 0;
    while (
      currentFwdAddress &&
      currentFwdAddress !== "0x0" &&
      !visited.has(currentFwdAddress) &&
      nodesProcessedFwd < MAX_NODES_TO_RENDER / 2
    ) {
      // ---> Log X of First Forward Node <---
      if (nodesProcessedFwd === 0) {
        console.log(
          `[WebBrowserViz Layout Debug] Placing FIRST FORWARD node (${currentFwdAddress}) relative to current, at calculated X: ${currentFwdX}`
        );
      }
      visited.add(currentFwdAddress);
      const fwdNodeData = addressObjectMap[currentFwdAddress];
      if (!fwdNodeData) break;
      const fwdNodeFields = {
        value:
          fwdNodeData.url || fwdNodeData.value || fwdNodeData.data || "N/A",
        prev: fwdNodeData.previousAddress || fwdNodeData.prev || "null",
        next: fwdNodeData.nextAddress || fwdNodeData.next || "null",
      };
      const fwdNodeHeight = nodeHeight;
      mainHistorySpecs.push({
        x: currentFwdX,
        y: middleLayerY,
        address: currentFwdAddress,
        title:
          fwdNodeData.title ||
          truncateAddress(fwdNodeFields.value) ||
          truncateAddress(currentFwdAddress, 6),
        fields: fwdNodeFields,
        isIsolated: false,
        isCurrent: false,
        style: styles.node,
      });
      nodePositions[currentFwdAddress] = {
        x: currentFwdX,
        y: middleLayerY,
        width: nodeWidth,
        height: fwdNodeHeight,
        fields: fwdNodeFields,
      };
      mainHistoryMaxNodeHeight = Math.max(
        mainHistoryMaxNodeHeight,
        fwdNodeHeight
      );
      middleLayerBottomY = Math.max(
        middleLayerBottomY,
        middleLayerY + fwdNodeHeight
      );
      // Add connections (same as before)
      if (
        fwdNodeFields.next &&
        fwdNodeFields.next !== "0x0" &&
        fwdNodeFields.next !== "null"
      ) {
        allConnections.push({
          sourceName: currentFwdAddress,
          targetAddress: fwdNodeFields.next,
          type: "ll_next",
        });
      }
      if (
        fwdNodeFields.prev &&
        fwdNodeFields.prev !== "0x0" &&
        fwdNodeFields.prev !== "null"
      ) {
        allConnections.push({
          sourceName: currentFwdAddress,
          targetAddress: fwdNodeFields.prev,
          type: "ll_prev",
        });
      }
      currentFwdAddress = fwdNodeFields.next;
      currentFwdX += nodeWidth + nodeSpacingX;
      nodesProcessedFwd++;
    }

    // Render all collected main history nodes
    mainHistorySpecs.forEach((spec) => {
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
          `[WebBrowserViz Layout - Simplified] Error rendering MAIN HISTORY node (${spec.address}):`,
          e
        );
      }
    });
  } else {
    // Handle case where current page couldn't be determined
    console.warn(
      "[WebBrowserViz Layout - Simplified] No valid current page found."
    );
    contentGroup
      .append("text")
      .attr("x", width / 2)
      .attr("y", middleLayerY + 20)
      .attr("text-anchor", "middle")
      .text("Could not determine current page.");
    middleLayerBottomY = middleLayerY + 40; // Allocate some space for the message
  }

  const mainHistoryChainBottomY = middleLayerBottomY;

  // --- 3. Render Local Variables (Bottom, Left Aligned) ---
  let localVarsBoxInfo = null;
  const potentialBottomLayerY = mainHistoryChainBottomY + layerSpacingY;
  if (Object.keys(localVariables).length > 0) {
    const localVarsX = firstColX; // <<<--- ALIGN LEFT
    const localVarsY = potentialBottomLayerY;
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
    localVarsBoxInfo = {
      x: localVarsX,
      y: localVarsY,
      width: localVarsBoxWidth,
      height: localVarsResult.height,
    };
    nodePositions["local_vars_box"] = localVarsBoxInfo;
  } else {
    localVarsBoxInfo = {
      x: firstColX,
      y: potentialBottomLayerY,
      width: 0,
      height: 0,
    };
  }
  const bottomLayerActualY = localVarsBoxInfo.y;
  const localVarsRightEdge = localVarsBoxInfo.x + localVarsBoxInfo.width;

  // --- 4. Render Orphan Nodes (Bottom Layer, RIGHT of Local Vars, Wrapping) ---
  const orphanNodeStartY = bottomLayerActualY; // Start at the same Y as local vars
  let currentOrphanX =
    localVarsBoxInfo.width > 0 ? localVarsRightEdge + nodeSpacingX : firstColX; // Start right of locals, or far left if no locals
  let currentOrphanY = orphanNodeStartY;
  let bottomLayerMaxOrphanHeightInCurrentRow = 0;
  const orphanSpecs = [];

  const allPotentialNodeAddresses = Object.keys(addressObjectMap).filter(
    (addr) =>
      addressObjectMap[addr] &&
      typeof addressObjectMap[addr] === "object" &&
      !Array.isArray(addressObjectMap[addr]) &&
      (addressObjectMap[addr].hasOwnProperty("data") ||
        addressObjectMap[addr].hasOwnProperty("value") ||
        addressObjectMap[addr].hasOwnProperty("url") ||
        addressObjectMap[addr].hasOwnProperty("nextAddress") ||
        addressObjectMap[addr].hasOwnProperty("previousAddress"))
  );

  allPotentialNodeAddresses.forEach((addr) => {
    if (!visited.has(addr)) {
      // If not already rendered in main chain
      visited.add(addr);
      const nodeData = addressObjectMap[addr];
      if (!nodeData) return;

      const orphanNodeFields = {
        value: nodeData.url || nodeData.value || nodeData.data || "N/A",
        prev: nodeData.previousAddress || nodeData.prev || "null",
        next: nodeData.nextAddress || nodeData.next || "null",
      };

      const currentOrphanNodeHeight = nodeHeight; // Use default
      bottomLayerMaxOrphanHeightInCurrentRow = Math.max(
        bottomLayerMaxOrphanHeightInCurrentRow,
        currentOrphanNodeHeight
      );

      orphanSpecs.push({
        x: currentOrphanX,
        y: currentOrphanY,
        address: addr,
        title:
          nodeData.title ||
          truncateAddress(orphanNodeFields.value) ||
          truncateAddress(addr, 6),
        fields: orphanNodeFields,
        isIsolated: true,
        style: {
          ...styles.node,
          fill: styles.node.isolatedFill,
          stroke: styles.node.isolatedStroke,
          strokeDasharray: "4,4",
        },
      });

      nodePositions[addr] = {
        x: currentOrphanX,
        y: currentOrphanY,
        width: nodeWidth,
        height: currentOrphanNodeHeight,
        fields: orphanNodeFields,
      };

      // Add connections for this orphan node
      if (
        orphanNodeFields.next &&
        orphanNodeFields.next !== "0x0" &&
        orphanNodeFields.next !== "null"
      ) {
        allConnections.push({
          sourceName: addr,
          targetAddress: orphanNodeFields.next,
          type: "ll_next",
        });
      }
      if (
        orphanNodeFields.prev &&
        orphanNodeFields.prev !== "0x0" &&
        orphanNodeFields.prev !== "null"
      ) {
        allConnections.push({
          sourceName: addr,
          targetAddress: orphanNodeFields.prev,
          type: "ll_prev",
        });
      }

      // Update position for next orphan + wrapping logic
      currentOrphanX += nodeWidth + nodeSpacingX;
      // Wrap if exceeding page width
      if (currentOrphanX + nodeWidth > width - firstColX) {
        // Check against right edge boundary
        currentOrphanX =
          localVarsBoxInfo.width > 0
            ? localVarsRightEdge + nodeSpacingX
            : firstColX; // Reset X start point
        currentOrphanY += bottomLayerMaxOrphanHeightInCurrentRow + nodeSpacingX; // Move to next row
        bottomLayerMaxOrphanHeightInCurrentRow = 0; // Reset max height for new row
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
        `[WebBrowserViz Layout - Center] Error rendering ORPHAN node (${spec.address}):`,
        e
      );
    }
  });
  // const orphanNodesBottomY = currentOrphanY + bottomLayerMaxOrphanHeightInCurrentRow; // Not needed for next step

  // --- 5. Render Connections (Arrow Drawing Logic - Unchanged from previous step) ---
  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");
  allConnections.forEach((conn) => {
    let sourcePoint, targetPoint;
    let path = "";
    let markerId = styles.connection.llNextMarkerId; // Default to next
    let color = styles.connection.defaultColor; // Default color
    let strokeWidth = styles.connection.strokeWidth;
    const cornerRadius = styles.connection.cornerRadius || 5;
    let pathOrientationHint = "auto";
    const sNodeStyle = styles.node; // Use base node style for thresholds etc.

    // Y_THRESHOLD now based on the standard node height from styles
    const Y_THRESHOLD =
      (sNodeStyle && typeof sNodeStyle.height === "number"
        ? sNodeStyle.height
        : 100) * 0.6;
    const HORIZONTAL_OVERSHOOT = 20;
    const INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP = 20;

    // 1. Source Data
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
        console.warn(`[WBV Arrow] Missing source VarBox data:`, conn);
        return;
      }
    } else if (conn.sourceName && nodePositions[conn.sourceName]) {
      // Check if source node exists in positions
      sourceBoundingBoxPosData = nodePositions[conn.sourceName];
      // Calculate fieldYOffset based on conn.type (prev, next, or default to value/center)
      let fieldYOffset;
      let fieldNameToUse = "value"; // Default field if not prev/next (e.g. from an orphan pointing via 'value')
      if (conn.type === "ll_next") fieldNameToUse = "next";
      else if (conn.type === "ll_prev") fieldNameToUse = "prev";

      // Use fields stored in nodePositions if available, otherwise fallback
      const actualFields = sourceBoundingBoxPosData.fields || {
        value: "N/A",
        prev: "null",
        next: "null",
      };
      const fieldNames = Object.keys(actualFields);
      let fieldIndexToUse = fieldNames.indexOf(fieldNameToUse);

      if (fieldIndexToUse === -1) {
        // Fallback if specific field (next/prev) isn't there
        if (fieldNames.includes("value"))
          fieldIndexToUse = fieldNames.indexOf("value");
        else if (fieldNames.length > 0)
          fieldIndexToUse = fieldNames.length - 1; // last available field
        else fieldIndexToUse = 0; // Absolute fallback to first field index
      }

      // Use sNodeStyle for field height calculations for consistency
      if (
        sNodeStyle &&
        typeof sNodeStyle.fieldHeight === "number" &&
        typeof sNodeStyle.fieldSpacing === "number" &&
        typeof sNodeStyle.headerHeight === "number" &&
        typeof sNodeStyle.padding === "number"
      ) {
        fieldYOffset =
          sNodeStyle.headerHeight +
          sNodeStyle.padding +
          fieldIndexToUse * (sNodeStyle.fieldHeight + sNodeStyle.fieldSpacing) +
          sNodeStyle.fieldHeight / 2;
      } else {
        // Fallback if style properties are missing (should not happen with new style object)
        fieldYOffset =
          (sourceBoundingBoxPosData.height || sNodeStyle.height) / 2;
      }
      specificFieldInitialCoords = {
        x:
          sourceBoundingBoxPosData.x +
          (sourceBoundingBoxPosData.width || sNodeStyle.width) / 2, // Egress X will be adjusted later
        y: sourceBoundingBoxPosData.y + fieldYOffset,
      };
    } else {
      console.warn(
        "[WBV Arrow] Connection sourceName not found or missing in nodePositions:",
        conn.sourceName,
        conn
      );
      return;
    }

    // 2. Target Data
    const targetPosData = nodePositions[conn.targetAddress];
    if (!targetPosData) {
      if (
        (conn.type === "ll_next" || conn.type === "ll_prev") &&
        (conn.targetAddress === "0x0" ||
          conn.targetAddress === "null" ||
          !conn.targetAddress)
      ) {
        if (specificFieldInitialCoords && sourceBoundingBoxPosData) {
          const side = conn.type === "ll_prev" ? "left" : "right";
          const egressX =
            side === "left"
              ? sourceBoundingBoxPosData.x
              : sourceBoundingBoxPosData.x +
                (sourceBoundingBoxPosData.width || sNodeStyle.width);
          const nullEndX = side === "left" ? egressX - 20 : egressX + 20;
          const egressY = specificFieldInitialCoords.y;
          connectionsGroup
            .append("line")
            .attr("x1", egressX)
            .attr("y1", egressY)
            .attr("x2", nullEndX)
            .attr("y2", egressY)
            .attr("stroke", styles.connection.nextColor)
            .attr("stroke-width", strokeWidth)
            .attr("stroke-dasharray", "3,3");
        }
        return;
      }
      console.warn(
        `[WBV Arrow] Target Node not found for address:`,
        conn.targetAddress,
        conn
      );
      return;
    }

    // 3. Coordinates & Deltas
    const sourceOverallMidX =
      sourceBoundingBoxPosData.x +
      (sourceBoundingBoxPosData.width || sNodeStyle.width) / 2;
    const sourceFieldActualY = specificFieldInitialCoords.y;
    const targetOverallMidX =
      targetPosData.x + (targetPosData.width || sNodeStyle.width) / 2;
    const targetOverallMidY =
      targetPosData.y + (targetPosData.height || sNodeStyle.height) / 2;
    let decisionSourceY = sourceFieldActualY;

    if (
      (conn.type === "ll_next" || conn.type === "ll_prev") &&
      !conn.sourceName.includes("vars_box") && // Only for node-to-node, not varbox-to-node
      sourceBoundingBoxPosData &&
      typeof sourceBoundingBoxPosData.height === "number"
    ) {
      decisionSourceY =
        sourceBoundingBoxPosData.y + sourceBoundingBoxPosData.height / 2;
    }
    const deltaXOverallMid = Math.abs(targetOverallMidX - sourceOverallMidX);
    const deltaYDecisionMid = Math.abs(targetOverallMidY - decisionSourceY);

    // 4. Egress Side & Source Point
    const chosenEgressSide =
      targetOverallMidX < sourceOverallMidX ? "left" : "right";
    sourcePoint = { y: sourceFieldActualY };
    if (chosenEgressSide === "left") {
      sourcePoint.x = sourceBoundingBoxPosData.x;
    } else {
      sourcePoint.x =
        sourceBoundingBoxPosData.x +
        (sourceBoundingBoxPosData.width || sNodeStyle.width);
    }

    // 5. Path Style Decision
    if (deltaYDecisionMid <= Y_THRESHOLD) {
      pathOrientationHint = "H-V-H";
      targetPoint = {
        x:
          sourceOverallMidX < targetOverallMidX
            ? targetPosData.x
            : targetPosData.x + (targetPosData.width || sNodeStyle.width),
        y: targetOverallMidY,
      };
    } else {
      pathOrientationHint = "H-V_to_target_top";
      const sourceRightX =
        sourceBoundingBoxPosData.x +
        (sourceBoundingBoxPosData.width || sNodeStyle.width);
      const targetRightX =
        targetPosData.x + (targetPosData.width || sNodeStyle.width);
      const overlap =
        Math.max(sourceBoundingBoxPosData.x, targetPosData.x) <
        Math.min(sourceRightX, targetRightX);

      if (!overlap) {
        let approachingEdgeX =
          chosenEgressSide === "right" ? targetPosData.x : targetRightX;
        let overshotX =
          chosenEgressSide === "right"
            ? approachingEdgeX + HORIZONTAL_OVERSHOOT
            : approachingEdgeX - HORIZONTAL_OVERSHOOT;
        targetPoint = {
          x: overshotX,
          y:
            decisionSourceY < targetOverallMidY
              ? targetPosData.y
              : targetPosData.y + (targetPosData.height || sNodeStyle.height),
        };
      } else {
        let turnX =
          chosenEgressSide === "right"
            ? sourcePoint.x + INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP
            : sourcePoint.x - INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP;
        targetPoint = {
          x: turnX,
          y:
            decisionSourceY < targetOverallMidY
              ? targetPosData.y
              : targetPosData.y + (targetPosData.height || sNodeStyle.height),
        };
      }
    }

    // 6. Marker and Color - STANDARDIZED
    /* Original Logic
    if (conn.type === "ll_next") {
        markerId = styles.connection.llNextMarkerId;
        color = styles.connection.nextColor;
    } else if (conn.type === "ll_prev") {
        markerId = styles.connection.llNextMarkerId; // USE NEXT_MARKER_ID FOR PREV
        color = styles.connection.nextColor;    // USE NEXT_COLOR FOR PREV
    } else { // instance or local vars
        markerId = styles.connection.llInstanceVarMarkerId;
        color = styles.connection.instanceVarColor;
    }
    color = color || styles.connection.defaultColor; // Fallback if specific color undefined
    */

    // New Logic: Differentiate colors and markers based on connection type
    if (
      conn.sourceName &&
      (conn.sourceName.startsWith("instance-") ||
        conn.sourceName.startsWith("local-"))
    ) {
      // Connection from a variable box
      markerId = styles.connection.llInstanceVarMarkerId;
      color = styles.connection.instanceVarColor;
    } else if (conn.type === "ll_next") {
      markerId = styles.connection.llNextMarkerId;
      color = styles.connection.nextColor;
    } else if (conn.type === "ll_prev") {
      markerId = styles.connection.llPrevMarkerId;
      color = styles.connection.prevColor;
    }
    // Ensure color has a fallback if a specific one wasn't assigned (shouldn't happen with above logic)
    color = color || styles.connection.defaultColor;

    // 7. Generate Path Offset
    let initialOffset = 15;
    if (pathOrientationHint === "H-V-H") {
      const xDistForOffset = deltaXOverallMid / 2 - cornerRadius * 2;
      const yDistForOffset = Math.abs(targetPoint.y - sourcePoint.y) * 0.4;
      initialOffset = Math.max(5, Math.min(30, xDistForOffset, yDistForOffset));
    }

    // 8. Generate Path
    path = generateOrthogonalPath(
      sourcePoint,
      targetPoint,
      cornerRadius,
      pathOrientationHint,
      initialOffset,
      null
    );

    // 9. Draw Path
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
        "[WebBrowserViz Arrow] Path empty/points missing for connection:",
        conn,
        "Source:",
        sourcePoint,
        "Target:",
        targetPoint
      );
    }
  });

  console.log(
    "Finished renderWebBrowserVisualization (Aligned & Arrows). Node Positions:",
    nodePositions,
    "Connections:",
    allConnections
  );
};

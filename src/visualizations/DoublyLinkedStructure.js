import {
  isAddress,
  truncateAddress,
  defineArrowheads,
  renderVariableBox,
  renderGenericNode,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

// Reimplementation: Align with LinkedListVectorVisualization standards
export const renderDoublyLinkedStructureVisualization = (
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
      nodesStartXOffset: 60,
      layerSpacingY: 120,
      orphanNodeSpacingX: 40,
      mainChainRightMargin: 60,
      topToMainSpacing: 40,
      sectionWidth: width / 3, // Divide width into three equal sections
      sectionHeight: height / 4, // Divide height into four equal sections
      sectionSpacingY: 40, // Increased from 20 to 40 for more vertical spacing
    },
  };

  // Calculate section boundaries
  const leftSectionEnd = styles.layout.sectionWidth;
  const rightSectionStart = width - styles.layout.sectionWidth;
  const rightSectionWidth =
    styles.layout.sectionWidth - styles.layout.mainChainRightMargin;

  // Calculate section heights
  const topSectionHeight = styles.layout.sectionHeight;
  const mainSectionHeight = styles.layout.sectionHeight;
  const orphanSectionHeight = styles.layout.sectionHeight;
  const bottomSectionHeight = styles.layout.sectionHeight;

  // Calculate layer positions with proper spacing
  const topLayerY = styles.layout.sectionSpacingY;
  const mainChainLayerY =
    topLayerY + topSectionHeight + styles.layout.sectionSpacingY;
  const orphanLayerY =
    mainChainLayerY + mainSectionHeight + styles.layout.sectionSpacingY;
  const localVarsLayerY =
    orphanLayerY + orphanSectionHeight + styles.layout.sectionSpacingY;

  // --- Define Arrowheads ---
  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles);

  // --- Initialization ---
  const nodePositions = {};
  const allConnections = [];
  const visited = new Set();
  const MAX_NODES_TO_RENDER = 50;

  const firstColX = 30;
  const nodeHeight = styles.node.height;
  const nodeSpacingX = styles.layout.nodeSpacingX;

  // Define var box width reliably first
  const instanceVarsBoxWidth = styles.varBox.width;
  const localVarsBoxWidth = styles.varBox.width;
  const nodeWidth = styles.node.width;

  // --- 1. Render Instance Variables (Top, Center) ---
  let topLayerBottomY = topLayerY;
  let instanceVarsBoxInfo = null;
  if (Object.keys(instanceVariables).length > 0) {
    const instanceVarsX = width / 2 - instanceVarsBoxWidth / 2;
    const instanceVarsY =
      topLayerY + (topSectionHeight - instanceVarsBoxWidth) / 2;
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
    topLayerBottomY = topLayerY;
    instanceVarsBoxInfo = {
      x: width / 2 - instanceVarsBoxWidth / 2,
      y: topLayerY,
      width: 0,
      height: 0,
    };
  }

  console.log(
    `[WebBrowserViz Layout Debug] Instance Vars Box X: ${instanceVarsBoxInfo?.x}`
  );

  // --- 2. Render Main Chain (Second Layer, Right Section) ---
  // Calculate the rightmost position for the main chain
  const mainChainRightX = width - styles.layout.mainChainRightMargin;
  let currentX = mainChainRightX;

  let mainHistoryMaxNodeHeight = nodeHeight;
  const mainHistorySpecs = [];
  let middleLayerBottomY = mainChainLayerY;

  // Find the start of the chain from instance variables or by finding a node with null prev
  let startAddress =
    instanceVariables.head ||
    instanceVariables.front ||
    instanceVariables.start ||
    instanceVariables.first ||
    instanceVariables.root;

  // If no start address found in instance variables, look for a node with null prev
  if (!startAddress || !addressObjectMap[startAddress]) {
    const allNodeAddrs = Object.keys(addressObjectMap).filter(
      (addr) =>
        addressObjectMap[addr] &&
        typeof addressObjectMap[addr] === "object" &&
        !Array.isArray(addressObjectMap[addr])
    );

    // Find nodes that are not pointed to by any other node's previousAddress
    const pointedToAddrs = new Set();
    allNodeAddrs.forEach((addr) => {
      const nodeData = addressObjectMap[addr];
      if (
        nodeData &&
        nodeData.previousAddress &&
        nodeData.previousAddress !== "0x0" &&
        nodeData.previousAddress !== "null"
      ) {
        pointedToAddrs.add(nodeData.previousAddress);
      }
    });

    // Nodes that are not pointed to by any other node's previousAddress are potential starts
    const potentialStarts = allNodeAddrs.filter(
      (addr) => !pointedToAddrs.has(addr)
    );

    if (potentialStarts.length > 0) {
      startAddress = potentialStarts[0];
    } else if (allNodeAddrs.length > 0) {
      startAddress = allNodeAddrs[0];
    }
  }

  console.log(`[DoublyLinkedViz Layout] Start Address: ${startAddress}`);
  console.log(`[DoublyLinkedViz Layout] Address Object Map:`, addressObjectMap);

  // --- Simplified Rendering: Start from the head of the list ---
  if (startAddress && addressObjectMap[startAddress]) {
    // First, find the current node's position
    const startNodeData = addressObjectMap[startAddress];
    const startNodeFields = {
      value: startNodeData.value || startNodeData.data || "N/A",
      prev: startNodeData.previousAddress || startNodeData.prev || "null",
      next: startNodeData.nextAddress || startNodeData.next || "null",
    };

    // Place start node at the rightmost position
    const startNodeX = mainChainRightX;
    const startNodeY = mainChainLayerY;
    const startNodeStyle = {
      ...styles.node,
      fill: styles.node.currentFill,
      stroke: styles.node.currentStroke,
      strokeWidth: 1.5,
    };

    mainHistorySpecs.push({
      x: startNodeX,
      y: startNodeY,
      address: startAddress,
      title:
        startNodeData.title ||
        truncateAddress(startNodeFields.value) ||
        truncateAddress(startAddress, 6),
      fields: startNodeFields,
      isIsolated: false,
      style: startNodeStyle,
    });

    nodePositions[startAddress] = {
      x: startNodeX,
      y: startNodeY,
      width: nodeWidth,
      height: nodeHeight,
      fields: startNodeFields,
    };

    // Render previous nodes to the left
    let currentPrevAddress = startNodeFields.prev;
    let currentPrevX = startNodeX - nodeWidth - nodeSpacingX;
    let nodesProcessedPrev = 0;

    while (
      currentPrevAddress &&
      currentPrevAddress !== "0x0" &&
      currentPrevAddress !== "null" &&
      !visited.has(currentPrevAddress) &&
      nodesProcessedPrev < MAX_NODES_TO_RENDER / 2
    ) {
      visited.add(currentPrevAddress);
      const prevNodeData = addressObjectMap[currentPrevAddress];
      if (!prevNodeData) break;

      const prevNodeFields = {
        value: prevNodeData.value || prevNodeData.data || "N/A",
        prev: prevNodeData.previousAddress || prevNodeData.prev || "null",
        next: prevNodeData.nextAddress || prevNodeData.next || "null",
      };

      mainHistorySpecs.push({
        x: currentPrevX,
        y: startNodeY,
        address: currentPrevAddress,
        title:
          prevNodeData.title ||
          truncateAddress(prevNodeFields.value) ||
          truncateAddress(currentPrevAddress, 6),
        fields: prevNodeFields,
        isIsolated: false,
        style: styles.node,
      });

      nodePositions[currentPrevAddress] = {
        x: currentPrevX,
        y: startNodeY,
        width: nodeWidth,
        height: nodeHeight,
        fields: prevNodeFields,
      };

      // Add connections
      if (
        prevNodeFields.next &&
        prevNodeFields.next !== "0x0" &&
        prevNodeFields.next !== "null"
      ) {
        allConnections.push({
          sourceName: currentPrevAddress,
          targetAddress: prevNodeFields.next,
          type: "ll_next",
        });
      }
      if (
        prevNodeFields.prev &&
        prevNodeFields.prev !== "0x0" &&
        prevNodeFields.prev !== "null"
      ) {
        allConnections.push({
          sourceName: currentPrevAddress,
          targetAddress: prevNodeFields.prev,
          type: "ll_prev",
        });
      }

      currentPrevAddress = prevNodeFields.prev;
      currentPrevX -= nodeWidth + nodeSpacingX;
      nodesProcessedPrev++;
    }

    // Render next nodes to the right
    let currentNextAddress = startNodeFields.next;
    let currentNextX = startNodeX + nodeWidth + nodeSpacingX;
    let nodesProcessedNext = 0;

    while (
      currentNextAddress &&
      currentNextAddress !== "0x0" &&
      currentNextAddress !== "null" &&
      !visited.has(currentNextAddress) &&
      nodesProcessedNext < MAX_NODES_TO_RENDER / 2
    ) {
      visited.add(currentNextAddress);
      const nextNodeData = addressObjectMap[currentNextAddress];
      if (!nextNodeData) break;

      const nextNodeFields = {
        value: nextNodeData.value || nextNodeData.data || "N/A",
        prev: nextNodeData.previousAddress || nextNodeData.prev || "null",
        next: nextNodeData.nextAddress || nextNodeData.next || "null",
      };

      mainHistorySpecs.push({
        x: currentNextX,
        y: startNodeY,
        address: currentNextAddress,
        title:
          nextNodeData.title ||
          truncateAddress(nextNodeFields.value) ||
          truncateAddress(currentNextAddress, 6),
        fields: nextNodeFields,
        isIsolated: false,
        style: styles.node,
      });

      nodePositions[currentNextAddress] = {
        x: currentNextX,
        y: startNodeY,
        width: nodeWidth,
        height: nodeHeight,
        fields: nextNodeFields,
      };

      // Add connections
      if (
        nextNodeFields.next &&
        nextNodeFields.next !== "0x0" &&
        nextNodeFields.next !== "null"
      ) {
        allConnections.push({
          sourceName: currentNextAddress,
          targetAddress: nextNodeFields.next,
          type: "ll_next",
        });
      }
      if (
        nextNodeFields.prev &&
        nextNodeFields.prev !== "0x0" &&
        nextNodeFields.prev !== "null"
      ) {
        allConnections.push({
          sourceName: currentNextAddress,
          targetAddress: nextNodeFields.prev,
          type: "ll_prev",
        });
      }

      currentNextAddress = nextNodeFields.next;
      currentNextX += nodeWidth + nodeSpacingX;
      nodesProcessedNext++;
    }

    // Add connections for start node
    if (
      startNodeFields.next &&
      startNodeFields.next !== "0x0" &&
      startNodeFields.next !== "null"
    ) {
      allConnections.push({
        sourceName: startAddress,
        targetAddress: startNodeFields.next,
        type: "ll_next",
      });
    }
    if (
      startNodeFields.prev &&
      startNodeFields.prev !== "0x0" &&
      startNodeFields.prev !== "null"
    ) {
      allConnections.push({
        sourceName: startAddress,
        targetAddress: startNodeFields.prev,
        type: "ll_prev",
      });
    }

    // Render all collected nodes
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
          `[DoublyLinkedViz] Error rendering node (${spec.address}):`,
          e
        );
      }
    });
  } else {
    // Handle case where no valid start node was found
    console.warn("[DoublyLinkedViz] No valid start node found.");
    contentGroup
      .append("text")
      .attr("x", width / 2)
      .attr("y", mainChainLayerY + 20)
      .attr("text-anchor", "middle")
      .text("Could not determine start of list.");
    middleLayerBottomY = mainChainLayerY + 40;
  }

  const mainChainBottomY = middleLayerBottomY;

  // --- 3. Render Orphan Nodes (Third Layer, Left Section) ---
  const orphanNodeStartX = firstColX;
  const orphanNodeY = orphanLayerY + (orphanSectionHeight - nodeHeight) / 2; // Center vertically in orphan section
  let currentOrphanX = orphanNodeStartX;
  let currentOrphanY = orphanNodeY;
  let orphanRowHeight = 0;
  const orphanSpecs = [];

  // Get all nodes that are part of the main chain
  const mainChainNodes = new Set();
  if (startAddress && addressObjectMap[startAddress]) {
    // Add start node
    mainChainNodes.add(startAddress);

    // Add all previous nodes
    let currentPrevAddress =
      addressObjectMap[startAddress].previousAddress ||
      addressObjectMap[startAddress].prev;
    while (
      currentPrevAddress &&
      currentPrevAddress !== "0x0" &&
      currentPrevAddress !== "null"
    ) {
      mainChainNodes.add(currentPrevAddress);
      currentPrevAddress =
        addressObjectMap[currentPrevAddress]?.previousAddress ||
        addressObjectMap[currentPrevAddress]?.prev;
    }

    // Add all next nodes
    let currentNextAddress =
      addressObjectMap[startAddress].nextAddress ||
      addressObjectMap[startAddress].next;
    while (
      currentNextAddress &&
      currentNextAddress !== "0x0" &&
      currentNextAddress !== "null"
    ) {
      mainChainNodes.add(currentNextAddress);
      currentNextAddress =
        addressObjectMap[currentNextAddress]?.nextAddress ||
        addressObjectMap[currentNextAddress]?.next;
    }
  }

  const allPotentialNodeAddresses = Object.keys(addressObjectMap).filter(
    (addr) =>
      addressObjectMap[addr] &&
      typeof addressObjectMap[addr] === "object" &&
      !Array.isArray(addressObjectMap[addr]) &&
      (addressObjectMap[addr].hasOwnProperty("data") ||
        addressObjectMap[addr].hasOwnProperty("value") ||
        addressObjectMap[addr].hasOwnProperty("nextAddress") ||
        addressObjectMap[addr].hasOwnProperty("previousAddress"))
  );

  allPotentialNodeAddresses.forEach((addr) => {
    // Skip if node is part of the main chain
    if (mainChainNodes.has(addr)) {
      return;
    }

    if (!visited.has(addr)) {
      visited.add(addr);
      const nodeData = addressObjectMap[addr];
      if (!nodeData) return;

      const orphanNodeFields = {
        value: nodeData.value || nodeData.data || "N/A",
        prev: nodeData.previousAddress || nodeData.prev || "null",
        next: nodeData.nextAddress || nodeData.next || "null",
      };

      const currentOrphanNodeHeight = nodeHeight;
      orphanRowHeight = Math.max(orphanRowHeight, currentOrphanNodeHeight);

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
      currentOrphanX += nodeWidth + styles.layout.orphanNodeSpacingX;
      // Wrap if exceeding left section boundary
      if (
        currentOrphanX + nodeWidth >
        leftSectionEnd - styles.layout.nodeSpacingX
      ) {
        currentOrphanX = orphanNodeStartX;
        currentOrphanY += orphanRowHeight + styles.layout.nodeSpacingX;
        orphanRowHeight = 0;
      }
    }
  });

  // Render orphan nodes
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
        `[WebBrowserViz] Error rendering ORPHAN node (${spec.address}):`,
        e
      );
    }
  });

  // --- 4. Render Local Variables (Bottom, Center) ---
  if (Object.keys(localVariables).length > 0) {
    const localVarsX = width / 2 - localVarsBoxWidth / 2; // Center in middle section
    const localVarsY =
      localVarsLayerY + (bottomSectionHeight - localVarsBoxWidth) / 2; // Center vertically in bottom section
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
    nodePositions["local_vars_box"] = {
      x: localVarsX,
      y: localVarsY,
      width: localVarsBoxWidth,
      height: localVarsResult.height,
    };
  }

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

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
    "TOP OF renderDoublyLinkedStructureVisualization (Applying 5-step layout - Iteration 1). Op:",
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

  // --- 1. INITIAL MAIN CHAIN TRAVERSAL (Populate visited set) ---
  console.log(
    "[DLS Step 1] Starting Initial Main Chain Traversal for 'visited' set."
  );
  let trueStartAddress =
    instanceVariables.current ||
    instanceVariables.currentPage ||
    instanceVariables.head ||
    instanceVariables.front ||
    instanceVariables.start ||
    instanceVariables.first ||
    instanceVariables.root;

  if (
    !trueStartAddress ||
    trueStartAddress === "0x0" ||
    trueStartAddress === "null" ||
    !addressObjectMap[trueStartAddress]
  ) {
    console.log(
      "[DLS Step 1] No primary start (current/head) in instance vars, searching for a node with null/0x0 prev."
    );
    const allNodeAddrs = Object.keys(addressObjectMap).filter(
      (addr) =>
        addressObjectMap[addr] &&
        typeof addressObjectMap[addr] === "object" &&
        !Array.isArray(addressObjectMap[addr])
    );
    let potentialStart = null;
    for (const addr of allNodeAddrs) {
      const nodeData = addressObjectMap[addr];
      if (nodeData) {
        const prev = nodeData.previousAddress || nodeData.prev;
        if (prev === "0x0" || prev === "null" || !prev) {
          potentialStart = addr;
          break;
        }
      }
    }
    if (potentialStart) trueStartAddress = potentialStart;
    else if (allNodeAddrs.length > 0) trueStartAddress = allNodeAddrs[0];
    else trueStartAddress = null;
  }
  console.log(
    `[DLS Step 1] True Start Address for visited set: ${trueStartAddress}`
  );

  if (trueStartAddress && addressObjectMap[trueStartAddress]) {
    // Traverse backwards from trueStartAddress for visited set
    let count = 0;
    let currentForVisited = trueStartAddress;
    while (
      currentForVisited &&
      currentForVisited !== "0x0" &&
      currentForVisited !== "null" &&
      count < MAX_NODES_TO_RENDER
    ) {
      if (visited.has(currentForVisited)) break; // Already visited (e.g. if trueStartAddress was part of a loop detected from 'next' traversal)
      visited.add(currentForVisited);
      const nodeData = addressObjectMap[currentForVisited];
      if (!nodeData) break;
      currentForVisited = nodeData.previousAddress || nodeData.prev;
      count++;
    }

    // Traverse forwards from trueStartAddress for visited set
    count = 0; // Reset count for forward traversal
    currentForVisited = trueStartAddress; // Start again from the true start for forward pass
    // The first node (trueStartAddress) is already added by the backward pass if it's the start of backward pass, or will be added here.
    while (
      currentForVisited &&
      currentForVisited !== "0x0" &&
      currentForVisited !== "null" &&
      count < MAX_NODES_TO_RENDER
    ) {
      visited.add(currentForVisited); // Add to visited (safe if already there)
      const nodeData = addressObjectMap[currentForVisited];
      if (!nodeData) break;
      currentForVisited = nodeData.nextAddress || nodeData.next;
      count++;
      if (visited.has(currentForVisited) && count < MAX_NODES_TO_RENDER) {
        // Break if we hit an already visited node (loop detection)
        console.log(
          "[DLS Step 1] Loop detected during forward traversal for visited set, breaking."
        );
        break;
      }
    }
  }
  console.log("[DLS Step 1] Visited set populated:", visited);

  // --- 2. ORPHAN CHAIN ORDERING (Define orderedOrphanAddrs) ---
  console.log("[DLS Step 2] Starting Orphan Chain Ordering");
  const orphanAddrs = Object.keys(addressObjectMap).filter(
    (addr) =>
      addressObjectMap[addr] &&
      typeof addressObjectMap[addr] === "object" &&
      !Array.isArray(addressObjectMap[addr]) &&
      !visited.has(addr)
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
    const chainVisitedThisOrphanRun = new Set();
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
  console.log("[DLS Step 2] Ordered orphan addresses:", orderedOrphanAddrs);

  // --- 3. GRID SETUP (Define mainChainStartX, mainChainY, etc.) ---
  console.log("[DLS Step 3] Starting Grid Setup");
  const gridRows = 4;
  const baseGridCols = 3;
  const cellHeight = height / gridRows;

  const orphanNodeCount =
    orderedOrphanAddrs.length > 0 ? orderedOrphanAddrs.length : 1;
  const baseNodeWidth = styles.node.width;
  const baseSpacing = styles.layout.orphanNodeSpacingX;
  const orphanCellPadding = 20;
  const calculatedOrphanCellWidth =
    orphanNodeCount * baseNodeWidth +
    (orphanNodeCount - 1) * baseSpacing +
    2 * orphanCellPadding;

  const remainingWidthForOtherCells = Math.max(
    width - calculatedOrphanCellWidth,
    baseNodeWidth * (baseGridCols - 1) + baseSpacing * (baseGridCols - 2)
  );
  const otherCellWidth =
    baseGridCols - 1 > 0
      ? remainingWidthForOtherCells / (baseGridCols - 1)
      : remainingWidthForOtherCells;

  // Conceptual layout: Orphans (col 0), Instance/Local Vars (col 1), Main Chain (col 2)
  const cellWidthsArray = [];
  // Order of cells for colXCoords: Orphan, Other1 (e.g. IV/LV), Other2 (e.g. MainChain)
  cellWidthsArray[0] = calculatedOrphanCellWidth;
  cellWidthsArray[1] = otherCellWidth;
  cellWidthsArray[2] = otherCellWidth;
  // Ensure the total width does not exceed canvas width, adjust if necessary (basic scaling)
  let totalCalculatedWidth = cellWidthsArray.reduce((a, b) => a + b, 0);
  if (totalCalculatedWidth > width) {
    const scaleFactor = width / totalCalculatedWidth;
    for (let i = 0; i < cellWidthsArray.length; i++)
      cellWidthsArray[i] *= scaleFactor;
  }

  const colXCoords = [0];
  for (let i = 0; i < cellWidthsArray.length; i++) {
    colXCoords.push(colXCoords[i] + cellWidthsArray[i]);
  }

  // Grid cell assignments (adjust X based on desired column for each element)
  // Orphan Area (e.g. First Column)
  const orphanCellLeft = colXCoords[0];
  const orphanGridY = cellHeight * 2 + cellHeight / 2 - styles.node.height / 2;

  // Instance Vars (e.g. Middle Column, Top Row)
  const instanceVarsX =
    colXCoords[1] + cellWidthsArray[1] / 2 - styles.varBox.width / 2;
  const instanceVarsY =
    cellHeight * 0 +
    cellHeight / 2 -
    styles.varBox.headerHeight / 2 -
    styles.varBox.padding;

  // Main Chain (e.g. Rightmost Column, Middle Row)
  const mainChainStartX = colXCoords[2] + styles.layout.nodesStartXOffset;
  const mainChainY = cellHeight * 1 + cellHeight / 2 - styles.node.height / 2;

  // Local Vars (e.g. Middle Column, Bottom Row)
  const localVarsX =
    colXCoords[1] + cellWidthsArray[1] / 2 - styles.varBox.width / 2;
  const localVarsY =
    cellHeight * 3 +
    cellHeight / 2 -
    styles.varBox.headerHeight / 2 -
    styles.varBox.padding;

  console.log(
    `[DLS Step 3] Grid Coords: mainX=${mainChainStartX}, mainY=${mainChainY}, orphanY=${orphanGridY}, orphanLeft=${orphanCellLeft}, instX=${instanceVarsX}, instY=${instanceVarsY}, localX=${localVarsX}, localY=${localVarsY}`
  );
  console.log(
    `[DLS Step 3] Cell Widths: Orphan=${cellWidthsArray[0]}, IV/LV Col=${cellWidthsArray[1]}, Main Col=${cellWidthsArray[2]}`
  );

  // --- EXISTING RENDER Instance Variables (Top, Center) ---
  // This will use instanceVarsX, instanceVarsY from Step 3
  let instanceVarsBoxInfo = null; // Keep for potential use in connection drawing or other layout
  if (Object.keys(instanceVariables).length > 0) {
    const instanceVarsResult = renderVariableBox(
      contentGroup,
      "Instance Variables",
      instanceVariables,
      instanceVarsX, // Use new grid X
      instanceVarsY, // Use new grid Y
      styles.varBox,
      "instance",
      isAddress
    );
    allConnections.push(...instanceVarsResult.connectionPoints);
    instanceVarsBoxInfo = {
      x: instanceVarsX,
      y: instanceVarsY,
      width: styles.varBox.width, // varBox has fixed width
      height: instanceVarsResult.height,
    };
    nodePositions["instance_vars_box"] = instanceVarsBoxInfo;
  }
  console.log("[DLS] Instance Variables Rendered (if any).");

  // --- COMMENT OUT OLD MAIN CHAIN AND ORPHAN RENDERING LOGIC ---
  /*
  // --- 2. Render Main Chain (Second Layer, Right Section) ---
  // ... (lots of old main chain rendering logic here) ...
  console.log(`[DoublyLinkedViz Layout] Start Address: ${startAddress}`);
  console.log(`[DoublyLinkedViz Layout] Address Object Map:`, addressObjectMap);

  // --- Simplified Rendering: Start from the head of the list ---
  if (startAddress && addressObjectMap[startAddress]) {
    // ... (old logic for rendering start node, then prev nodes, then next nodes) ...
  } else {
    // Handle case where no valid start node was found
    // ...
  }

  // --- 3. Render Orphan Nodes (Third Layer, Left Section) ---
  // ... (old orphan rendering logic here) ...
  */
  console.log(
    "[DLS] Old Main Chain and Orphan rendering sections are COMMENTED OUT."
  );

  // --- STEP 4: MAIN CHAIN LAYOUT (Populate mainListSpecs) ---
  console.log("[DLS Step 4] Starting Main Chain Layout.");
  const mainListSpecs = [];
  // Use trueStartAddress determined in Step 1 for layout
  const layoutStartAddress = trueStartAddress;

  if (layoutStartAddress && addressObjectMap[layoutStartAddress]) {
    let nodesToProcess = [];
    let tempAddr;

    // Gather nodes to the left (previous)
    let leftNodes = [];
    tempAddr = layoutStartAddress;
    let count = 0;
    const visitedForLayout = new Set(); // Separate visited set for this layout pass to handle rendering sequence

    // First, process the layoutStartAddress node itself
    const startNodeDataForLayout = addressObjectMap[layoutStartAddress];
    if (startNodeDataForLayout) {
      nodesToProcess.push({
        addr: layoutStartAddress,
        data: startNodeDataForLayout,
        position: "current",
      });
      visitedForLayout.add(layoutStartAddress);

      // Gather previous nodes
      tempAddr =
        startNodeDataForLayout.previousAddress || startNodeDataForLayout.prev;
      count = 0;
      while (
        tempAddr &&
        tempAddr !== "0x0" &&
        tempAddr !== "null" &&
        !visitedForLayout.has(tempAddr) &&
        count < MAX_NODES_TO_RENDER / 2
      ) {
        const nodeData = addressObjectMap[tempAddr];
        if (!nodeData) break;
        leftNodes.unshift({ addr: tempAddr, data: nodeData }); // Add to beginning to maintain order for left rendering
        visitedForLayout.add(tempAddr);
        tempAddr = nodeData.previousAddress || nodeData.prev;
        count++;
      }
      nodesToProcess = [...leftNodes, ...nodesToProcess];

      // Gather next nodes
      tempAddr =
        startNodeDataForLayout.nextAddress || startNodeDataForLayout.next;
      count = 0;
      while (
        tempAddr &&
        tempAddr !== "0x0" &&
        tempAddr !== "null" &&
        !visitedForLayout.has(tempAddr) &&
        count < MAX_NODES_TO_RENDER / 2
      ) {
        const nodeData = addressObjectMap[tempAddr];
        if (!nodeData) break;
        nodesToProcess.push({ addr: tempAddr, data: nodeData });
        visitedForLayout.add(tempAddr);
        tempAddr = nodeData.nextAddress || nodeData.next;
        count++;
      }
    }

    // Now layout nodesToProcess which are ordered: prevs, current, nexts
    let currentLayoutX = mainChainStartX; // Start from the left of the main chain area defined by grid

    nodesToProcess.forEach((nodeInfo) => {
      const { addr: currentLayoutAddr, data: nodeData, position } = nodeInfo;
      const nodeFields = {
        value: nodeData.value || nodeData.data || "N/A",
        prev: nodeData.previousAddress || nodeData.prev || "null",
        next: nodeData.nextAddress || nodeData.next || "null",
      };
      let nodeSpecificStyle = { ...styles.node };

      mainListSpecs.push({
        x: currentLayoutX,
        y: mainChainY,
        address: currentLayoutAddr,
        title: currentLayoutAddr, // Always address as per user request
        fields: nodeFields,
        isIsolated: false,
        style: nodeSpecificStyle,
      });
      nodePositions[currentLayoutAddr] = {
        x: currentLayoutX,
        y: mainChainY,
        width: styles.node.width,
        height: styles.node.height,
        fields: nodeFields,
      };

      const nextNodeAddr = nodeFields.next;
      if (
        nextNodeAddr &&
        nextNodeAddr !== "0x0" &&
        nextNodeAddr !== "null" &&
        addressObjectMap[nextNodeAddr]
      ) {
        allConnections.push({
          sourceName: currentLayoutAddr,
          targetAddress: nextNodeAddr,
          type: "ll_next",
        });
      }
      const prevNodeAddr = nodeFields.prev;
      if (
        prevNodeAddr &&
        prevNodeAddr !== "0x0" &&
        prevNodeAddr !== "null" &&
        addressObjectMap[prevNodeAddr]
      ) {
        allConnections.push({
          sourceName: currentLayoutAddr,
          targetAddress: prevNodeAddr,
          type: "ll_prev",
        });
      }
      currentLayoutX += styles.node.width + styles.layout.nodeSpacingX;
    });
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
        `[DLS Step 4] Error rendering MAIN LIST node ${spec.address}:`,
        e
      );
    }
  });
  console.log(
    "[DLS Step 4] Main Chain Layout and Rendering - DONE. Specs:",
    mainListSpecs.length
  );

  // --- STEP 5: ORPHAN CHAIN LAYOUT (Populate orphanSpecs) ---
  console.log(
    "[DLS Step 5] Starting Orphan Chain Layout - Single Line Horizontal."
  );
  const orphanSpecs = [];
  // orphanCellLeft and orphanGridY are defined in Step 3
  // calculatedOrphanCellWidth (cellWidthsArray[0]) is also from Step 3 and defines the total available width for orphans
  let currentOrphanX = orphanCellLeft + orphanCellPadding; // Start X for orphan layout
  const currentOrphanY = orphanGridY; // Orphans will be on a single Y-level

  orderedOrphanAddrs.forEach((addr) => {
    const nodeData = addressObjectMap[addr];
    if (!nodeData || typeof nodeData !== "object" || Array.isArray(nodeData)) {
      console.warn(
        `[DLS Step 5] Invalid node data for orphan address: ${addr}`
      );
      return; // Skip this orphan if data is invalid
    }

    const orphanNodeFields = {
      value: nodeData.value || nodeData.data || "N/A",
      prev: nodeData.previousAddress || nodeData.prev || "null",
      next: nodeData.nextAddress || nodeData.next || "null",
    };

    const orphanNodeStyle = {
      ...styles.node,
      fill: styles.node.isolatedFill,
      stroke: styles.node.isolatedStroke,
      strokeDasharray: "4,4",
    };

    orphanSpecs.push({
      x: currentOrphanX,
      y: currentOrphanY, // All orphans on the same Y level
      address: addr,
      title: addr, // Always address as per user request
      fields: orphanNodeFields,
      isIsolated: true,
      style: orphanNodeStyle,
    });
    nodePositions[addr] = {
      x: currentOrphanX,
      y: currentOrphanY,
      width: styles.node.width,
      height: styles.node.height, // Use styles.node.height
      fields: orphanNodeFields,
    };

    // Add connections for this orphan node's 'next' and 'prev'
    const orphanNextAddr = orphanNodeFields.next;
    if (
      orphanNextAddr &&
      orphanNextAddr !== "0x0" &&
      orphanNextAddr !== "null" &&
      addressObjectMap[orphanNextAddr]
    ) {
      allConnections.push({
        sourceName: addr,
        targetAddress: orphanNextAddr,
        type: "ll_next",
      });
    }
    const orphanPrevAddr = orphanNodeFields.prev;
    if (
      orphanPrevAddr &&
      orphanPrevAddr !== "0x0" &&
      orphanPrevAddr !== "null" &&
      addressObjectMap[orphanPrevAddr]
    ) {
      allConnections.push({
        sourceName: addr,
        targetAddress: orphanPrevAddr,
        type: "ll_prev",
      });
    }

    currentOrphanX += styles.node.width + styles.layout.orphanNodeSpacingX;
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
        `[DLS Step 5] Error rendering ORPHAN node ${spec.address}:`,
        e
      );
    }
  });
  console.log(
    "[DLS Step 5] Orphan Chain Layout and Rendering - DONE. Specs:",
    orphanSpecs.length
  );

  // --- EXISTING RENDER Local Variables (Bottom, Center) ---
  // This will use localVarsX, localVarsY from Step 3
  if (Object.keys(localVariables).length > 0) {
    const localVarsResult = renderVariableBox(
      contentGroup,
      "Local Variables",
      localVariables,
      localVarsX, // Use new grid X
      localVarsY, // Use new grid Y
      styles.varBox,
      "local",
      isAddress
    );
    allConnections.push(...localVarsResult.connectionPoints);
    nodePositions["local_vars_box"] = {
      x: localVarsX,
      y: localVarsY,
      width: styles.varBox.width,
      height: localVarsResult.height,
    };
  }
  console.log("[DLS] Local Variables Rendered (if any).");

  // --- EXISTING Render Connections (Arrow Drawing Logic) ---
  // This logic should largely remain, as it processes 'allConnections'
  // which will be populated by the new Step 4 and Step 5.
  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");
  allConnections.forEach((conn) => {
    // ... (Paste existing comprehensive arrow drawing logic here) ...
    // It should correctly use conn.type ('ll_next', 'll_prev') and
    // styles.connection properties (colors, markerIds)
    // Ensure sourcePoint and targetPoint calculations are robust.
    // --- START OF COPIED ARROW LOGIC ---
    let sourcePoint, targetPoint;
    let path = "";
    let markerId = styles.connection.llNextMarkerId;
    let color = styles.connection.defaultColor;
    let strokeWidth = styles.connection.strokeWidth;
    const cornerRadius = styles.connection.cornerRadius || 5;
    let pathOrientationHint = "auto";
    const sNodeStyle = styles.node;

    const Y_THRESHOLD =
      (sNodeStyle && typeof sNodeStyle.height === "number"
        ? sNodeStyle.height
        : 100) * 0.6;
    const HORIZONTAL_OVERSHOOT = 20;
    const INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP = 20;

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
        console.warn(`[DLS Arrow] Missing source VarBox data:`, conn);
        return;
      }
    } else if (conn.sourceName && nodePositions[conn.sourceName]) {
      sourceBoundingBoxPosData = nodePositions[conn.sourceName];
      let fieldYOffset;
      let fieldNameToUse = "value";
      if (conn.type === "ll_next") fieldNameToUse = "next";
      else if (conn.type === "ll_prev") fieldNameToUse = "prev";

      const actualFields = sourceBoundingBoxPosData.fields || {
        value: "N/A",
        prev: "null",
        next: "null",
      };
      const fieldNames = Object.keys(actualFields);
      let fieldIndexToUse = fieldNames.indexOf(fieldNameToUse);
      if (fieldIndexToUse === -1) {
        if (fieldNames.includes("value"))
          fieldIndexToUse = fieldNames.indexOf("value");
        else if (fieldNames.length > 0) fieldIndexToUse = fieldNames.length - 1;
        else fieldIndexToUse = 0;
      }

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
        fieldYOffset =
          (sourceBoundingBoxPosData.height || sNodeStyle.height) / 2;
      }
      specificFieldInitialCoords = {
        x:
          sourceBoundingBoxPosData.x +
          (sourceBoundingBoxPosData.width || sNodeStyle.width) / 2,
        y: sourceBoundingBoxPosData.y + fieldYOffset,
      };
    } else {
      console.warn(
        "[DLS Arrow] Connection sourceName not found or invalid:",
        conn.sourceName,
        conn
      );
      return;
    }

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
            .attr(
              "stroke",
              conn.type === "ll_prev"
                ? styles.connection.prevColor
                : styles.connection.nextColor
            )
            .attr("stroke-width", strokeWidth)
            .attr("stroke-dasharray", "3,3");
        }
        return;
      }
      console.warn(
        `[DLS Arrow] Target Node not found for address:`,
        conn.targetAddress,
        conn
      );
      return;
    }

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
      !conn.sourceName.includes("vars_box") &&
      sourceBoundingBoxPosData &&
      typeof sourceBoundingBoxPosData.height === "number"
    ) {
      decisionSourceY =
        sourceBoundingBoxPosData.y + sourceBoundingBoxPosData.height / 2;
    }
    const deltaXOverallMid = Math.abs(targetOverallMidX - sourceOverallMidX);
    const deltaYDecisionMid = Math.abs(targetOverallMidY - decisionSourceY);

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

    if (
      conn.sourceName &&
      (conn.sourceName.startsWith("instance-") ||
        conn.sourceName.startsWith("local-"))
    ) {
      markerId = styles.connection.llInstanceVarMarkerId;
      color = styles.connection.instanceVarColor;
    } else if (conn.type === "ll_next") {
      markerId = styles.connection.llNextMarkerId;
      color = styles.connection.nextColor;
    } else if (conn.type === "ll_prev") {
      markerId = styles.connection.llPrevMarkerId;
      color = styles.connection.prevColor;
    }
    color = color || styles.connection.defaultColor;

    let initialOffset = 15;
    if (pathOrientationHint === "H-V-H") {
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
        "[DLS Arrow] Path empty/points missing for connection:",
        conn,
        "Source:",
        sourcePoint,
        "Target:",
        targetPoint
      );
    }
    // --- END OF COPIED ARROW LOGIC ---
  });
  console.log("[DLS] Connection Drawing Attempted.");

  console.log(
    "Finished renderDoublyLinkedStructureVisualization (Iterative Step 1-3). Node Positions:",
    nodePositions,
    "Connections:",
    allConnections
  );
};

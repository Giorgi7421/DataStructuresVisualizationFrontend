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
    "TOP OF renderLinkedListVectorVisualization. Op:",
    operation,
    "Snap:",
    memorySnapshot
  );

  const state = memorySnapshot || operation.state || {};
  const localVariables = state.localVariables || {};
  const instanceVariables = state.instanceVariables || {};
  const addressObjectMap = state.addressObjectMap || {};

  const visited = new Set();

  const styles = {
    varBox: {
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
      width: 180,
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
      addressTextFill: "#0284c7",
      fieldRectFill: "none",
      fieldRectStroke: "#e2e8f0",
      fontSize: "12px",
      titleFontSize: "13px",
      height: 100,
    },
    connection: {
      strokeWidth: 1.5,
      instanceVarColor: "#334155",
      nextColor: "#2563eb",

      llInstanceVarMarkerId: "ll-instance-var-arrow",
      llNextMarkerId: "ll-next-arrow",
      cornerRadius: 8,
      defaultColor: "#64748b",
    },
    layout: {
      nodeSpacingX: 60,
      varBoxSpacingY: 20,
      nodesStartXOffset: 60,
      layerSpacingY: 120,
      orphanNodeSpacingX: 40,
    },
  };

  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles);

  const nodePositions = {};
  const allConnections = [];

  let startAddress;
  let currentAddress;
  let nodesProcessedCount;
  const MAX_NODES_TO_RENDER = 50;
  let mainChainLeftmostX;
  let currentX;

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
      startAddress = allNodeAddrs[0];
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
      break;
    }
    tempCurrentAddress = nodeData.nextAddress || nodeData.next;
    nodesVisitedCount++;
  }

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

  const gridRows = 4;
  const gridCols = 3;
  const cellWidth = width / gridCols;
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

  const actualGridCols = 3;
  const remainingWidth = Math.max(width - calculatedOrphanCellWidth, 1);

  const otherCellWidth =
    actualGridCols > 1 ? remainingWidth / (actualGridCols - 1) : remainingWidth;

  const cellWidths = [
    calculatedOrphanCellWidth,
    otherCellWidth,
    otherCellWidth,
  ];

  if (actualGridCols === 2) cellWidths.splice(2, 1);
  if (actualGridCols === 1) cellWidths.splice(1, 2);

  const colX = [0];
  for (let i = 0; i < cellWidths.length; i++) {
    colX.push(colX[i] + cellWidths[i]);
  }

  const instanceVarsX =
    (colX[1] || 0) + (cellWidths[1] || width) / 2 - styles.varBox.width / 2;
  const instanceVarsY =
    cellHeight * 0 + cellHeight / 2 - styles.varBox.headerHeight;

  const mainChainY = cellHeight * 1 + cellHeight / 2 - styles.node.height / 2;
  const mainChainStartX = (colX[2] || colX[1] || 0) + 20;

  const orphanCellLeft = colX[0];
  const orphanCellTop = cellHeight * 2;
  const orphanCellHeight = cellHeight;

  const localVarsX =
    (colX[1] || 0) + (cellWidths[1] || width) / 2 - styles.varBox.width / 2;
  const localVarsY =
    cellHeight * 3 + cellHeight / 2 - styles.varBox.headerHeight;

  const mainListSpecs = [];
  currentAddress = startAddress;
  nodesProcessedCount = 0;
  mainChainLeftmostX = mainChainStartX;
  currentX = mainChainStartX;

  while (
    currentAddress &&
    currentAddress !== "0x0" &&
    currentAddress !== "null" &&
    nodesProcessedCount < MAX_NODES_TO_RENDER
  ) {
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
      isIsolated: false,
      style: styles.node,
    });

    const nextNodeAddr = nodeData.nextAddress || nodeData.next;
    if (nextNodeAddr && nextNodeAddr !== "0x0" && nextNodeAddr !== "null") {
      if (addressObjectMap[nextNodeAddr]) {
        allConnections.push({
          sourceName: currentAddress,
          targetAddress: nextNodeAddr,
          type: "ll_next",
        });
      }
    }

    currentX += styles.node.width + styles.layout.nodeSpacingX;
    mainChainLeftmostX = Math.min(
      mainChainLeftmostX,
      currentX - (styles.node.width + styles.layout.nodeSpacingX)
    );
    currentAddress = nextNodeAddr;
    nodesProcessedCount++;
  }

  if (nodesProcessedCount === MAX_NODES_TO_RENDER) {
    console.warn("LinkedListVectorViz: Reached max node render limit.");
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
        "[LinkedListVectorViz] Error rendering MAIN LIST node:",
        spec.address,
        e
      );
    }
  });

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

  orphanSpecs.forEach((spec) => {
    const nodeData = addressObjectMap[spec.address];
    const nextAddr = nodeData.nextAddress || nodeData.next;

    if (
      nextAddr &&
      nextAddr !== "0x0" &&
      nextAddr !== "null" &&
      addressObjectMap[nextAddr]
    ) {
      allConnections.push({
        sourceName: spec.address,
        targetAddress: nextAddr,
        type: "ll_next",
      });
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
      (sNode && typeof sNode.height === "number" ? sNode.height : 100) * 0.6;

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

    const sourceOverallMidX =
      sourceBoundingBoxPosData.x + sourceBoundingBoxPosData.width / 2;
    const sourceFieldActualY = specificFieldInitialCoords.y;

    const targetOverallMidX = targetPosData.x + targetPosData.width / 2;
    const targetOverallMidY = targetPosData.y + targetPosData.height / 2;

    let decisionSourceY = sourceFieldActualY;
    if (conn.type === "ll_next" || conn.type === "ll_next_orphan") {
      if (
        sourceBoundingBoxPosData &&
        typeof sourceBoundingBoxPosData.height === "number"
      ) {
        decisionSourceY =
          sourceBoundingBoxPosData.y + sourceBoundingBoxPosData.height / 2;
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

    const chosenEgressSide =
      targetOverallMidX < sourceOverallMidX ? "left" : "right";
    sourcePoint = { y: sourceFieldActualY };
    if (chosenEgressSide === "left") {
      sourcePoint.x = sourceBoundingBoxPosData.x;
    } else {
      sourcePoint.x =
        sourceBoundingBoxPosData.x + sourceBoundingBoxPosData.width;
    }

    if (deltaYDecisionMid <= Y_THRESHOLD) {
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
        let approachingEdgeX;
        let overshotX;
        if (chosenEgressSide === "right") {
          approachingEdgeX = targetPosData.x;
          overshotX = approachingEdgeX + HORIZONTAL_OVERSHOOT;
        } else {
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
        let turnX;
        if (chosenEgressSide === "right") {
          turnX = sourcePoint.x + INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP;
        } else {
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

    if (conn.type === "ll_next" || conn.type === "ll_next_orphan") {
      markerId = styles.connection.llNextMarkerId || "ll-next-arrow";
      color = styles.connection.nextColor || "#2563eb";
    } else {
      markerId =
        styles.connection.llInstanceVarMarkerId || "ll-instance-var-arrow";
      color = styles.connection.instanceVarColor || "#334155";
    }

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
        "[LLV Viz] Path was empty or points missing, not drawn. Conn:",
        conn
      );
    }
  });

  console.log("Finished LinkedListVectorVisualization render.");
};

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

  nodeStartX =
    firstColX + styles.varBox.width + styles.layout.nodesStartXOffset;
  let currentX = nodeStartX;

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
  currentX = nodeStartX;

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

  const middleLayerBottomY = middleLayerY + middleLayerMaxNodeHeight;
  const bottomLayerStartY = middleLayerBottomY + layerSpacingY;

  let bottomLayerOrphanStartX = firstColX;
  if (Object.keys(localVariables).length > 0) {
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
    bottomLayerOrphanStartX =
      localVarsX + localVarsBoxWidth + (styles.layout.nodeSpacingX || 60);
  }

  let orphanNodeX = bottomLayerOrphanStartX;
  let orphanNodeY = bottomLayerStartY;
  let bottomLayerMaxNodeHeight = Math.max(
    styles.node.height,
    localVarsBoxHeight
  );

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
      }

      orphanSpecs.push({
        x: orphanNodeX,
        y: orphanNodeY,
        address: addr,
        title: nodeData.title || nodeData.url || truncateAddress(addr, 6),
        fields: orphanNodeFields,
        isIsolated: true,
        style: styles.node,
      });
      visited.add(addr);

      if (
        nodeData.nextAddress &&
        nodeData.nextAddress !== "0x0" &&
        nodeData.nextAddress !== "null"
      ) {
        allConnections.push({
          sourceName: addr,
          targetAddress: nodeData.nextAddress,
          type: "ll_next_orphan",
        });
      }

      orphanNodeX += (styles.node.width || 180) + styles.layout.nodeSpacingX;
      if (orphanNodeX + (styles.node.width || 180) > width - firstColX) {
        orphanNodeX = firstColX;
        orphanNodeY += bottomLayerMaxNodeHeight + styles.layout.nodeSpacingX;
      }
      bottomLayerMaxNodeHeight = Math.max(
        bottomLayerMaxNodeHeight,
        styles.node.height
      );
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
        "[LinkedListVectorViz] Error rendering ORPHAN node:", // Renamed Log
        spec.address,
        e
      );
    }
  });

  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");
  allConnections.forEach((conn) => {
    let sourcePoint, targetPoint;
    let path = "";
    let markerId = null;
    let color = styles.connection.stroke;
    let pathOrientationHint = "auto";
    const cornerRadius = styles.connection.cornerRadius;
    let strokeWidth = styles.connection.strokeWidth;

    const sourcePosData = nodePositions[conn.sourceName];
    if (conn.sourceCoords) {
      sourcePoint = conn.sourceCoords;
    } else if (sourcePosData && conn.type === "ll_next") {
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
      sourcePoint = {
        x: sourcePosData.x,
        y: sourcePosData.y + sourcePosData.height / 2,
      };
    } else {
      console.warn(
        "LLV Viz Connection: Cannot find source position for:",
        conn
      ); // Renamed Log
      return;
    }

    const targetPosData = nodePositions[conn.targetAddress];
    if (!targetPosData) {
      console.warn(
        "LLV Viz Connection: Cannot find target position for:", // Renamed Log
        conn.targetAddress,
        conn
      );
      return;
    }

    if (conn.type === "instance" || conn.type === "local") {
      markerId =
        styles.connection.llInstanceVarMarkerId || "ll-instance-var-arrow";
      color = styles.connection.instanceVarColor;
      pathOrientationHint = "H-V-H";

      sourcePoint = conn.sourceCoords;
      targetPoint = {
        x: targetPosData.x,
        y: targetPosData.y + targetPosData.height / 2,
      };

      if (
        conn.varName === "end" &&
        mainListSpecs.length > 0 &&
        targetPosData.address ===
          mainListSpecs[mainListSpecs.length - 1].address
      ) {
        if (conn.leftSourceCoords) {
          const verticalDropForEnd = 75;
          const horizontalClearanceForEnd = 20;
          path = generateHardcodedEndPointerPath(
            conn.leftSourceCoords,
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
            "[LinkedListVectorViz] 'end' pointer missing leftSourceCoords! Cannot draw path.", // Renamed Log
            conn
          );
          path = "";
        }
      } else {
        if (conn.type === "instance") {
          pathOrientationHint = "H-V_to_target_top";
          const instanceBoxPos = nodePositions["instance_vars_box"];
          if (instanceBoxPos && conn.leftSourceCoords) {
            const targetNodeCenterX = targetPosData.x + targetPosData.width / 2;
            const instanceBoxCenter =
              instanceBoxPos.x + instanceBoxPos.width / 2;
            if (targetNodeCenterX < instanceBoxCenter) {
              sourcePoint = conn.leftSourceCoords;
            }
          }
          targetPoint = {
            x: targetPosData.x + targetPosData.width / 2,
            y: targetPosData.y,
          };
          const tempInitialOffsetInst = 10;
          path = generateOrthogonalPath(
            sourcePoint,
            targetPoint,
            cornerRadius,
            pathOrientationHint,
            tempInitialOffsetInst,
            null
          );
        } else if (conn.type === "local") {
          const localInitialOffset = 30;
          path = generateOrthogonalPath(
            sourcePoint,
            targetPoint,
            cornerRadius,
            pathOrientationHint,
            localInitialOffset,
            null
          );
        } else {
          path = "";
          console.warn(
            "[LinkedListVectorViz] Unhandled var type for path generation:", // Renamed Log
            conn.type
          );
        }
      }
    } else if (conn.type === "ll_next" || conn.type === "ll_next_orphan") {
      markerId = styles.connection.llNextMarkerId || "ll-next-arrow";
      color = styles.connection.nextColor;
      pathOrientationHint = "H-V-H";

      targetPoint = {
        x: targetPosData.x,
        y: targetPosData.y + targetPosData.height / 2,
      };
      path = generateOrthogonalPath(
        sourcePoint,
        targetPoint,
        cornerRadius,
        pathOrientationHint,
        undefined,
        null
      );
    } else {
      console.warn(
        "[LinkedListVectorViz] Unhandled connection type for path drawing:", // Renamed Log
        conn.type
      );
      path = "";
    }

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

      if (conn.varName === "end" && path) {
        console.log("[LinkedListVectorViz] 'end' pointer RENDERED path:", path); // Renamed Log
      }
    } else if (!path && conn.varName === "end" && !conn.leftSourceCoords) {
      console.error(
        "[LinkedListVectorViz] 'end' pointer path NOT drawn due to missing leftSourceCoords." // Renamed Log
      );
    } else if (!path && sourcePoint && targetPoint) {
      console.warn(
        "[LinkedListVectorViz] Path was empty for a connection, not drawn. Conn:", // Renamed Log
        conn
      );
    }
  });

  console.log("Finished LinkedListVectorVisualization render."); // Renamed Log
};

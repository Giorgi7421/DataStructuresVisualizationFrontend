import {
  defineArrowheads,
  renderVariableBox,
  renderGenericNode,
  isAddress,
  truncateAddress,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

export function renderTreeVisualization(
  contentGroup,
  width,
  height,
  operation,
  memorySnapshot,
  snapshotIdentifier
) {
  console.log("[BSTree] Starting visualization with:", {
    operation,
    memorySnapshot,
  });

  const arrowheadSize = 8;
  contentGroup
    .append("defs")
    .append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 8)
    .attr("refY", 0)
    .attr("orient", "auto")
    .attr("markerWidth", arrowheadSize)
    .attr("markerHeight", arrowheadSize)
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#334155");

  const state = memorySnapshot || operation.state || {};
  const instanceVariables = state.instanceVariables || {};
  const localVariables = state.localVariables || {};
  const addressObjectMap = state.addressObjectMap || {};

  console.log("[BSTree] Parsed state:", {
    state,
    instanceVariables,
    localVariables,
    addressObjectMap,
  });

  console.log("[BSTree] Variable types:", {
    instanceVariablesType: typeof instanceVariables,
    instanceVariablesKeys: Object.keys(instanceVariables),
    localVariablesType: typeof localVariables,
    localVariablesKeys: Object.keys(localVariables),
  });

  const nodePositions = {};
  const allConnections = [];

  const rootAddress =
    instanceVariables && instanceVariables.root ? instanceVariables.root : null;
  console.log("[BSTree] Root address:", rootAddress);
  console.log("[BSTree] Address object map:", addressObjectMap);

  const treeData = parseTreeStructure(rootAddress, addressObjectMap);
  console.log("[BSTree] Parsed tree data:", treeData);

  const orphanNodes = findOrphanNodes(rootAddress, addressObjectMap);
  console.log(
    "[BSTree] Found orphan nodes:",
    orphanNodes.map((n) => n.address)
  );

  const treeDepth = treeData ? getTreeDepth(treeData) : 1;
  const maxNodes = Math.pow(2, treeDepth);
  const availableWidth = width - 100;

  const adaptiveNodeWidth = Math.max(
    Math.min(availableWidth / (maxNodes * 3.0), 180),
    120
  );

  const adaptiveHorizontalSpacing = adaptiveNodeWidth * 3.0;
  const adaptiveVerticalSpacing = Math.max(200, adaptiveNodeWidth * 2.5);

  console.log("[BSTree] Adaptive sizing:", {
    treeDepth,
    maxNodes,
    availableWidth,
    adaptiveNodeWidth,
    adaptiveHorizontalSpacing,
    adaptiveVerticalSpacing,
  });

  const styles = {
    varBox: {
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
      width: adaptiveNodeWidth,
      headerHeight: 25,
      fieldHeight: 25,
      fieldSpacing: 5,
      padding: 10,
      fill: "#ffffff",
      stroke: "#94a3b8",
      titleFill: "#f8fafc",
      titleStroke: "#94a3b8",
      titleTextFill: "#334155",
      keyTextFill: "#334155",
      valueTextFill: "#334155",
      addressTextFill: "#0ea5e9",
      fieldRectFill: "white",
      fieldRectStroke: "#e2e8f0",
      fontSize: "12px",
      titleFontSize: "13px",
    },
    connection: {
      strokeWidth: 2,
      color: "#334155",
      arrowSize: 8,
    },
  };

  defineArrowheads(contentGroup, styles.connection.arrowSize);

  function logTreeStructure(node, depth = 0) {
    if (!node) return;
    const indent = "  ".repeat(depth);
    console.log(
      `${indent}Node ${node.address}: value=${node.value}, left=${
        node.left || "null"
      }, right=${node.right || "null"}`
    );
    console.log(`${indent}Children array:`, node.children);
    if (node.children) {
      if (node.children[0]) {
        console.log(`${indent}Left child:`, node.children[0].address);
        logTreeStructure(node.children[0], depth + 1);
      }
      if (node.children[1]) {
        console.log(`${indent}Right child:`, node.children[1].address);
        logTreeStructure(node.children[1], depth + 1);
      }
    }
  }

  if (treeData) {
    console.log("[BSTree] Complete tree structure:");
    logTreeStructure(treeData);
  }

  let treeLayout = null;
  if (treeData) {
    console.log("[BSTree] Starting layout calculation...");
    treeLayout = calculateTreeLayout(
      treeData,
      styles.node.width,
      adaptiveHorizontalSpacing,
      adaptiveVerticalSpacing,
      styles
    );

    function logLayoutPositions(node, depth = 0) {
      if (!node) return;
      const indent = "  ".repeat(depth);
      console.log(
        `${indent}Layout - Node ${node.address}: x=${node.x}, y=${
          node.y
        }, level=${node.level || "undefined"}`
      );
      if (node.children) {
        if (node.children[0]) logLayoutPositions(node.children[0], depth + 1);
        if (node.children[1]) logLayoutPositions(node.children[1], depth + 1);
      }
    }

    if (treeLayout) {
      console.log("[BSTree] Final layout positions:");
      logLayoutPositions(treeLayout);
    }

    if (treeLayout && !validateTreeStructure(treeLayout)) {
      console.error("[BSTree] Tree validation failed, skipping rendering");
      treeLayout = null;
    }
  }

  const varBoxY = 20;
  const varBoxSpacing = 40;
  const instanceVarBoxX = 30;
  const localVarBoxX = instanceVarBoxX + styles.varBox.width + varBoxSpacing;

  console.log("[BSTree] Position calculations:", {
    varBoxY,
    instanceVarBoxX,
    localVarBoxX,
    varBoxSpacing,
  });

  let instanceVarBoxResult;
  console.log("[BSTree] About to render instance variables:", {
    variables: instanceVariables,
    hasVariables: Object.keys(instanceVariables).length > 0,
    x: instanceVarBoxX,
    y: varBoxY,
    title: "Instance Variables",
    xType: typeof instanceVarBoxX,
    yType: typeof varBoxY,
  });

  try {
    instanceVarBoxResult = renderVariableBox(
      contentGroup,
      "Instance Variables",
      instanceVariables,
      instanceVarBoxX,
      varBoxY,
      styles.varBox,
      "instance",
      isAddress
    );
    console.log(
      "[BSTree] Instance variables box rendered successfully:",
      instanceVarBoxResult
    );
  } catch (error) {
    console.error("[BSTree] Error rendering instance variables box:", error);
    instanceVarBoxResult = { height: 80, connectionPoints: [] };
  }

  let localVarBoxResult;
  console.log("[BSTree] About to render local variables:", {
    variables: localVariables,
    hasVariables: Object.keys(localVariables).length > 0,
    x: localVarBoxX,
    y: varBoxY,
    title: "Local Variables",
    xType: typeof localVarBoxX,
    yType: typeof varBoxY,
  });

  try {
    localVarBoxResult = renderVariableBox(
      contentGroup,
      "Local Variables",
      localVariables,
      localVarBoxX,
      varBoxY,
      styles.varBox,
      "local",
      isAddress
    );
    console.log(
      "[BSTree] Local variables box rendered successfully:",
      localVarBoxResult
    );
  } catch (error) {
    console.error("[BSTree] Error rendering local variables box:", error);
    localVarBoxResult = { height: 80, connectionPoints: [] };
  }

  if (instanceVarBoxResult?.connectionPoints) {
    console.log(
      "[BSTree] Adding instance variable connection points:",
      instanceVarBoxResult.connectionPoints
    );
    instanceVarBoxResult.connectionPoints.forEach((cp) => {
      if (
        cp &&
        cp.sourceCoords &&
        typeof cp.sourceCoords.x === "number" &&
        typeof cp.sourceCoords.y === "number"
      ) {
        console.log("[BSTree] Valid connection point:", cp);
      } else {
        console.warn(
          "[BSTree] Invalid connection point from instance variables:",
          cp
        );
      }
    });
    allConnections.push(
      ...instanceVarBoxResult.connectionPoints.filter(
        (cp) =>
          cp &&
          cp.sourceCoords &&
          typeof cp.sourceCoords.x === "number" &&
          typeof cp.sourceCoords.y === "number"
      )
    );
  }
  if (localVarBoxResult?.connectionPoints) {
    console.log(
      "[BSTree] Adding local variable connection points:",
      localVarBoxResult.connectionPoints
    );
    localVarBoxResult.connectionPoints.forEach((cp) => {
      if (
        cp &&
        cp.sourceCoords &&
        typeof cp.sourceCoords.x === "number" &&
        typeof cp.sourceCoords.y === "number"
      ) {
        console.log("[BSTree] Valid local connection point:", cp);
      } else {
        console.warn(
          "[BSTree] Invalid connection point from local variables:",
          cp
        );
      }
    });
    allConnections.push(
      ...localVarBoxResult.connectionPoints.filter(
        (cp) =>
          cp &&
          cp.sourceCoords &&
          typeof cp.sourceCoords.x === "number" &&
          typeof cp.sourceCoords.y === "number"
      )
    );
  }

  const treeAreaY =
    varBoxY +
    Math.max(
      instanceVarBoxResult?.height || 80,
      localVarBoxResult?.height || 80
    ) +
    80;
  const treeAreaX = 50;
  const treeAreaWidth = width - treeAreaX - 50;
  const treeAreaHeight = height - treeAreaY - 30;

  const centerBetweenBoxes =
    (instanceVarBoxX + localVarBoxX + styles.varBox.width) / 2;

  if (treeLayout) {
    console.log("[BSTree] Tree layout exists, proceeding with rendering");

    try {
      const treeBounds = getTreeBounds(treeLayout);
      console.log("[BSTree] Tree bounds:", treeBounds);

      if (!treeBounds || typeof treeBounds.minX === "undefined") {
        console.error("[BSTree] Invalid tree bounds:", treeBounds);
        throw new Error("Invalid tree bounds");
      }

      const treeWidth =
        treeBounds.maxX - treeBounds.minX + 2 * styles.node.width;
      const treeHeight =
        treeBounds.maxY -
        treeBounds.minY +
        2 * (styles.node.headerHeight + styles.node.fieldHeight * 3);

      console.log(`[BSTree] Tree dimensions: ${treeWidth} x ${treeHeight}`);
      console.log(
        `[BSTree] Available area: ${treeAreaWidth} x ${treeAreaHeight}`
      );
      console.log(`[BSTree] Using adaptive node width: ${styles.node.width}`);

      const scale = 1;
      const offsetX = centerBetweenBoxes;
      const offsetY = treeAreaY;

      renderTreeNodes(
        contentGroup,
        treeLayout,
        offsetX,
        offsetY,
        scale,
        styles,
        nodePositions
      );
      renderTreeConnections(
        contentGroup,
        treeLayout,
        offsetX,
        offsetY,
        scale,
        styles,
        nodePositions
      );

      console.log("[BSTree] Tree rendering completed successfully");
    } catch (error) {
      console.error("[BSTree] Error during tree rendering:", error);

      contentGroup
        .append("text")
        .attr("x", treeAreaX + treeAreaWidth / 2)
        .attr("y", treeAreaY + treeAreaHeight / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#ef4444")
        .text("Error rendering tree");

      contentGroup
        .append("text")
        .attr("x", treeAreaX + treeAreaWidth / 2)
        .attr("y", treeAreaY + treeAreaHeight / 2 + 25)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "#ef4444")
        .text("Check console for details");
    }
  } else {
    console.log("[BSTree] No tree layout, displaying empty visualization");
  }

  const orphanStartY = varBoxY - 150;
  const orphanStartX =
    centerBetweenBoxes - (orphanNodes.length * (styles.node.width + 50)) / 2;

  const orphanNodesArea = renderOrphanNodes(
    contentGroup,
    orphanNodes,
    orphanStartX,
    orphanStartY,
    styles,
    nodePositions
  );

  const allConnectionPoints = [...(localVarBoxResult?.connectionPoints || [])];

  const centerX = centerBetweenBoxes;
  renderVariablePointerArrows(
    contentGroup,
    allConnectionPoints,
    nodePositions,
    styles,
    centerX
  );

  if (rootAddress && treeLayout) {
    console.log("[BSTree] Attempting to draw root connection...");
    const rootNode = findNodeByAddress(treeLayout, rootAddress);
    console.log("[BSTree] Root node found:", rootNode);
    console.log(
      "[BSTree] Instance var connection points:",
      instanceVarBoxResult?.connectionPoints
    );

    const rootConnectionPoint = instanceVarBoxResult?.connectionPoints?.find(
      (cp) => cp.targetAddress === rootAddress || cp.varName === "root"
    );

    if (rootNode && rootConnectionPoint && rootConnectionPoint.sourceCoords) {
      console.log("[BSTree] Drawing root connection...");

      const scale = 1;
      const offsetX = centerBetweenBoxes;
      const offsetY = treeAreaY;

      const sourceX = rootConnectionPoint.sourceCoords.x;
      const sourceY = rootConnectionPoint.sourceCoords.y;
      const targetX = offsetX + rootNode.x * scale;

      const rootNodeCenterY = offsetY + rootNode.y * scale;

      const nodeHeight =
        styles.node.headerHeight +
        styles.node.fieldHeight * 3 +
        styles.node.fieldSpacing * 2 +
        styles.node.padding * 2;

      const targetY = rootNodeCenterY - nodeHeight / 2;

      if (
        typeof sourceX === "number" &&
        typeof sourceY === "number" &&
        typeof targetX === "number" &&
        typeof targetY === "number" &&
        !isNaN(sourceX) &&
        !isNaN(sourceY) &&
        !isNaN(targetX) &&
        !isNaN(targetY)
      ) {
        console.log("[BSTree] Creating root connection with coordinates:", {
          sourceX,
          sourceY,
          targetX,
          targetY,
        });

        const pathData = `M ${sourceX} ${sourceY} L ${targetX} ${sourceY} L ${targetX} ${targetY}`;

        contentGroup
          .append("path")
          .attr("d", pathData)
          .attr("fill", "none")
          .attr("stroke", styles.connection.color)
          .attr("stroke-width", styles.connection.strokeWidth)
          .attr("marker-end", "url(#arrowhead)");
      } else {
        console.warn("[BSTree] Invalid coordinates for root connection:", {
          sourceX,
          sourceY,
          targetX,
          targetY,
        });
      }
    } else {
      console.log("[BSTree] Root connection not possible:", {
        hasRootNode: !!rootNode,
        hasConnectionPoint: !!rootConnectionPoint,
        hasSourceCoords: !!(
          rootConnectionPoint && rootConnectionPoint.sourceCoords
        ),
      });
    }
  }

  console.log("[BSTree] About to draw connections:", allConnections.length);
  allConnections.forEach((conn, index) => {
    console.log(`[BSTree] Connection ${index}:`, conn);
    if (
      conn &&
      conn.source &&
      conn.target &&
      typeof conn.source.x === "number" &&
      typeof conn.source.y === "number" &&
      typeof conn.target.x === "number" &&
      typeof conn.target.y === "number"
    ) {
      drawConnection(contentGroup, conn, styles.connection);
    } else {
      console.warn(`[BSTree] Skipping invalid connection ${index}:`, conn);
    }
  });

  return { nodePositions, connections: allConnections, orphanNodesArea };
}

function parseTreeStructure(rootAddress, addressObjectMap) {
  if (!rootAddress || !addressObjectMap[rootAddress]) {
    return null;
  }

  function buildNode(address) {
    if (!address || !addressObjectMap[address]) {
      return null;
    }

    const nodeData = addressObjectMap[address];
    const node = {
      address: address,
      ...nodeData,
      children: [],
    };

    const leftChild = nodeData.left ? buildNode(nodeData.left) : null;
    const rightChild = nodeData.right ? buildNode(nodeData.right) : null;

    if (leftChild) {
      leftChild.parent = node;
      leftChild.side = "left";
      node.children[0] = leftChild;
    }

    if (rightChild) {
      rightChild.parent = node;
      rightChild.side = "right";
      node.children[1] = rightChild;
    }

    console.log(
      `[BSTree] Built node ${address} with value ${nodeData.value}, left: ${
        nodeData.left || "null"
      }, right: ${nodeData.right || "null"}`
    );
    return node;
  }

  return buildNode(rootAddress);
}

function getTreeDepth(rootNode) {
  if (!rootNode) return 0;

  function calculateDepth(node) {
    if (!node) return 0;

    let maxChildDepth = 0;
    if (node.children) {
      for (const child of node.children) {
        if (child) {
          maxChildDepth = Math.max(maxChildDepth, calculateDepth(child));
        }
      }
    }

    return 1 + maxChildDepth;
  }

  return calculateDepth(rootNode);
}

function calculateTreeLayout(
  rootNode,
  nodeWidth,
  adaptiveHorizontalSpacing,
  adaptiveVerticalSpacing,
  styles
) {
  if (!rootNode) {
    console.error(
      "[BSTree] calculateTreeLayout called with undefined rootNode"
    );
    return null;
  }

  console.log(
    "[BSTree] Starting tree layout calculation for root:",
    rootNode.address,
    "with adaptive spacing:",
    { adaptiveHorizontalSpacing, adaptiveVerticalSpacing }
  );

  const levelHeight = adaptiveVerticalSpacing;
  const minHorizontalSpacing = adaptiveHorizontalSpacing;

  const treeDepth = getTreeDepth(rootNode);
  const baseSpacingAtBottom = 50;

  console.log(
    `[BSTree] Tree depth: ${treeDepth}, base spacing at bottom: ${baseSpacingAtBottom}`
  );

  function assignLevelsAndWidths(node, level = 0) {
    if (!node) return 0;

    node.level = level;

    const leftWidth = node.children[0]
      ? assignLevelsAndWidths(node.children[0], level + 1)
      : 0;
    const rightWidth = node.children[1]
      ? assignLevelsAndWidths(node.children[1], level + 1)
      : 0;

    node.subtreeWidth = Math.max(
      minHorizontalSpacing,
      leftWidth + rightWidth + minHorizontalSpacing
    );

    console.log(
      `[BSTree] Node ${node.address} at level ${level}: subtreeWidth = ${node.subtreeWidth}`
    );
    return node.subtreeWidth;
  }

  function assignPositions(node, centerX = 0) {
    if (!node) return;

    if (isNaN(centerX)) {
      console.error("[BSTree] Invalid centerX in assignPositions:", centerX);
      centerX = 0;
    }

    const levelSpacing = 200;
    node.x = centerX;
    node.y = node.level * levelSpacing;

    console.log(
      `[BSTree] Positioning node ${node.address} at (${node.x}, ${node.y}), level ${node.level}`
    );

    if (node.children) {
      const leftChild = node.children[0];
      const rightChild = node.children[1];

      console.log(
        `[BSTree] Node ${
          node.address
        } children check: left=${!!leftChild}, right=${!!rightChild}`
      );

      const levelsFromBottom = treeDepth - 1 - node.level;
      const horizontalSpread =
        baseSpacingAtBottom * Math.pow(2, levelsFromBottom);

      console.log(
        `[BSTree] Level ${node.level}, levels from bottom: ${levelsFromBottom}, horizontal spread: ${horizontalSpread}`
      );

      if (leftChild) {
        const childCenterX = centerX - horizontalSpread;
        console.log(
          `[BSTree] Left child will be at X: ${childCenterX}, Y will be: ${
            leftChild.level * levelSpacing
          }`
        );
        assignPositions(leftChild, childCenterX);
      }

      if (rightChild) {
        const childCenterX = centerX + horizontalSpread;
        console.log(
          `[BSTree] Right child will be at X: ${childCenterX}, Y will be: ${
            rightChild.level * levelSpacing
          }`
        );
        assignPositions(rightChild, childCenterX);
      }

      if (!leftChild && !rightChild) {
        console.log(`[BSTree] Node ${node.address} has no children`);
      }
    } else {
      console.log(`[BSTree] Node ${node.address} has no children array`);
    }
  }

  assignLevelsAndWidths(rootNode);
  assignPositions(rootNode, 0);

  console.log("[BSTree] Tree layout calculation completed");
  return rootNode;
}

function getTreeBounds(rootNode) {
  if (!rootNode) {
    console.error("[BSTree] getTreeBounds called with undefined rootNode");
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;

  function traverse(node) {
    if (!node) {
      console.warn(
        "[BSTree] traverse encountered undefined node in getTreeBounds"
      );
      return;
    }

    if (typeof node.x === "undefined" || typeof node.y === "undefined") {
      console.error(
        "[BSTree] Node missing coordinates in getTreeBounds:",
        node
      );
      return;
    }

    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child) => {
        if (child) {
          traverse(child);
        }
      });
    }
  }

  traverse(rootNode);

  if (minX === Infinity) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  return { minX, maxX, minY, maxY };
}

function renderTreeNodes(
  contentGroup,
  rootNode,
  offsetX,
  offsetY,
  scale,
  styles,
  nodePositions
) {
  function renderAllNodes(node) {
    if (!node) return;

    if (typeof node.x === "undefined" || typeof node.y === "undefined") {
      console.error("[BSTree] Node missing x or y coordinates:", node);
      return;
    }

    if (isNaN(node.x) || isNaN(node.y)) {
      console.error("[BSTree] Node has NaN coordinates:", node);
      return;
    }

    const x = offsetX + node.x * scale;
    const y = offsetY + node.y * scale;

    if (isNaN(x) || isNaN(y)) {
      console.error("[BSTree] Calculated NaN coordinates for node:", {
        node: node.address,
        nodeX: node.x,
        nodeY: node.y,
        offsetX,
        offsetY,
        scale,
        calculatedX: x,
        calculatedY: y,
      });
      return;
    }

    const nodeWidth = styles.node.width * scale;
    const nodeHeight =
      (styles.node.headerHeight +
        styles.node.fieldHeight * 3 +
        styles.node.fieldSpacing * 2 +
        styles.node.padding * 2) *
      scale;

    if (isNaN(nodeWidth) || isNaN(nodeHeight)) {
      console.error("[BSTree] Calculated NaN dimensions:", {
        nodeWidth,
        nodeHeight,
        scale,
      });
      return;
    }

    console.log(
      `[BSTree] Rendering node ${node.address} at (${x}, ${y}) with value: ${node.value} (original coords: ${node.x}, ${node.y})`
    );

    const nodeSpec = {
      x: x - nodeWidth / 2,
      y: y - nodeHeight / 2,
      address: node.address,
      title: node.address,
      fields: {
        value: node.value,
        left: node.left || "null",
        right: node.right || "null",
      },
      isCurrent: false,
      isIsolated: false,
    };

    if (isNaN(nodeSpec.x) || isNaN(nodeSpec.y)) {
      console.error("[BSTree] NodeSpec has NaN coordinates:", nodeSpec);
      return;
    }

    console.log(`[BSTree] Node spec for ${node.address}:`, nodeSpec);

    renderGenericNode(
      contentGroup,
      nodeSpec,
      styles.node,
      nodePositions,
      isAddress,
      truncateAddress
    );

    nodePositions[node.address] = {
      x: x - nodeWidth / 2,
      y: y - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
    };

    if (node.children) {
      console.log(`[BSTree] Checking children for node ${node.address}:`, {
        hasLeftChild: !!node.children[0],
        hasRightChild: !!node.children[1],
        childrenArray: node.children,
      });

      if (node.children[0]) {
        console.log(
          `[BSTree] Rendering left child: ${node.children[0].address}`
        );
        renderAllNodes(node.children[0]);
      }
      if (node.children[1]) {
        console.log(
          `[BSTree] Rendering right child: ${node.children[1].address}`
        );
        renderAllNodes(node.children[1]);
      }
    } else {
      console.log(`[BSTree] Node ${node.address} has no children to render`);
    }
  }

  if (!rootNode) {
    console.error("[BSTree] renderTreeNodes called with undefined rootNode");
    return;
  }

  console.log(
    "[BSTree] Starting to render all nodes from root:",
    rootNode.address
  );
  renderAllNodes(rootNode);
}

function renderTreeConnections(
  contentGroup,
  rootNode,
  offsetX,
  offsetY,
  scale,
  styles,
  nodePositions
) {
  function renderAllConnections(node) {
    if (!node) return;

    const parentPos = nodePositions[node.address];
    if (
      !parentPos ||
      typeof parentPos.x !== "number" ||
      typeof parentPos.y !== "number"
    ) {
      console.error(
        "[BSTree] Parent position not found or invalid in connections:",
        node.address
      );
      return;
    }
    const parentX = parentPos.x;
    const parentY = parentPos.y;

    const actualNodeWidth = styles.node.width;

    const headerHeight = styles.node.headerHeight;
    const fieldHeight = styles.node.fieldHeight;
    const fieldSpacing = styles.node.fieldSpacing;
    const padding = styles.node.padding;

    const leftFieldY =
      parentPos.y +
      headerHeight +
      padding +
      1 * (fieldHeight + fieldSpacing) +
      fieldHeight / 2;

    const rightFieldY =
      parentPos.y +
      headerHeight +
      padding +
      2 * (fieldHeight + fieldSpacing) +
      fieldHeight / 2;

    const leftSideX = parentPos.x;
    const rightSideX = parentPos.x + actualNodeWidth;

    console.log(`[BSTree] Connection coords for node ${node.address}:`, {
      parentPos,
      actualNodeWidth,
      leftSideX,
      rightSideX,
      leftFieldY,
      rightFieldY,
    });

    if (node.children) {
      if (node.children[0]) {
        const leftChild = node.children[0];
        const childPos = nodePositions[leftChild.address];
        if (
          childPos &&
          typeof childPos.x === "number" &&
          typeof childPos.y === "number"
        ) {
          const sourceX = leftSideX;
          const sourceY = leftFieldY;
          const targetY = childPos.y;

          const targetLeftEdgeX = childPos.x;
          const targetRightEdgeX = childPos.x + actualNodeWidth;

          const horizontalExtension = 15;
          let extendedX;

          if (sourceX > targetRightEdgeX) {
            extendedX = targetRightEdgeX - horizontalExtension;
          } else if (sourceX < targetLeftEdgeX) {
            extendedX = targetLeftEdgeX - horizontalExtension;
          } else {
            extendedX = sourceX - horizontalExtension;
          }

          console.log(
            `[BSTree] Left child arrow: source(${sourceX}, ${sourceY}) -> left to (${extendedX}, ${targetY}), target bounds: ${targetLeftEdgeX}-${targetRightEdgeX}`
          );

          const pathData = `M ${sourceX} ${sourceY} L ${extendedX} ${sourceY} L ${extendedX} ${targetY}`;

          contentGroup
            .append("path")
            .attr("d", pathData)
            .attr("fill", "none")
            .attr("stroke", styles.connection.color)
            .attr("stroke-width", styles.connection.strokeWidth)
            .attr("marker-end", "url(#arrowhead)");
        } else {
          console.warn(
            `[BSTree] Left child position not found or invalid:`,
            leftChild.address
          );
        }
      }

      if (node.children[1]) {
        const rightChild = node.children[1];
        const childPos = nodePositions[rightChild.address];
        if (
          childPos &&
          typeof childPos.x === "number" &&
          typeof childPos.y === "number"
        ) {
          const sourceX = rightSideX;
          const sourceY = rightFieldY;
          const targetY = childPos.y;

          const targetLeftEdgeX = childPos.x;
          const targetRightEdgeX = childPos.x + actualNodeWidth;

          const horizontalExtension = 15;
          let extendedX;

          if (sourceX < targetLeftEdgeX) {
            extendedX = targetLeftEdgeX + horizontalExtension;
          } else if (sourceX > targetRightEdgeX) {
            extendedX = targetRightEdgeX + horizontalExtension;
          } else {
            extendedX = sourceX + horizontalExtension;
          }

          console.log(
            `[BSTree] Right child arrow: source(${sourceX}, ${sourceY}) -> right to (${extendedX}, ${targetY}), target bounds: ${targetLeftEdgeX}-${targetRightEdgeX}`
          );

          const pathData = `M ${sourceX} ${sourceY} L ${extendedX} ${sourceY} L ${extendedX} ${targetY}`;

          contentGroup
            .append("path")
            .attr("d", pathData)
            .attr("fill", "none")
            .attr("stroke", styles.connection.color)
            .attr("stroke-width", styles.connection.strokeWidth)
            .attr("marker-end", "url(#arrowhead)");
        } else {
          console.warn(
            `[BSTree] Right child position not found or invalid:`,
            rightChild.address
          );
        }
      }
    }

    if (node.children) {
      if (node.children[0]) renderAllConnections(node.children[0]);
      if (node.children[1]) renderAllConnections(node.children[1]);
    }
  }

  if (!rootNode) {
    console.error(
      "[BSTree] renderTreeConnections called with undefined rootNode"
    );
    return;
  }

  console.log(
    "[BSTree] Starting to render all connections from root:",
    rootNode.address
  );
  renderAllConnections(rootNode);
}

function findNodeByAddress(rootNode, address) {
  if (!rootNode || !address) {
    console.warn("[BSTree] findNodeByAddress called with invalid parameters:", {
      rootNode: !!rootNode,
      address,
    });
    return null;
  }

  if (rootNode.address === address) {
    return rootNode;
  }

  if (rootNode.children && Array.isArray(rootNode.children)) {
    for (const child of rootNode.children) {
      if (child) {
        const found = findNodeByAddress(child, address);
        if (found) return found;
      }
    }
  }

  return null;
}

function drawConnection(contentGroup, connection, styles) {
  if (!connection) {
    console.warn("[BSTree] drawConnection called with undefined connection");
    return;
  }

  if (!connection.source || !connection.target) {
    console.warn("[BSTree] Connection missing source or target:", connection);
    return;
  }

  if (
    typeof connection.source.x !== "number" ||
    typeof connection.source.y !== "number"
  ) {
    console.warn(
      "[BSTree] Connection source has invalid coordinates:",
      connection.source
    );
    return;
  }

  if (
    typeof connection.target.x !== "number" ||
    typeof connection.target.y !== "number"
  ) {
    console.warn(
      "[BSTree] Connection target has invalid coordinates:",
      connection.target
    );
    return;
  }

  const { source, target } = connection;

  if (connection.style === "curved") {
    const midX = (source.x + target.x) / 2;
    const midY = source.y + (target.y - source.y) * 0.3;

    const path = `M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`;

    contentGroup
      .append("path")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", styles.color)
      .attr("stroke-width", styles.strokeWidth)
      .attr("marker-end", "url(#arrowhead)");
  } else {
    contentGroup
      .append("line")
      .attr("x1", source.x)
      .attr("y1", source.y)
      .attr("x2", target.x)
      .attr("y2", target.y)
      .attr("stroke", styles.color)
      .attr("stroke-width", styles.strokeWidth);
  }
}

function validateTreeStructure(rootNode) {
  if (!rootNode) {
    console.log("[BSTree] Validation: Empty tree (valid)");
    return true;
  }

  const issues = [];

  function validateNode(node, path = "root") {
    if (!node) {
      issues.push(`Undefined node at path: ${path}`);
      return;
    }

    if (!node.address) {
      issues.push(`Node missing address at path: ${path}`);
    }

    if (node.value === undefined || node.value === null) {
      issues.push(
        `Node missing value at path: ${path} (address: ${node.address})`
      );
    }

    if (typeof node.x !== "number" || isNaN(node.x)) {
      issues.push(
        `Node missing or invalid x coordinate at path: ${path} (address: ${node.address}, x: ${node.x})`
      );
    }

    if (typeof node.y !== "number" || isNaN(node.y)) {
      issues.push(
        `Node missing or invalid y coordinate at path: ${path} (address: ${node.address}, y: ${node.y})`
      );
    }

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child, index) => {
        if (child) {
          validateNode(child, `${path}.children[${index}]`);
        }
      });
    }
  }

  validateNode(rootNode);

  if (issues.length > 0) {
    console.error("[BSTree] Tree validation failed with issues:", issues);
    return false;
  }

  console.log("[BSTree] Tree validation passed");
  return true;
}

function findOrphanNodes(rootAddress, addressObjectMap) {
  const connectedNodes = new Set();
  const orphanNodes = [];

  function collectConnectedNodes(address) {
    if (!address || connectedNodes.has(address) || !addressObjectMap[address]) {
      return;
    }

    connectedNodes.add(address);
    const nodeData = addressObjectMap[address];

    if (nodeData.left) {
      collectConnectedNodes(nodeData.left);
    }
    if (nodeData.right) {
      collectConnectedNodes(nodeData.right);
    }
  }

  if (rootAddress) {
    collectConnectedNodes(rootAddress);
  }

  Object.keys(addressObjectMap).forEach((address) => {
    const nodeData = addressObjectMap[address];

    if (
      nodeData &&
      typeof nodeData === "object" &&
      ("value" in nodeData || "left" in nodeData || "right" in nodeData) &&
      !connectedNodes.has(address)
    ) {
      orphanNodes.push({
        address: address,
        ...nodeData,
        children: [],
      });
    }
  });

  console.log(
    "[BSTree] Found orphan nodes:",
    orphanNodes.map((n) => n.address)
  );
  return orphanNodes;
}

function renderOrphanNodes(
  contentGroup,
  orphanNodes,
  startX,
  startY,
  styles,
  nodePositions
) {
  if (!orphanNodes || orphanNodes.length === 0) {
    return { width: 0, height: 0 };
  }

  console.log("[BSTree] Rendering orphan nodes:", orphanNodes.length);

  const nodeSpacing = styles.node.width + 50;
  const scale = 1;
  let maxHeight = 0;

  orphanNodes.forEach((node, index) => {
    const nodeX = startX + index * nodeSpacing;
    const nodeY = startY;

    node.x = nodeX;
    node.y = nodeY;
    node.level = 0;

    console.log(
      `[BSTree] Positioning orphan node ${node.address} at (${nodeX}, ${nodeY})`
    );

    nodePositions[node.address] = {
      x: nodeX,
      y: nodeY,
      width: styles.node.width,
      height:
        styles.node.headerHeight +
        styles.node.fieldHeight * 3 +
        styles.node.fieldSpacing * 2 +
        styles.node.padding * 2,
    };

    try {
      const orphanStyles = {
        ...styles.node,
        stroke: "#ef4444",
        titleFill: "#fef2f2",
        titleStroke: "#ef4444",
      };

      const nodeSpec = {
        x: nodeX,
        y: nodeY,
        address: node.address,
        title: node.address,
        fields: {
          value: node.value,
          left: node.left || "null",
          right: node.right || "null",
        },
        isCurrent: false,
        isIsolated: false,
      };

      console.log(`[BSTree] Orphan node spec for ${node.address}:`, nodeSpec);

      renderGenericNode(
        contentGroup,
        nodeSpec,
        orphanStyles,
        nodePositions,
        isAddress,
        truncateAddress
      );

      const nodeHeight =
        orphanStyles.headerHeight +
        orphanStyles.fieldHeight * 3 +
        orphanStyles.fieldSpacing * 2 +
        orphanStyles.padding * 2;
      maxHeight = Math.max(maxHeight, nodeHeight);
    } catch (error) {
      console.error(
        `[BSTree] Error rendering orphan node ${node.address}:`,
        error
      );
    }
  });

  return {
    width: orphanNodes.length * nodeSpacing,
    height: maxHeight,
  };
}

function renderVariablePointerArrows(
  contentGroup,
  allConnectionPoints,
  nodePositions,
  styles,
  centerX
) {
  console.log("[BSTree] Rendering variable pointer arrows...");

  allConnectionPoints.forEach((connectionPoint) => {
    if (
      !connectionPoint ||
      !connectionPoint.targetAddress ||
      !connectionPoint.varName
    ) {
      return;
    }

    const targetNodePos = nodePositions[connectionPoint.targetAddress];
    if (!targetNodePos) {
      console.warn(
        `[BSTree] Target node position not found for ${connectionPoint.targetAddress}`
      );
      return;
    }

    const headerCenterX = targetNodePos.x + targetNodePos.width / 2;
    const headerCenterY = targetNodePos.y + styles.node.headerHeight / 2;

    const arrowLength = 40;
    const arrowY = headerCenterY;

    const arrowStartX = targetNodePos.x + targetNodePos.width + arrowLength;
    const arrowEndX = targetNodePos.x + targetNodePos.width;

    const arrowStartY = arrowY;
    const arrowEndY = arrowY;

    contentGroup
      .append("line")
      .attr("x1", arrowStartX)
      .attr("y1", arrowStartY)
      .attr("x2", arrowEndX)
      .attr("y2", arrowEndY)
      .attr("stroke", "#2563eb")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    const textX = arrowStartX;
    const textY = arrowStartY - 8;

    contentGroup
      .append("text")
      .attr("x", textX)
      .attr("y", textY)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", "#2563eb")
      .text(connectionPoint.varName);

    console.log(
      `[BSTree] Added pointer arrow for ${connectionPoint.varName} -> ${connectionPoint.targetAddress}`
    );
  });
}

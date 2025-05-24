import {
  defineArrowheads,
  renderVariableBox,
  isAddress,
  truncateAddress,
} from "../utils/visualizationUtils";

export function renderBSTreeVisualization(
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

  // Initialize positions and connections arrays
  const nodePositions = {};
  const allConnections = [];

  // Styles
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
      radius: 25,
      fill: "#ffffff",
      stroke: "#94a3b8",
      strokeWidth: 2,
      textFill: "#334155",
      fontSize: "14px",
      fontWeight: "bold",
    },
    connection: {
      strokeWidth: 2,
      color: "#334155",
      arrowSize: 8,
    },
  };

  // Define arrowheads
  defineArrowheads(contentGroup, styles.connection.arrowSize);

  // Parse tree structure - add defensive checks
  const rootAddress =
    instanceVariables && instanceVariables.root ? instanceVariables.root : null;
  console.log("[BSTree] Root address:", rootAddress);

  const treeData = parseTreeStructure(rootAddress, addressObjectMap);
  console.log("[BSTree] Parsed tree data:", treeData);

  // Calculate tree layout if tree exists
  let treeLayout = null;
  if (treeData) {
    treeLayout = calculateTreeLayout(treeData, styles.node.radius);

    // Validate the tree structure before proceeding with rendering
    if (treeLayout && !validateTreeStructure(treeLayout)) {
      console.error("[BSTree] Tree validation failed, skipping rendering");
      treeLayout = null;
    }
  }

  // Position calculations - place variable boxes above the tree
  const varBoxY = 30;
  const varBoxSpacing = 20;
  const instanceVarBoxX = 30;
  const localVarBoxX = instanceVarBoxX + styles.varBox.width + varBoxSpacing;

  console.log("[BSTree] Position calculations:", {
    varBoxY,
    instanceVarBoxX,
    localVarBoxX,
    varBoxSpacing,
  });

  // Render instance variables box
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

  // Render local variables box
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

  // Add the connection points to our connections array
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
        // Only add valid connection points - we'll connect them to tree nodes later if needed
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

  // Calculate tree area position - below the variable boxes
  const treeAreaY =
    varBoxY +
    Math.max(
      instanceVarBoxResult?.height || 80,
      localVarBoxResult?.height || 80
    ) +
    40;
  const treeAreaX = 30;
  const treeAreaWidth = width - treeAreaX - 30;
  const treeAreaHeight = height - treeAreaY - 30;

  if (treeLayout) {
    console.log("[BSTree] Tree layout exists, proceeding with rendering");

    try {
      // Center the tree in the available area
      const treeBounds = getTreeBounds(treeLayout);
      console.log("[BSTree] Tree bounds:", treeBounds);

      if (!treeBounds || typeof treeBounds.minX === "undefined") {
        console.error("[BSTree] Invalid tree bounds:", treeBounds);
        throw new Error("Invalid tree bounds");
      }

      const treeWidth =
        treeBounds.maxX - treeBounds.minX + 2 * styles.node.radius;
      const treeHeight =
        treeBounds.maxY - treeBounds.minY + 2 * styles.node.radius;

      console.log(`[BSTree] Tree dimensions: ${treeWidth} x ${treeHeight}`);
      console.log(
        `[BSTree] Available area: ${treeAreaWidth} x ${treeAreaHeight}`
      );

      const scale = Math.min(
        treeAreaWidth / treeWidth,
        treeAreaHeight / treeHeight,
        1
      );

      const offsetX =
        treeAreaX +
        (treeAreaWidth - treeWidth * scale) / 2 -
        treeBounds.minX * scale;
      const offsetY =
        treeAreaY +
        (treeAreaHeight - treeHeight * scale) / 2 -
        treeBounds.minY * scale;

      console.log(
        `[BSTree] Rendering with scale: ${scale}, offset: (${offsetX}, ${offsetY})`
      );

      // Render tree nodes and connections
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
        styles
      );

      console.log("[BSTree] Tree rendering completed successfully");
    } catch (error) {
      console.error("[BSTree] Error during tree rendering:", error);

      // Render error message instead of crashing
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
    console.log("[BSTree] No tree layout, rendering empty tree message");
    // Render empty tree message
    contentGroup
      .append("text")
      .attr("x", treeAreaX + treeAreaWidth / 2)
      .attr("y", treeAreaY + treeAreaHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("fill", "#6b7280")
      .text("Empty Tree");
  }

  // Draw connections from instance variables to tree root
  if (rootAddress && treeLayout) {
    console.log("[BSTree] Attempting to draw root connection...");
    const rootNode = findNodeByAddress(treeLayout, rootAddress);
    console.log("[BSTree] Root node found:", rootNode);
    console.log(
      "[BSTree] Instance var connection points:",
      instanceVarBoxResult?.connectionPoints
    );

    // Find the root connection point from instance variables
    const rootConnectionPoint = instanceVarBoxResult?.connectionPoints?.find(
      (cp) => cp.targetAddress === rootAddress || cp.varName === "root"
    );

    if (rootNode && rootConnectionPoint && rootConnectionPoint.sourceCoords) {
      console.log("[BSTree] Drawing root connection...");
      const treeBounds = getTreeBounds(treeLayout);
      const scale = Math.min(
        treeAreaWidth /
          (treeBounds.maxX - treeBounds.minX + 2 * styles.node.radius),
        treeAreaHeight /
          (treeBounds.maxY - treeBounds.minY + 2 * styles.node.radius),
        1
      );
      const offsetX =
        treeAreaX +
        (treeAreaWidth -
          (treeBounds.maxX - treeBounds.minX + 2 * styles.node.radius) *
            scale) /
          2 -
        treeBounds.minX * scale;
      const offsetY =
        treeAreaY +
        (treeAreaHeight -
          (treeBounds.maxY - treeBounds.minY + 2 * styles.node.radius) *
            scale) /
          2 -
        treeBounds.minY * scale;

      const sourceX = rootConnectionPoint.sourceCoords.x;
      const sourceY = rootConnectionPoint.sourceCoords.y;
      const targetX = offsetX + rootNode.x * scale;
      const targetY = offsetY + rootNode.y * scale;

      // Validate all coordinates before creating the connection
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

        allConnections.push({
          source: {
            x: sourceX,
            y: sourceY,
          },
          target: {
            x: targetX - styles.node.radius * scale,
            y: targetY,
          },
          style: "curved",
        });
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

  // Draw all connections
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

  return { nodePositions, connections: allConnections };
}

// Helper function to parse tree structure from addressObjectMap
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
      value: nodeData.value,
      children: [],
    };

    // Add left child
    if (nodeData.left) {
      const leftChild = buildNode(nodeData.left);
      if (leftChild) {
        leftChild.parent = node;
        leftChild.side = "left";
        node.children.push(leftChild);
      }
    }

    // Add right child
    if (nodeData.right) {
      const rightChild = buildNode(nodeData.right);
      if (rightChild) {
        rightChild.parent = node;
        rightChild.side = "right";
        node.children.push(rightChild);
      }
    }

    return node;
  }

  return buildNode(rootAddress);
}

// Helper function to calculate tree layout positions
function calculateTreeLayout(rootNode, nodeRadius) {
  if (!rootNode) {
    console.error(
      "[BSTree] calculateTreeLayout called with undefined rootNode"
    );
    return null;
  }

  console.log(
    "[BSTree] Starting tree layout calculation for root:",
    rootNode.address
  );

  const verticalSpacing = nodeRadius * 3;
  const horizontalSpacing = nodeRadius * 2.5;

  // First pass: calculate tree dimensions and assign positions
  function calculatePositions(node, depth = 0) {
    if (!node) {
      console.error("[BSTree] calculatePositions called with undefined node");
      return;
    }

    node.depth = depth;

    if (!node.children || node.children.length === 0) {
      // Leaf node
      node.width = 1;
      node.x = 0;
      console.log(
        `[BSTree] Leaf node ${node.address} at depth ${depth}: x=${node.x}, width=${node.width}`
      );
    } else {
      // Internal node - position children first
      let totalWidth = 0;
      const validChildren = node.children.filter(
        (child) => child !== null && child !== undefined
      );

      validChildren.forEach((child) => {
        calculatePositions(child, depth + 1);
        totalWidth += child.width || 1; // Ensure width is always a number
      });

      node.width = Math.max(totalWidth, 1);

      // Position children
      let currentX = 0;
      validChildren.forEach((child) => {
        const childWidth = child.width || 1; // Ensure width is always a number
        child.x = currentX + childWidth / 2;
        currentX += childWidth;
      });

      // Position this node at the center of its children
      if (validChildren.length === 1) {
        node.x = validChildren[0].x || 0;
      } else if (validChildren.length > 1) {
        const leftmost = validChildren[0];
        const rightmost = validChildren[validChildren.length - 1];
        node.x = ((leftmost.x || 0) + (rightmost.x || 0)) / 2;
      } else {
        // No valid children
        node.x = 0;
      }

      console.log(
        `[BSTree] Internal node ${node.address} at depth ${depth}: x=${node.x}, width=${node.width}`
      );
    }

    // Ensure y coordinate is always set
    node.y = depth * verticalSpacing;

    // Double-check that we have valid coordinates
    if (typeof node.x !== "number" || typeof node.y !== "number") {
      console.error(
        "[BSTree] Node has invalid coordinates after calculation:",
        { address: node.address, x: node.x, y: node.y }
      );
      node.x = 0;
      node.y = depth * verticalSpacing;
    }

    console.log(
      `[BSTree] Node ${node.address} final position: x=${node.x}, y=${node.y}`
    );
  }

  calculatePositions(rootNode);

  // Second pass: convert relative positions to absolute coordinates
  function convertToAbsolute(node, offsetX = 0) {
    if (!node) {
      console.error("[BSTree] convertToAbsolute called with undefined node");
      return;
    }

    // Ensure node has valid x coordinate before conversion
    if (typeof node.x !== "number") {
      console.error(
        "[BSTree] Node missing x coordinate in convertToAbsolute:",
        node
      );
      node.x = 0;
    }

    const oldX = node.x;
    node.x = (node.x + offsetX) * horizontalSpacing;
    console.log(
      `[BSTree] Converting node ${node.address}: ${oldX} -> ${node.x}`
    );

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child) => {
        if (child) {
          convertToAbsolute(child, offsetX);
        } else {
          console.warn(
            "[BSTree] Found undefined child in convertToAbsolute for node:",
            node.address
          );
        }
      });
    }
  }

  convertToAbsolute(rootNode);

  console.log("[BSTree] Tree layout calculation completed");
  return rootNode;
}

// Helper function to get tree bounds
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

  // Ensure we have valid bounds even if no valid nodes were found
  if (minX === Infinity) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  return { minX, maxX, minY, maxY };
}

// Helper function to render tree nodes
function renderTreeNodes(
  contentGroup,
  rootNode,
  offsetX,
  offsetY,
  scale,
  styles,
  nodePositions
) {
  function renderNode(node) {
    if (!node) {
      console.error("[BSTree] renderNode called with undefined node");
      return;
    }

    if (typeof node.x === "undefined" || typeof node.y === "undefined") {
      console.error("[BSTree] Node missing x or y coordinates:", node);
      return;
    }

    const x = offsetX + node.x * scale;
    const y = offsetY + node.y * scale;
    const radius = styles.node.radius * scale;

    console.log(
      `[BSTree] Rendering node at (${x}, ${y}) with value: ${node.value}`
    );

    // Create node group
    const nodeGroup = contentGroup
      .append("g")
      .attr("transform", `translate(${x}, ${y})`);

    // Draw circle
    nodeGroup
      .append("circle")
      .attr("r", radius)
      .attr("fill", styles.node.fill)
      .attr("stroke", styles.node.stroke)
      .attr("stroke-width", styles.node.strokeWidth);

    // Draw value text
    nodeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", styles.node.fontSize)
      .attr("font-weight", styles.node.fontWeight)
      .attr("fill", styles.node.textFill)
      .text(node.value);

    // Draw address text below the node
    nodeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", radius + 15)
      .attr("font-size", "10px")
      .attr("fill", styles.varBox.addressValueFill)
      .text(truncateAddress(node.address, 8));

    // Store position for connections
    nodePositions[node.address] = {
      x: x,
      y: y,
      radius: radius,
    };

    // Recursively render children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child) => {
        if (child) {
          renderNode(child);
        } else {
          console.warn("[BSTree] Found undefined child in node:", node.address);
        }
      });
    }
  }

  if (!rootNode) {
    console.error("[BSTree] renderTreeNodes called with undefined rootNode");
    return;
  }

  renderNode(rootNode);
}

// Helper function to render tree connections
function renderTreeConnections(
  contentGroup,
  rootNode,
  offsetX,
  offsetY,
  scale,
  styles
) {
  function renderConnections(node) {
    if (!node) {
      console.error("[BSTree] renderConnections called with undefined node");
      return;
    }

    if (typeof node.x === "undefined" || typeof node.y === "undefined") {
      console.error(
        "[BSTree] Node missing x or y coordinates in connections:",
        node
      );
      return;
    }

    const parentX = offsetX + node.x * scale;
    const parentY = offsetY + node.y * scale;
    const radius = styles.node.radius * scale;

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child) => {
        if (!child) {
          console.warn(
            "[BSTree] Found undefined child in connections for node:",
            node.address
          );
          return;
        }

        if (typeof child.x === "undefined" || typeof child.y === "undefined") {
          console.error(
            "[BSTree] Child node missing x or y coordinates:",
            child
          );
          return;
        }

        const childX = offsetX + child.x * scale;
        const childY = offsetY + child.y * scale;

        // Draw line from parent to child
        contentGroup
          .append("line")
          .attr("x1", parentX)
          .attr("y1", parentY + radius)
          .attr("x2", childX)
          .attr("y2", childY - radius)
          .attr("stroke", styles.connection.color)
          .attr("stroke-width", styles.connection.strokeWidth);

        // Recursively draw connections for children
        renderConnections(child);
      });
    }
  }

  if (!rootNode) {
    console.error(
      "[BSTree] renderTreeConnections called with undefined rootNode"
    );
    return;
  }

  renderConnections(rootNode);
}

// Helper function to find node by address
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

// Helper function to draw connections
function drawConnection(contentGroup, connection, styles) {
  // Add defensive checks
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
    // Draw curved arrow
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
    // Draw straight line
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

// Helper function to validate tree structure and coordinates
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

    if (typeof node.x !== "number") {
      issues.push(
        `Node missing or invalid x coordinate at path: ${path} (address: ${node.address}, x: ${node.x})`
      );
    }

    if (typeof node.y !== "number") {
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

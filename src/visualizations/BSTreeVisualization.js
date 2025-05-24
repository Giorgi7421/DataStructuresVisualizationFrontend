import {
  defineArrowheads,
  renderVariableBox,
  renderGenericNode,
  isAddress,
  truncateAddress,
  generateOrthogonalPath,
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

  // Parse tree structure - add defensive checks
  const rootAddress =
    instanceVariables && instanceVariables.root ? instanceVariables.root : null;
  console.log("[BSTree] Root address:", rootAddress);
  console.log("[BSTree] Address object map:", addressObjectMap);

  const treeData = parseTreeStructure(rootAddress, addressObjectMap);
  console.log("[BSTree] Parsed tree data:", treeData);

  // Calculate adaptive node size based on tree depth and available space
  const treeDepth = treeData ? getTreeDepth(treeData) : 1;
  const maxNodes = Math.pow(2, treeDepth); // Maximum possible nodes at deepest level
  const availableWidth = width - 100; // Available horizontal space

  // Adaptive node width: smaller for deeper trees
  const adaptiveNodeWidth = Math.max(
    Math.min(availableWidth / (maxNodes * 3.0), 180), // Increased max width to 180 like DoublyLinkedStructure
    120 // Increased minimum size to 120 for better text fit
  );

  // Adaptive spacing based on node size - much more generous
  const adaptiveHorizontalSpacing = adaptiveNodeWidth * 3.0; // Increased multiplier
  const adaptiveVerticalSpacing = Math.max(200, adaptiveNodeWidth * 2.5); // Increased multiplier

  console.log("[BSTree] Adaptive sizing:", {
    treeDepth,
    maxNodes,
    availableWidth,
    adaptiveNodeWidth,
    adaptiveHorizontalSpacing,
    adaptiveVerticalSpacing,
  });

  // Styles with adaptive node sizing
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
      width: adaptiveNodeWidth, // Use adaptive width instead of fixed 80
      headerHeight: 25, // Reduced to match DoublyLinkedStructure
      fieldHeight: 25, // Reduced to match DoublyLinkedStructure
      fieldSpacing: 5, // Keep at 5 like DoublyLinkedStructure
      padding: 10, // Reduced to match DoublyLinkedStructure
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
      fontSize: "12px", // Use same as DoublyLinkedStructure
      titleFontSize: "13px", // Keep same
    },
    connection: {
      strokeWidth: 2,
      color: "#334155",
      arrowSize: 8,
    },
  };

  // Define arrowheads
  defineArrowheads(contentGroup, styles.connection.arrowSize);

  // Add detailed logging of the tree structure
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

  // Calculate tree layout if tree exists
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

    // Log the final layout positions
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

    // Validate the tree structure before proceeding with rendering
    if (treeLayout && !validateTreeStructure(treeLayout)) {
      console.error("[BSTree] Tree validation failed, skipping rendering");
      treeLayout = null;
    }
  }

  // Position calculations - place variable boxes side by side with tree below
  const varBoxY = 20; // Both boxes at the same Y level
  const varBoxSpacing = 40; // Horizontal spacing between the two boxes
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

  // Calculate tree area position - below both variable boxes with increased spacing
  const treeAreaY =
    varBoxY +
    Math.max(
      instanceVarBoxResult?.height || 80,
      localVarBoxResult?.height || 80
    ) +
    80; // Increased spacing to 80px
  const treeAreaX = 50; // Start earlier to give more room for the tree
  const treeAreaWidth = width - treeAreaX - 50; // Give the tree plenty of width
  const treeAreaHeight = height - treeAreaY - 30;

  // Calculate where we want the root node to appear (center between the two variable boxes)
  const centerBetweenBoxes =
    (instanceVarBoxX + localVarBoxX + styles.varBox.width) / 2;

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

      // Bypass complex scaling - use direct positioning like DoublyLinkedStructure
      const scale = 1; // No scaling
      const offsetX = centerBetweenBoxes; // Simple horizontal center
      const offsetY = treeAreaY; // Simple vertical position

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
        styles,
        nodePositions
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
    console.log("[BSTree] No tree layout, displaying empty visualization");
    // Empty tree - no message displayed, just blank visualization area
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

      // Use direct positioning - same as main tree rendering
      const scale = 1; // No scaling
      const offsetX = centerBetweenBoxes; // Simple horizontal center
      const offsetY = treeAreaY; // Simple vertical position

      const sourceX = rootConnectionPoint.sourceCoords.x;
      const sourceY = rootConnectionPoint.sourceCoords.y;
      const targetX = offsetX + rootNode.x * scale;

      // Calculate the target Y to connect to the top edge of the root node header
      // Root node center Y coordinate
      const rootNodeCenterY = offsetY + rootNode.y * scale;
      // Root node height (no scaling)
      const nodeHeight =
        styles.node.headerHeight +
        styles.node.fieldHeight * 3 +
        styles.node.fieldSpacing * 2 +
        styles.node.padding * 2;
      // Target Y should be at the top edge of the node (root node center - half height)
      const targetY = rootNodeCenterY - nodeHeight / 2;

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

        // Create H-V orthogonal path: horizontal to target center X, then vertical down
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
      ...nodeData, // Preserve all properties from addressObjectMap
      children: [], // Initialize as empty array
    };

    // Add children in specific order: [0] = left, [1] = right
    const leftChild = nodeData.left ? buildNode(nodeData.left) : null;
    const rightChild = nodeData.right ? buildNode(nodeData.right) : null;

    if (leftChild) {
      leftChild.parent = node;
      leftChild.side = "left";
      node.children[0] = leftChild; // Left child at index 0
    }

    if (rightChild) {
      rightChild.parent = node;
      rightChild.side = "right";
      node.children[1] = rightChild; // Right child at index 1
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

// Helper function to calculate tree depth
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

// Helper function to calculate tree layout positions
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

  const levelHeight = adaptiveVerticalSpacing; // Use adaptive vertical spacing
  const minHorizontalSpacing = adaptiveHorizontalSpacing; // Use adaptive horizontal spacing

  // First pass: assign levels and calculate subtree widths
  function assignLevelsAndWidths(node, level = 0) {
    if (!node) return 0;

    node.level = level;

    // Calculate width needed for this subtree
    const leftWidth = node.children[0]
      ? assignLevelsAndWidths(node.children[0], level + 1)
      : 0;
    const rightWidth = node.children[1]
      ? assignLevelsAndWidths(node.children[1], level + 1)
      : 0;

    // Subtree width is the sum of left and right subtrees, with minimum spacing
    node.subtreeWidth = Math.max(
      minHorizontalSpacing,
      leftWidth + rightWidth + minHorizontalSpacing
    );

    console.log(
      `[BSTree] Node ${node.address} at level ${level}: subtreeWidth = ${node.subtreeWidth}`
    );
    return node.subtreeWidth;
  }

  // Second pass: assign x positions with simple level-based layout
  function assignPositions(node, centerX = 0) {
    if (!node) return;

    // Validate input centerX
    if (isNaN(centerX)) {
      console.error("[BSTree] Invalid centerX in assignPositions:", centerX);
      centerX = 0;
    }

    // Simple direct positioning without complex scaling - like DoublyLinkedStructure
    const levelSpacing = 200; // Fixed 200px between levels
    node.x = centerX;
    node.y = node.level * levelSpacing;

    console.log(
      `[BSTree] Positioning node ${node.address} at (${node.x}, ${node.y}), level ${node.level}`
    );

    // Position children with simple horizontal spreading
    if (node.children) {
      const leftChild = node.children[0];
      const rightChild = node.children[1];

      console.log(
        `[BSTree] Node ${
          node.address
        } children check: left=${!!leftChild}, right=${!!rightChild}`
      );

      // Simple direct horizontal spacing - like DoublyLinkedStructure
      const horizontalSpread = 300; // Fixed 300px spacing

      console.log(`[BSTree] Using horizontal spread: ${horizontalSpread}`);

      if (leftChild) {
        // Position left child to the left of parent
        const childCenterX = centerX - horizontalSpread;
        console.log(
          `[BSTree] Left child will be at X: ${childCenterX}, Y will be: ${
            leftChild.level * levelSpacing
          }`
        );
        assignPositions(leftChild, childCenterX);
      }

      if (rightChild) {
        // Position right child to the right of parent
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

  // Execute layout calculation
  assignLevelsAndWidths(rootNode);
  assignPositions(rootNode, 0);

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
  // Simple traversal to render all nodes
  function renderAllNodes(node) {
    if (!node) return;

    if (typeof node.x === "undefined" || typeof node.y === "undefined") {
      console.error("[BSTree] Node missing x or y coordinates:", node);
      return;
    }

    // Validate node coordinates are numbers
    if (isNaN(node.x) || isNaN(node.y)) {
      console.error("[BSTree] Node has NaN coordinates:", node);
      return;
    }

    const x = offsetX + node.x * scale;
    const y = offsetY + node.y * scale;

    // Validate calculated coordinates
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

    // Validate dimensions
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

    // Use renderGenericNode like other data structures
    const nodeSpec = {
      x: x - nodeWidth / 2, // Convert from center to top-left
      y: y - nodeHeight / 2, // Convert from center to top-left
      address: node.address,
      title: node.address, // Show address in the header instead of value
      fields: {
        value: node.value, // Add value as a field inside the box
        left: node.left || "null",
        right: node.right || "null",
      },
      isCurrent: false,
      isIsolated: false,
    };

    // Validate nodeSpec coordinates
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

    // Store position for connections (use top-left coordinates)
    nodePositions[node.address] = {
      x: x - nodeWidth / 2, // Top-left x
      y: y - nodeHeight / 2, // Top-left y
      width: nodeWidth,
      height: nodeHeight,
    };

    // Recursively render children
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
        renderAllNodes(node.children[0]); // Left child
      }
      if (node.children[1]) {
        console.log(
          `[BSTree] Rendering right child: ${node.children[1].address}`
        );
        renderAllNodes(node.children[1]); // Right child
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

// Helper function to render tree connections
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

    // Get parent's top-left coordinates from nodePositions
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
    const parentX = parentPos.x; // This is already scaled top-left X
    const parentY = parentPos.y; // This is already scaled top-left Y

    // Use the actual rendered node width from styles, not the stored scaled width
    const actualNodeWidth = styles.node.width;

    // Use UNSCALED style values since nodePositions already contains scaled coordinates
    const headerHeight = styles.node.headerHeight;
    const fieldHeight = styles.node.fieldHeight;
    const fieldSpacing = styles.node.fieldSpacing;
    const padding = styles.node.padding;

    // Calculate Y-coordinate for center of "left" field (field index 1, after "value")
    const leftFieldY =
      parentPos.y +
      headerHeight +
      padding +
      1 * (fieldHeight + fieldSpacing) +
      fieldHeight / 2;

    // Calculate Y-coordinate for center of "right" field (field index 2, after "value" and "left")
    const rightFieldY =
      parentPos.y +
      headerHeight +
      padding +
      2 * (fieldHeight + fieldSpacing) +
      fieldHeight / 2;

    // X-coordinates for left and right sides of node using actual rendered width
    const leftSideX = parentPos.x; // Actual left edge of node box
    const rightSideX = parentPos.x + actualNodeWidth; // Actual right edge using rendered width

    // Draw connections to children
    if (node.children) {
      // Left child connection - arrow from LEFT side of parent
      if (node.children[0]) {
        const leftChild = node.children[0];
        const childPos = nodePositions[leftChild.address];
        if (
          childPos &&
          typeof childPos.x === "number" &&
          typeof childPos.y === "number"
        ) {
          const sourceX = leftSideX; // Left side for left child
          const sourceY = leftFieldY;
          const targetX = childPos.x + styles.node.width / 2; // Use actual rendered width for center
          const targetY = childPos.y; // Top edge of address header

          // Create H-V orthogonal path: horizontal to target center X, then vertical down
          const pathData = `M ${sourceX} ${sourceY} L ${targetX} ${sourceY} L ${targetX} ${targetY}`;

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

      // Right child connection - arrow from RIGHT side of parent
      if (node.children[1]) {
        const rightChild = node.children[1];
        const childPos = nodePositions[rightChild.address];
        if (
          childPos &&
          typeof childPos.x === "number" &&
          typeof childPos.y === "number"
        ) {
          const sourceX = rightSideX; // Right side for right child
          const sourceY = rightFieldY;
          const targetX = childPos.x + styles.node.width / 2; // Use actual rendered width for center
          const targetY = childPos.y; // Top edge of address header

          // Create H-V orthogonal path: horizontal to target center X, then vertical down
          const pathData = `M ${sourceX} ${sourceY} L ${targetX} ${sourceY} L ${targetX} ${targetY}`;

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

    // Recursively draw connections for children
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

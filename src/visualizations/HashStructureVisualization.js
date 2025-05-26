import {
  defineArrowheads,
  renderVariableBox,
  renderGenericNode,
  isAddress,
  truncateAddress,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

export function renderHashStructureVisualization(
  contentGroup,
  width,
  height,
  operation,
  memorySnapshot,
  snapshotIdentifier
) {
  console.log("[HashStructure] Starting visualization with:", {
    operation,
    memorySnapshot,
  });

  // Define arrowheads for connections
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

  console.log("[HashStructure] Parsed state:", {
    state,
    instanceVariables,
    localVariables,
    addressObjectMap,
  });

  // Initialize positions and connections arrays
  const nodePositions = {};
  const allConnections = [];

  // Parse hash structure
  const hashData = parseHashStructure(instanceVariables, addressObjectMap);
  console.log("[HashStructure] Parsed hash data:", hashData);

  // Styles for hash structure visualization
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
    bucketArray: {
      width: 120,
      headerHeight: 30,
      bucketHeight: 35,
      padding: 10,
      fill: "#ffffff",
      stroke: "#94a3b8",
      titleFill: "#f1f5f9",
      titleStroke: "#94a3b8",
      titleTextFill: "#334155",
      bucketFill: "#ffffff",
      bucketStroke: "#cbd5e1",
      indexTextFill: "#64748b",
      fontSize: "12px",
      titleFontSize: "14px",
    },
    node: {
      width: 140,
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

  // Define arrowheads
  defineArrowheads(contentGroup, styles.connection.arrowSize);

  // Position calculations
  const varBoxY = 20;
  const varBoxSpacing = 40;
  const instanceVarBoxX = 30;
  const localVarBoxX = instanceVarBoxX + styles.varBox.width + varBoxSpacing;

  // Render instance variables box
  let instanceVarBoxResult;
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
      "[HashStructure] Instance variables box rendered successfully:",
      instanceVarBoxResult
    );
  } catch (error) {
    console.error(
      "[HashStructure] Error rendering instance variables box:",
      error
    );
    instanceVarBoxResult = { height: 80, connectionPoints: [] };
  }

  // Render local variables box
  let localVarBoxResult;
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
      "[HashStructure] Local variables box rendered successfully:",
      localVarBoxResult
    );
  } catch (error) {
    console.error(
      "[HashStructure] Error rendering local variables box:",
      error
    );
    localVarBoxResult = { height: 80, connectionPoints: [] };
  }

  // Calculate hash structure area position
  const hashAreaY =
    varBoxY +
    Math.max(
      instanceVarBoxResult?.height || 80,
      localVarBoxResult?.height || 80
    ) +
    60;

  const hashAreaX = 50;
  const hashAreaWidth = width - hashAreaX - 50;

  // Render hash structure if data exists
  if (hashData && hashData.buckets) {
    console.log("[HashStructure] Rendering hash structure...");

    try {
      renderHashStructure(
        contentGroup,
        hashData,
        hashAreaX,
        hashAreaY,
        hashAreaWidth,
        styles,
        nodePositions
      );

      // Draw connections from variables to hash structure
      drawVariableConnections(
        contentGroup,
        instanceVarBoxResult,
        localVarBoxResult,
        hashData,
        nodePositions,
        styles
      );

      console.log(
        "[HashStructure] Hash structure rendering completed successfully"
      );
    } catch (error) {
      console.error(
        "[HashStructure] Error during hash structure rendering:",
        error
      );

      // Render error message
      contentGroup
        .append("text")
        .attr("x", hashAreaX + hashAreaWidth / 2)
        .attr("y", hashAreaY + 100)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#ef4444")
        .text("Error rendering hash structure");
    }
  } else {
    console.log(
      "[HashStructure] No hash data found, displaying empty visualization"
    );

    // Show empty hash structure message
    contentGroup
      .append("text")
      .attr("x", hashAreaX + hashAreaWidth / 2)
      .attr("y", hashAreaY + 100)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("fill", "#64748b")
      .text("No hash structure data available");
  }

  return { nodePositions, connections: allConnections };
}

// Helper function to parse hash structure from state
function parseHashStructure(instanceVariables, addressObjectMap) {
  console.log("[HashStructure] Parsing hash structure...");

  // Look for common hash structure variable names
  const hashVariableNames = ["buckets", "table", "data", "hashTable", "map"];
  let bucketsAddress = null;
  let bucketCount = 0;

  // Find buckets array address
  for (const varName of hashVariableNames) {
    if (instanceVariables[varName] && isAddress(instanceVariables[varName])) {
      bucketsAddress = instanceVariables[varName];
      console.log(
        `[HashStructure] Found buckets at ${varName}: ${bucketsAddress}`
      );
      break;
    }
  }

  // Also check for bucket count
  const countVariableNames = ["nBuckets", "bucketCount", "capacity", "size"];
  for (const varName of countVariableNames) {
    if (
      instanceVariables[varName] &&
      typeof instanceVariables[varName] === "number"
    ) {
      bucketCount = instanceVariables[varName];
      console.log(
        `[HashStructure] Found bucket count at ${varName}: ${bucketCount}`
      );
      break;
    }
  }

  if (!bucketsAddress) {
    console.log("[HashStructure] No buckets array found");
    return null;
  }

  const bucketsData = addressObjectMap[bucketsAddress];
  if (!bucketsData) {
    console.log("[HashStructure] Buckets data not found in addressObjectMap");
    return null;
  }

  // Parse bucket array and chains
  const buckets = [];
  const actualBucketCount = bucketCount || Object.keys(bucketsData).length;

  for (let i = 0; i < actualBucketCount; i++) {
    const bucketAddress = bucketsData[i] || bucketsData[i.toString()];
    const chain = bucketAddress
      ? parseChain(bucketAddress, addressObjectMap)
      : null;

    buckets.push({
      index: i,
      address: bucketAddress,
      chain: chain,
    });
  }

  return {
    bucketsAddress,
    buckets,
    bucketCount: actualBucketCount,
  };
}

// Helper function to parse a chain of nodes
function parseChain(startAddress, addressObjectMap) {
  if (!startAddress || !addressObjectMap[startAddress]) {
    return null;
  }

  const nodes = [];
  let currentAddress = startAddress;
  const visited = new Set();

  while (currentAddress && !visited.has(currentAddress)) {
    visited.add(currentAddress);
    const nodeData = addressObjectMap[currentAddress];

    if (!nodeData) break;

    const node = {
      address: currentAddress,
      ...nodeData,
    };

    nodes.push(node);

    // Look for next pointer (common names: next, link, successor)
    currentAddress =
      nodeData.next || nodeData.link || nodeData.successor || null;
  }

  return nodes.length > 0 ? nodes : null;
}

// Helper function to render the hash structure
function renderHashStructure(
  contentGroup,
  hashData,
  startX,
  startY,
  availableWidth,
  styles,
  nodePositions
) {
  const bucketArrayWidth = styles.bucketArray.width;
  const bucketHeight = styles.bucketArray.bucketHeight;
  const nodeWidth = styles.node.width;
  const nodeSpacing = 20;
  const chainSpacing = 60;

  // Calculate bucket array height
  const bucketArrayHeight =
    styles.bucketArray.headerHeight +
    hashData.buckets.length * bucketHeight +
    styles.bucketArray.padding * 2;

  // Render bucket array container
  const bucketArrayGroup = contentGroup
    .append("g")
    .attr("class", "bucket-array");

  // Bucket array background
  bucketArrayGroup
    .append("rect")
    .attr("x", startX)
    .attr("y", startY)
    .attr("width", bucketArrayWidth)
    .attr("height", bucketArrayHeight)
    .attr("fill", styles.bucketArray.fill)
    .attr("stroke", styles.bucketArray.stroke)
    .attr("stroke-width", 2);

  // Bucket array header
  bucketArrayGroup
    .append("rect")
    .attr("x", startX)
    .attr("y", startY)
    .attr("width", bucketArrayWidth)
    .attr("height", styles.bucketArray.headerHeight)
    .attr("fill", styles.bucketArray.titleFill)
    .attr("stroke", styles.bucketArray.titleStroke);

  bucketArrayGroup
    .append("text")
    .attr("x", startX + bucketArrayWidth / 2)
    .attr("y", startY + styles.bucketArray.headerHeight / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("font-size", styles.bucketArray.titleFontSize)
    .attr("font-weight", "bold")
    .attr("fill", styles.bucketArray.titleTextFill)
    .text("buckets");

  // Store bucket array position
  nodePositions["buckets"] = {
    x: startX,
    y: startY,
    width: bucketArrayWidth,
    height: bucketArrayHeight,
  };

  // Render individual buckets and chains
  hashData.buckets.forEach((bucket, index) => {
    const bucketY =
      startY +
      styles.bucketArray.headerHeight +
      styles.bucketArray.padding +
      index * bucketHeight;

    // Render bucket cell
    bucketArrayGroup
      .append("rect")
      .attr("x", startX + 5)
      .attr("y", bucketY)
      .attr("width", bucketArrayWidth - 10)
      .attr("height", bucketHeight - 2)
      .attr("fill", styles.bucketArray.bucketFill)
      .attr("stroke", styles.bucketArray.bucketStroke);

    // Bucket index
    bucketArrayGroup
      .append("text")
      .attr("x", startX + 20)
      .attr("y", bucketY + bucketHeight / 2 + 4)
      .attr("font-size", styles.bucketArray.fontSize)
      .attr("fill", styles.bucketArray.indexTextFill)
      .text(index);

    // Bucket pointer indicator
    if (bucket.chain) {
      bucketArrayGroup
        .append("circle")
        .attr("cx", startX + bucketArrayWidth - 20)
        .attr("cy", bucketY + bucketHeight / 2)
        .attr("r", 3)
        .attr("fill", styles.connection.color);
    }

    // Render chain if it exists
    if (bucket.chain) {
      renderChain(
        contentGroup,
        bucket.chain,
        startX + bucketArrayWidth + chainSpacing,
        bucketY,
        nodeWidth,
        nodeSpacing,
        styles,
        nodePositions
      );

      // Draw connection from bucket to first node in chain
      const firstNode = bucket.chain[0];
      if (firstNode && nodePositions[firstNode.address]) {
        const sourceX = startX + bucketArrayWidth;
        const sourceY = bucketY + bucketHeight / 2;
        const targetX = nodePositions[firstNode.address].x;
        const targetY =
          nodePositions[firstNode.address].y + styles.node.headerHeight / 2;

        contentGroup
          .append("line")
          .attr("x1", sourceX)
          .attr("y1", sourceY)
          .attr("x2", targetX)
          .attr("y2", targetY)
          .attr("stroke", styles.connection.color)
          .attr("stroke-width", styles.connection.strokeWidth)
          .attr("marker-end", "url(#arrowhead)");
      }
    }
  });
}

// Helper function to render a chain of nodes
function renderChain(
  contentGroup,
  chain,
  startX,
  startY,
  nodeWidth,
  nodeSpacing,
  styles,
  nodePositions
) {
  chain.forEach((node, index) => {
    const nodeX = startX + index * (nodeWidth + nodeSpacing);
    const nodeY = startY;

    // Create node specification
    const nodeSpec = {
      x: nodeX,
      y: nodeY,
      address: node.address,
      title: node.address,
      fields: {
        key: node.key || node.data || "N/A",
        value: node.value || "N/A",
        next: node.next || "null",
      },
      isCurrent: false,
      isIsolated: false,
    };

    // Render the node
    renderGenericNode(
      contentGroup,
      nodeSpec,
      styles.node,
      nodePositions,
      isAddress,
      truncateAddress
    );

    // Draw connection to next node
    if (index < chain.length - 1) {
      const nextNodeX = startX + (index + 1) * (nodeWidth + nodeSpacing);
      const connectionY = nodeY + styles.node.headerHeight / 2;

      contentGroup
        .append("line")
        .attr("x1", nodeX + nodeWidth)
        .attr("y1", connectionY)
        .attr("x2", nextNodeX)
        .attr("y2", connectionY)
        .attr("stroke", styles.connection.color)
        .attr("stroke-width", styles.connection.strokeWidth)
        .attr("marker-end", "url(#arrowhead)");
    }
  });
}

// Helper function to draw connections from variables to hash structure
function drawVariableConnections(
  contentGroup,
  instanceVarBoxResult,
  localVarBoxResult,
  hashData,
  nodePositions,
  styles
) {
  // Draw connection from instance variables to buckets array
  if (instanceVarBoxResult?.connectionPoints && nodePositions["buckets"]) {
    const bucketsConnectionPoint = instanceVarBoxResult.connectionPoints.find(
      (cp) =>
        cp.targetAddress === hashData.bucketsAddress || cp.varName === "buckets"
    );

    if (bucketsConnectionPoint && bucketsConnectionPoint.sourceCoords) {
      const sourceX = bucketsConnectionPoint.sourceCoords.x;
      const sourceY = bucketsConnectionPoint.sourceCoords.y;
      const targetX = nodePositions["buckets"].x;
      const targetY = nodePositions["buckets"].y; // Top edge of the buckets array

      // Create 5-segment path
      const horizontalExtension = 20; // 1st part: go right
      const verticalDrop = 40; // 2nd part: go down
      const bucketArrayRightEdge =
        nodePositions["buckets"].x + nodePositions["buckets"].width;
      const additionalLeftDistance = 20; // 4th part: go a bit further left

      const extendedX = sourceX + horizontalExtension;
      const dropY = sourceY + verticalDrop;
      const rightEdgeX = bucketArrayRightEdge; // 3rd part: reach right edge
      const finalLeftX = bucketArrayRightEdge - additionalLeftDistance; // 4th part: go further left

      // Create 5-segment path: start -> right -> down -> left to right edge -> further left -> down to target
      const pathData = `M ${sourceX} ${sourceY} L ${extendedX} ${sourceY} L ${extendedX} ${dropY} L ${rightEdgeX} ${dropY} L ${finalLeftX} ${dropY} L ${finalLeftX} ${targetY}`;

      contentGroup
        .append("path")
        .attr("d", pathData)
        .attr("fill", "none")
        .attr("stroke", styles.connection.color)
        .attr("stroke-width", styles.connection.strokeWidth)
        .attr("marker-end", "url(#arrowhead)");
    }
  }

  // Draw connections from local variables to specific nodes
  if (localVarBoxResult?.connectionPoints) {
    localVarBoxResult.connectionPoints.forEach((connectionPoint) => {
      if (
        connectionPoint.targetAddress &&
        nodePositions[connectionPoint.targetAddress]
      ) {
        const sourceX = connectionPoint.sourceCoords.x;
        const sourceY = connectionPoint.sourceCoords.y;
        const targetPos = nodePositions[connectionPoint.targetAddress];
        const targetX = targetPos.x + targetPos.width;
        const targetY = targetPos.y + styles.node.headerHeight / 2;

        // Create orthogonal path
        const pathData = `M ${sourceX} ${sourceY} L ${targetX} ${sourceY} L ${targetX} ${targetY}`;

        contentGroup
          .append("path")
          .attr("d", pathData)
          .attr("fill", "none")
          .attr("stroke", "#2563eb") // Blue for local variable connections
          .attr("stroke-width", styles.connection.strokeWidth)
          .attr("marker-end", "url(#arrowhead)");
      }
    });
  }
}

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

  // Position calculations - create a left section that covers full Y-axis and maximize space usage
  const leftSectionX = 10; // Minimal margin from left edge
  const leftSectionY = 10; // Minimal margin from top
  const leftSectionWidth = Math.max(
    styles.varBox.width + 20, // Width for instance variables box plus padding
    styles.bucketArray.width + 20
  ); // Width for bucket array, whichever is larger
  const leftSectionHeight = height - 20; // Cover entire Y-axis minus minimal padding

  // Position instance variables at top left of left section
  const instanceVarBoxX = leftSectionX;
  const instanceVarBoxY = leftSectionY;

  // Render instance variables box
  let instanceVarBoxResult;
  try {
    instanceVarBoxResult = renderVariableBox(
      contentGroup,
      "Instance Variables",
      instanceVariables,
      instanceVarBoxX,
      instanceVarBoxY,
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

  // Calculate hash structure area position - maximize remaining space
  const hashAreaY = leftSectionY; // Start from same Y as left section
  const hashAreaX = leftSectionX + leftSectionWidth + 10; // Minimal gap after left section
  const hashAreaWidth = width - hashAreaX - 10; // Use almost all remaining width to right edge
  const hashAreaHeight = leftSectionHeight; // Same height as left section (full height)

  // Calculate number of horizontal sections needed (1 for local vars + number of buckets)
  const totalSections =
    hashData && hashData.buckets ? hashData.buckets.length + 1 : 2;

  // Calculate minimum section height needed for nodes with padding
  const minSectionHeight =
    styles.node.headerHeight + styles.node.fieldHeight * 3 + 40; // Node height + padding
  const calculatedTotalHeight = totalSections * minSectionHeight;

  // Use the larger of calculated height or available height
  const effectiveHashAreaHeight = Math.max(
    hashAreaHeight,
    calculatedTotalHeight
  );
  const sectionHeight = effectiveHashAreaHeight / totalSections;

  // Position local variables box in the top horizontal section (section 0)
  const localVarBoxX = hashAreaX + 20; // Some padding from left edge of hash area
  const localVarBoxY =
    hashAreaY + sectionHeight / 2 - styles.varBox.headerHeight / 2; // Center vertically in top section

  let localVarBoxResult;
  try {
    localVarBoxResult = renderVariableBox(
      contentGroup,
      "Local Variables",
      localVariables,
      localVarBoxX,
      localVarBoxY,
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

  // Calculate buckets array positioning - position it below the instance variables in the left section
  const instanceVarBoxHeight = instanceVarBoxResult?.height || 80;
  const remainingLeftSectionHeight =
    leftSectionHeight - instanceVarBoxHeight - 40; // Remaining space after instance variables and spacing
  const bucketArrayHeight =
    hashData && hashData.buckets
      ? styles.bucketArray.headerHeight +
        hashData.buckets.length * styles.bucketArray.bucketHeight +
        styles.bucketArray.padding * 2
      : 100;

  // Position buckets array below instance variables, centered horizontally in left section
  const bucketArrayX =
    leftSectionX + (leftSectionWidth - styles.bucketArray.width) / 2; // Center horizontally in left section
  const bucketArrayY =
    leftSectionY +
    instanceVarBoxHeight +
    40 +
    (remainingLeftSectionHeight - bucketArrayHeight) / 2; // Below instance variables, centered vertically in remaining space

  // TEMPORARY: Draw layout borders for debugging
  const debugGroup = contentGroup.append("g").attr("class", "debug-borders");

  // Left section border (red)
  debugGroup
    .append("rect")
    .attr("x", leftSectionX)
    .attr("y", leftSectionY)
    .attr("width", leftSectionWidth)
    .attr("height", leftSectionHeight)
    .attr("fill", "none")
    .attr("stroke", "red")
    .attr("stroke-width", 3)
    .attr("stroke-dasharray", "10,5");

  // Hash sections area border (blue)
  debugGroup
    .append("rect")
    .attr("x", hashAreaX)
    .attr("y", hashAreaY)
    .attr("width", hashAreaWidth)
    .attr("height", effectiveHashAreaHeight)
    .attr("fill", "none")
    .attr("stroke", "blue")
    .attr("stroke-width", 3)
    .attr("stroke-dasharray", "10,5");

  // First horizontal section border (orange) - for local variables
  debugGroup
    .append("rect")
    .attr("x", hashAreaX)
    .attr("y", hashAreaY)
    .attr("width", hashAreaWidth)
    .attr("height", sectionHeight)
    .attr("fill", "none")
    .attr("stroke", "orange")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,3");

  // Instance variables area border (green)
  debugGroup
    .append("rect")
    .attr("x", instanceVarBoxX - 5)
    .attr("y", instanceVarBoxY - 5)
    .attr("width", styles.varBox.width + 10)
    .attr("height", (instanceVarBoxResult?.height || 80) + 10)
    .attr("fill", "none")
    .attr("stroke", "green")
    .attr("stroke-width", 2);

  // Local variables area border (cyan) - now in hash area
  debugGroup
    .append("rect")
    .attr("x", localVarBoxX - 5)
    .attr("y", localVarBoxY - 5)
    .attr("width", styles.varBox.width + 10)
    .attr("height", (localVarBoxResult?.height || 80) + 10)
    .attr("fill", "none")
    .attr("stroke", "cyan")
    .attr("stroke-width", 2);

  // Buckets array area border (purple)
  debugGroup
    .append("rect")
    .attr("x", bucketArrayX - 5)
    .attr("y", bucketArrayY - 5)
    .attr("width", styles.bucketArray.width + 10)
    .attr("height", bucketArrayHeight + 10)
    .attr("fill", "none")
    .attr("stroke", "purple")
    .attr("stroke-width", 2);

  // Add labels for each section
  debugGroup
    .append("text")
    .attr("x", leftSectionX + 5)
    .attr("y", leftSectionY + 15)
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("fill", "red")
    .text("LEFT SECTION");

  debugGroup
    .append("text")
    .attr("x", hashAreaX + 5)
    .attr("y", hashAreaY + 15)
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("fill", "blue")
    .text("HASH SECTIONS AREA");

  debugGroup
    .append("text")
    .attr("x", hashAreaX + 5)
    .attr("y", hashAreaY + 35)
    .attr("font-size", "10px")
    .attr("font-weight", "bold")
    .attr("fill", "orange")
    .text("SECTION 0 (Local Vars)");

  debugGroup
    .append("text")
    .attr("x", instanceVarBoxX)
    .attr("y", instanceVarBoxY - 8)
    .attr("font-size", "10px")
    .attr("font-weight", "bold")
    .attr("fill", "green")
    .text("INSTANCE VARS");

  debugGroup
    .append("text")
    .attr("x", localVarBoxX)
    .attr("y", localVarBoxY - 8)
    .attr("font-size", "10px")
    .attr("font-weight", "bold")
    .attr("fill", "cyan")
    .text("LOCAL VARS");

  debugGroup
    .append("text")
    .attr("x", bucketArrayX)
    .attr("y", bucketArrayY - 8)
    .attr("font-size", "10px")
    .attr("font-weight", "bold")
    .attr("fill", "purple")
    .text("BUCKETS ARRAY");

  // Render buckets array directly in the left section at the calculated position
  if (hashData && hashData.buckets) {
    const bucketArrayGroup = contentGroup
      .append("g")
      .attr("class", "bucket-array");

    // Bucket array background
    bucketArrayGroup
      .append("rect")
      .attr("x", bucketArrayX)
      .attr("y", bucketArrayY)
      .attr("width", styles.bucketArray.width)
      .attr("height", bucketArrayHeight)
      .attr("fill", styles.bucketArray.fill)
      .attr("stroke", styles.bucketArray.stroke)
      .attr("stroke-width", 2);

    // Bucket array header
    bucketArrayGroup
      .append("rect")
      .attr("x", bucketArrayX)
      .attr("y", bucketArrayY)
      .attr("width", styles.bucketArray.width)
      .attr("height", styles.bucketArray.headerHeight)
      .attr("fill", styles.bucketArray.titleFill)
      .attr("stroke", styles.bucketArray.titleStroke);

    bucketArrayGroup
      .append("text")
      .attr("x", bucketArrayX + styles.bucketArray.width / 2)
      .attr("y", bucketArrayY + styles.bucketArray.headerHeight / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("font-size", styles.bucketArray.titleFontSize)
      .attr("font-weight", "bold")
      .attr("fill", styles.bucketArray.titleTextFill)
      .text("buckets");

    // Store bucket array position
    nodePositions["buckets"] = {
      x: bucketArrayX,
      y: bucketArrayY,
      width: styles.bucketArray.width,
      height: bucketArrayHeight,
    };

    // Render individual bucket cells
    hashData.buckets.forEach((bucket, index) => {
      const bucketY =
        bucketArrayY +
        styles.bucketArray.headerHeight +
        styles.bucketArray.padding +
        index * styles.bucketArray.bucketHeight;

      // Render bucket cell
      bucketArrayGroup
        .append("rect")
        .attr("x", bucketArrayX + 5)
        .attr("y", bucketY)
        .attr("width", styles.bucketArray.width - 10)
        .attr("height", styles.bucketArray.bucketHeight - 2)
        .attr("fill", styles.bucketArray.bucketFill)
        .attr("stroke", styles.bucketArray.bucketStroke);

      // Bucket index
      bucketArrayGroup
        .append("text")
        .attr("x", bucketArrayX + 20)
        .attr("y", bucketY + styles.bucketArray.bucketHeight / 2 + 4)
        .attr("font-size", styles.bucketArray.fontSize)
        .attr("fill", styles.bucketArray.indexTextFill)
        .text(bucket.index);

      // Bucket pointer indicator
      if (bucket.chain) {
        bucketArrayGroup
          .append("circle")
          .attr("cx", bucketArrayX + styles.bucketArray.width - 20)
          .attr("cy", bucketY + styles.bucketArray.bucketHeight / 2)
          .attr("r", 3)
          .attr("fill", styles.connection.color);
      }
    });
  }

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
        effectiveHashAreaHeight,
        bucketArrayX,
        bucketArrayY,
        totalSections,
        sectionHeight,
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
  availableHeight,
  bucketArrayX,
  bucketArrayY,
  totalSections,
  sectionHeight,
  styles,
  nodePositions
) {
  const nodeWidth = styles.node.width;
  const nodeSpacing = 20;

  // Calculate horizontal sections area - use full available width and height
  const sectionsStartX = startX; // Start at the beginning of hash area
  const sectionsStartY = startY; // Start at the beginning of hash area
  const sectionsAreaWidth = availableWidth; // Use full available width
  const sectionsAreaHeight = availableHeight; // Use full available height

  // Render horizontal sections and node chains (buckets array is rendered separately in main layout)
  hashData.buckets.forEach((bucket, index) => {
    // Calculate horizontal section for this bucket (section 0 is for local variables, so buckets start from section 1)
    const bucketSectionIndex = bucket.index + 1; // Offset by 1 since section 0 is for local variables
    const sectionX = sectionsStartX;
    const sectionY = sectionsStartY + bucketSectionIndex * sectionHeight;

    // Draw horizontal section divider (except for the last one)
    if (bucketSectionIndex < totalSections - 1) {
      contentGroup
        .append("line")
        .attr("x1", sectionX)
        .attr("y1", sectionY + sectionHeight)
        .attr("x2", sectionX + sectionsAreaWidth)
        .attr("y2", sectionY + sectionHeight)
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 2);
    }

    // Render horizontal chain if it exists
    if (bucket.chain) {
      // Calculate the actual total node height including all components
      const fieldCount = 3; // key, value, next
      const fieldsAreaHeight =
        fieldCount * styles.node.fieldHeight +
        (fieldCount - 1) * styles.node.fieldSpacing;
      const actualNodeHeight =
        styles.node.headerHeight + styles.node.padding * 2 + fieldsAreaHeight;

      renderHorizontalChain(
        contentGroup,
        bucket.chain,
        sectionX + 20, // Start with some padding from left edge
        sectionY + sectionHeight / 2 - actualNodeHeight / 2, // Center vertically in section using actual node height
        nodeWidth,
        nodeSpacing,
        styles,
        nodePositions
      );

      // Draw connection from bucket to first node in chain
      const firstNode = bucket.chain[0];
      if (firstNode && nodePositions[firstNode.address]) {
        // Calculate bucket cell position for connection
        const bucketCellY =
          bucketArrayY +
          styles.bucketArray.headerHeight +
          styles.bucketArray.padding +
          bucket.index * styles.bucketArray.bucketHeight;

        const sourceX = bucketArrayX + styles.bucketArray.width;
        const sourceY = bucketCellY + styles.bucketArray.bucketHeight / 2;
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

// Helper function to render a horizontal chain of nodes
function renderHorizontalChain(
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

    // Draw horizontal connection to next node
    if (index < chain.length - 1) {
      const nextNodeX = startX + (index + 1) * (nodeWidth + nodeSpacing);
      const connectionY = nodeY + styles.node.headerHeight / 2; // Center of the node

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
      const targetY =
        nodePositions["buckets"].y + nodePositions["buckets"].height / 2;

      // Create simple path from source to target
      const pathData = `M ${sourceX} ${sourceY} L ${
        sourceX + 20
      } ${sourceY} L ${sourceX + 20} ${targetY} L ${targetX} ${targetY}`;

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
        const targetX = targetPos.x;
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

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
    width,
    height,
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
      width: 280,
      headerHeight: 30,
      fieldHeight: 28,
      fieldSpacing: 6,
      padding: 12,
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
      fontSize: "13px",
      titleFontSize: "14px",
    },
    bucketArray: {
      width: 160,
      headerHeight: 35,
      bucketHeight: 40,
      padding: 12,
      fill: "#ffffff",
      stroke: "#94a3b8",
      titleFill: "#f1f5f9",
      titleStroke: "#94a3b8",
      titleTextFill: "#334155",
      bucketFill: "#ffffff",
      bucketStroke: "#cbd5e1",
      indexTextFill: "#64748b",
      fontSize: "13px",
      titleFontSize: "15px",
    },
    node: {
      width: 180,
      headerHeight: 30,
      fieldHeight: 28,
      fieldSpacing: 6,
      padding: 12,
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
      fontSize: "13px",
      titleFontSize: "14px",
    },
    connection: {
      strokeWidth: 2,
      color: "#334155",
      arrowSize: 8,
    },
  };

  // Define arrowheads
  defineArrowheads(contentGroup, styles.connection.arrowSize);

  // Position calculations - use much more of the available space
  const leftSectionX = 20;
  const leftSectionY = 20;
  const leftSectionWidth = Math.max(
    styles.varBox.width + 40,
    styles.bucketArray.width + 40
  );
  const leftSectionHeight = height - 40;

  // Position instance variables at top left of left section
  const instanceVarBoxX = leftSectionX + 10;
  const instanceVarBoxY = leftSectionY + 10;

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

  // Calculate hash structure area position - use much more space
  const hashAreaY = leftSectionY; // Start from same Y as left section
  const hashAreaX = leftSectionX + leftSectionWidth + 30; // Increased gap from 10

  // IMPORTANT: Calculate the actual available width after accounting for auto-fit scaling
  // The auto-fit will scale down the content, so we need to use much more of the nominal width
  // to ensure we fill the available space after scaling
  const baseHashAreaWidth = width - hashAreaX - 30; // Basic calculation

  // Be extremely aggressive with scaling compensation
  // Estimate how much the content will be scaled down and compensate heavily
  const estimatedContentWidth = leftSectionWidth + baseHashAreaWidth;
  const estimatedScale = Math.min((width - 80) / estimatedContentWidth, 1); // 80px total padding

  // Use extremely aggressive compensation - multiply by 4.0 instead of 2.5
  const scalingCompensation = estimatedScale < 1 ? 4.0 / estimatedScale : 3.0;
  const hashAreaWidth = baseHashAreaWidth * scalingCompensation;

  console.log("[HashStructure] Width calculations:", {
    width,
    baseHashAreaWidth,
    estimatedScale,
    scalingCompensation,
    finalHashAreaWidth: hashAreaWidth,
  });

  const hashAreaHeight = leftSectionHeight; // Same height as left section (full height)

  // Calculate number of horizontal sections needed (1 for local vars + number of buckets)
  const totalSections =
    hashData && hashData.buckets ? hashData.buckets.length + 1 : 2;

  // Calculate minimum section height needed for nodes with padding - use larger values
  const minSectionHeight =
    styles.node.headerHeight +
    styles.node.fieldHeight * 3 +
    styles.node.fieldSpacing * 2 +
    styles.node.padding * 2 +
    60;
  const calculatedTotalHeight = totalSections * minSectionHeight;

  // Use the larger of calculated height or available height
  const effectiveHashAreaHeight = Math.max(
    hashAreaHeight,
    calculatedTotalHeight
  );
  const sectionHeight = effectiveHashAreaHeight / totalSections;

  // Position local variables box in the top horizontal section (section 0)
  const localVarBoxX = hashAreaX + 30;
  const localVarBoxY = instanceVarBoxY; // Align top with instance variables box

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
    leftSectionHeight - instanceVarBoxHeight - 40;
  const bucketArrayHeight =
    hashData && hashData.buckets
      ? styles.bucketArray.headerHeight +
        hashData.buckets.length * styles.bucketArray.bucketHeight +
        styles.bucketArray.padding * 2
      : 100;

  // Position buckets array below instance variables, centered horizontally in left section
  const bucketArrayX =
    leftSectionX + (leftSectionWidth - styles.bucketArray.width) / 2;
  const bucketArrayY =
    leftSectionY +
    instanceVarBoxHeight +
    80 + // Increased from 40 to move buckets array further down
    (remainingLeftSectionHeight - bucketArrayHeight) / 2;

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

      // Bucket index (left side)
      bucketArrayGroup
        .append("text")
        .attr("x", bucketArrayX + 15)
        .attr("y", bucketY + styles.bucketArray.bucketHeight / 2 + 4)
        .attr("font-size", styles.bucketArray.fontSize)
        .attr("fill", styles.bucketArray.indexTextFill)
        .text(bucket.index);

      // Bucket value/address (center)
      const bucketValue = bucket.address || "null";
      const displayValue =
        bucketValue === "null" ? "null" : truncateAddress(bucketValue);

      bucketArrayGroup
        .append("text")
        .attr("x", bucketArrayX + styles.bucketArray.width / 2)
        .attr("y", bucketY + styles.bucketArray.bucketHeight / 2 + 4)
        .attr("text-anchor", "middle")
        .attr("font-size", styles.bucketArray.fontSize)
        .attr("fill", bucketValue === "null" ? "#64748b" : "#0ea5e9")
        .text(displayValue);

      // Bucket pointer indicator (right side)
      if (bucket.chain) {
        bucketArrayGroup
          .append("circle")
          .attr("cx", bucketArrayX + styles.bucketArray.width - 15)
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
  const chainedNodeAddresses = new Set(); // Track all nodes that are part of chains

  console.log(`[HashStructure] Processing ${actualBucketCount} buckets`);
  console.log(`[HashStructure] Buckets data:`, bucketsData);

  for (let i = 0; i < actualBucketCount; i++) {
    const bucketAddress = bucketsData[i] || bucketsData[i.toString()];
    console.log(`[HashStructure] Bucket ${i}: address = ${bucketAddress}`);

    const chain = bucketAddress
      ? parseChain(bucketAddress, addressObjectMap)
      : null;

    console.log(`[HashStructure] Bucket ${i}: chain = `, chain);

    // Track all addresses in this chain
    if (chain) {
      chain.forEach((node) => {
        chainedNodeAddresses.add(node.address);
      });
    }

    buckets.push({
      index: i,
      address: bucketAddress,
      chain: chain,
    });
  }

  // Find orphan nodes - nodes that exist in addressObjectMap but are not in any chain
  const orphanNodes = findOrphanNodes(
    addressObjectMap,
    chainedNodeAddresses,
    bucketsAddress
  );

  console.log(`[HashStructure] Final parsed buckets:`, buckets);
  console.log(`[HashStructure] Found orphan nodes:`, orphanNodes);

  return {
    bucketsAddress,
    buckets,
    bucketCount: actualBucketCount,
    orphanNodes,
  };
}

// Helper function to find orphan nodes
function findOrphanNodes(
  addressObjectMap,
  chainedNodeAddresses,
  bucketsAddress
) {
  const orphanNodes = [];

  console.log("[HashStructure] Finding orphan nodes...");
  console.log(
    "[HashStructure] Chained node addresses:",
    Array.from(chainedNodeAddresses)
  );
  console.log("[HashStructure] Buckets address to exclude:", bucketsAddress);

  // Check each address in the addressObjectMap
  for (const [address, nodeData] of Object.entries(addressObjectMap)) {
    // Skip if this is the buckets array itself
    if (address === bucketsAddress) {
      continue;
    }

    // Skip if this address is already part of a chain
    if (chainedNodeAddresses.has(address)) {
      continue;
    }

    // Skip if this doesn't look like a node (e.g., arrays)
    if (Array.isArray(nodeData)) {
      continue;
    }

    // Check if this looks like a hash node (has key/value or similar structure)
    if (nodeData && typeof nodeData === "object") {
      const hasNodeLikeStructure =
        nodeData.hasOwnProperty("key") ||
        nodeData.hasOwnProperty("value") ||
        nodeData.hasOwnProperty("data") ||
        nodeData.hasOwnProperty("linkAddress") ||
        nodeData.hasOwnProperty("nextAddress") ||
        nodeData.hasOwnProperty("next");

      if (hasNodeLikeStructure) {
        console.log(`[HashStructure] Found orphan node: ${address}`, nodeData);
        orphanNodes.push({
          address: address,
          ...nodeData,
        });
      }
    }
  }

  console.log(
    `[HashStructure] Total orphan nodes found: ${orphanNodes.length}`
  );
  return orphanNodes;
}

// Helper function to parse a chain of nodes
function parseChain(startAddress, addressObjectMap) {
  if (!startAddress || !addressObjectMap[startAddress]) {
    console.log(
      `[HashStructure] parseChain: Invalid start address: ${startAddress}`
    );
    return null;
  }

  console.log(
    `[HashStructure] parseChain: Starting chain from ${startAddress}`
  );

  const nodes = [];
  let currentAddress = startAddress;
  const visited = new Set();
  const MAX_CHAIN_LENGTH = 50; // Prevent infinite loops

  while (
    currentAddress &&
    !visited.has(currentAddress) &&
    nodes.length < MAX_CHAIN_LENGTH
  ) {
    visited.add(currentAddress);
    const nodeData = addressObjectMap[currentAddress];

    if (!nodeData) {
      console.log(
        `[HashStructure] parseChain: No data found for address ${currentAddress}`
      );
      break;
    }

    console.log(
      `[HashStructure] parseChain: Processing node ${currentAddress}:`,
      nodeData
    );

    const node = {
      address: currentAddress,
      ...nodeData,
    };

    nodes.push(node);

    // Look for next pointer with multiple possible names (similar to linked structure visualization)
    const nextAddress =
      nodeData.nextAddress ||
      nodeData.next ||
      nodeData.linkAddress ||
      nodeData.link ||
      nodeData.successor ||
      null;

    console.log(
      `[HashStructure] parseChain: Next address for ${currentAddress}: ${nextAddress}`
    );

    // Check if next address is valid
    if (!nextAddress || nextAddress === "0x0" || nextAddress === "null") {
      console.log(
        `[HashStructure] parseChain: End of chain reached at ${currentAddress}`
      );
      break;
    }

    currentAddress = nextAddress;
  }

  console.log(
    `[HashStructure] parseChain: Completed chain with ${nodes.length} nodes:`,
    nodes.map((n) => n.address)
  );
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
  const nodeSpacing = 30; // Reduced from 60 to position nodes closer together

  // Calculate horizontal sections area - use ALL available width and extend even further
  const sectionsStartX = startX;
  const sectionsStartY = startY;

  // Use the full available width plus massive extension to maximize space usage
  // Since we've already compensated for auto-fit scaling, extend much further
  const sectionsAreaWidth = availableWidth + 800; // Increased from 400 to extend massively further
  const sectionsAreaHeight = availableHeight;

  console.log("[HashStructure] Section area calculations:", {
    availableWidth,
    sectionsAreaWidth,
    extension: sectionsAreaWidth - availableWidth,
  });

  // Render orphan nodes in the local variables section (section 0) if they exist
  if (hashData.orphanNodes && hashData.orphanNodes.length > 0) {
    console.log(
      "[HashStructure] Rendering orphan nodes in local variables section..."
    );

    // Calculate position for orphan nodes in section 0 (local variables section)
    const localVarSectionY = sectionsStartY;

    // Position orphan nodes to the right of the local variables box
    // Start after the local variables box with some spacing
    const orphanNodesStartX = sectionsStartX + 400; // Start after local variables box

    // Calculate the actual total node height including all components
    const fieldCount = 3;
    const fieldsAreaHeight =
      fieldCount * styles.node.fieldHeight +
      (fieldCount - 1) * styles.node.fieldSpacing;
    const actualNodeHeight =
      styles.node.headerHeight + styles.node.padding * 2 + fieldsAreaHeight;

    // Center orphan nodes vertically in the local variables section
    const orphanNodesY =
      localVarSectionY + sectionHeight / 2 - actualNodeHeight / 2;

    renderHorizontalChain(
      contentGroup,
      hashData.orphanNodes,
      orphanNodesStartX,
      orphanNodesY,
      nodeWidth,
      nodeSpacing,
      styles,
      nodePositions,
      sectionsAreaWidth
    );

    console.log(
      `[HashStructure] Rendered ${hashData.orphanNodes.length} orphan nodes in local variables section`
    );
  }

  // Render horizontal sections and node chains (buckets array is rendered separately in main layout)
  hashData.buckets.forEach((bucket, index) => {
    // Calculate horizontal section for this bucket (section 0 is for local variables, so buckets start from section 1)
    const bucketSectionIndex = bucket.index + 1;
    const sectionX = sectionsStartX;
    const sectionY = sectionsStartY + bucketSectionIndex * sectionHeight;

    // Render horizontal chain if it exists
    if (bucket.chain) {
      // Calculate the actual total node height including all components
      const fieldCount = 3;
      const fieldsAreaHeight =
        fieldCount * styles.node.fieldHeight +
        (fieldCount - 1) * styles.node.fieldSpacing;
      const actualNodeHeight =
        styles.node.headerHeight + styles.node.padding * 2 + fieldsAreaHeight;

      renderHorizontalChain(
        contentGroup,
        bucket.chain,
        sectionX + 200,
        sectionY + sectionHeight / 2 - actualNodeHeight / 2,
        nodeWidth,
        nodeSpacing,
        styles,
        nodePositions,
        sectionsAreaWidth
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

        // Calculate variable horizontal distance based on bucket index
        // Start with larger distance for top buckets, decrease as we go down
        const baseDistance = 200; // Base distance for bucket 0
        const distanceReduction = 15; // Reduce distance by this amount per bucket
        const minDistance = 20; // Minimum distance to maintain
        const horizontalDistance = Math.max(
          minDistance,
          baseDistance - bucket.index * distanceReduction
        );

        // Create H-V-H path with rounded corners
        const midX = sourceX + horizontalDistance;
        const cornerRadius = 8;

        // Calculate path with rounded corners
        const pathData = `M ${sourceX} ${sourceY} 
                         L ${midX - cornerRadius} ${sourceY} 
                         Q ${midX} ${sourceY} ${midX} ${
          sourceY + (sourceY < targetY ? cornerRadius : -cornerRadius)
        }
                         L ${midX} ${
          targetY + (sourceY < targetY ? -cornerRadius : cornerRadius)
        }
                         Q ${midX} ${targetY} ${midX + cornerRadius} ${targetY}
                         L ${targetX} ${targetY}`;

        contentGroup
          .append("path")
          .attr("d", pathData)
          .attr("fill", "none")
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
  baseNodeSpacing,
  styles,
  nodePositions,
  availableWidth
) {
  console.log(
    `[HashStructure] renderHorizontalChain: Starting with ${chain.length} nodes`
  );
  console.log(
    `[HashStructure] renderHorizontalChain: Chain addresses:`,
    chain.map((n) => n.address)
  );
  console.log(
    `[HashStructure] renderHorizontalChain: Start position: (${startX}, ${startY})`
  );

  // Calculate dynamic spacing to aggressively distribute nodes across available width
  const totalNodesWidth = chain.length * nodeWidth;
  const usableWidth = availableWidth - startX - 20; // Reduced from 50px to only 20px margin on right
  const availableSpacingWidth = usableWidth - totalNodesWidth;

  // Be much more aggressive with spacing - use most of the available space
  const dynamicSpacing =
    chain.length > 1
      ? Math.max(baseNodeSpacing, availableSpacingWidth / (chain.length - 1))
      : baseNodeSpacing;

  // Increase the maximum spacing even more to allow maximum spread
  const maxSpacing = 80; // Reduced from 500 to keep nodes closer together
  const finalSpacing = Math.min(dynamicSpacing, maxSpacing);

  console.log("[HashStructure] Chain spacing calculations:", {
    chainLength: chain.length,
    totalNodesWidth,
    usableWidth,
    availableSpacingWidth,
    dynamicSpacing,
    finalSpacing,
    availableWidth,
  });

  chain.forEach((node, index) => {
    const nodeX = startX + index * (nodeWidth + finalSpacing);
    const nodeY = startY;

    console.log(
      `[HashStructure] renderHorizontalChain: Rendering node ${index} (${node.address}) at position (${nodeX}, ${nodeY})`
    );

    // Create node specification
    const nodeSpec = {
      x: nodeX,
      y: nodeY,
      address: node.address,
      title: node.address,
      fields: {
        key: node.key || node.data || "null",
        value: node.value || "null",
        linkAddress:
          node.linkAddress || node.nextAddress || node.next || "null",
      },
      isCurrent: false,
      isIsolated: false,
    };

    console.log(
      `[HashStructure] renderHorizontalChain: Node spec for ${node.address}:`,
      nodeSpec
    );

    // Render the node
    renderGenericNode(
      contentGroup,
      nodeSpec,
      styles.node,
      nodePositions,
      isAddress,
      truncateAddress
    );

    console.log(
      `[HashStructure] renderHorizontalChain: Node ${node.address} rendered, position stored:`,
      nodePositions[node.address]
    );

    // Draw horizontal connection to next node
    if (index < chain.length - 1) {
      const nextNode = chain[index + 1];
      const nextNodeX = startX + (index + 1) * (nodeWidth + finalSpacing);

      // Calculate connection points similar to linked structure visualization
      // Source: from the linkAddress field of current node
      const sourceX = nodeX + nodeWidth; // Right edge of current node (not inside)
      const sourceY =
        nodeY +
        styles.node.headerHeight +
        styles.node.padding +
        styles.node.fieldHeight * 2 +
        styles.node.fieldSpacing * 2 +
        styles.node.fieldHeight / 2; // Exact middle of linkAddress field (3rd field)

      // Target: to the address tag of next node
      const targetX = nextNodeX; // Left edge of next node
      const targetY = nodeY + styles.node.headerHeight / 2; // Address tag position

      // Create H-V-H path with rounded corners (horizontal-vertical-horizontal)
      const midX = sourceX + (targetX - sourceX) / 2;
      const cornerRadius = 8; // Radius for rounded corners

      // Calculate path with rounded corners
      const pathData = `M ${sourceX} ${sourceY} 
                       L ${midX - cornerRadius} ${sourceY} 
                       Q ${midX} ${sourceY} ${midX} ${
        sourceY + (sourceY < targetY ? cornerRadius : -cornerRadius)
      }
                       L ${midX} ${
        targetY + (sourceY < targetY ? -cornerRadius : cornerRadius)
      }
                       Q ${midX} ${targetY} ${midX + cornerRadius} ${targetY}
                       L ${targetX} ${targetY}`;

      console.log(
        `[HashStructure] renderHorizontalChain: Drawing H-V-H connection from node ${index} to node ${
          index + 1
        }`
      );
      console.log(
        `[HashStructure] renderHorizontalChain: Path from (${sourceX}, ${sourceY}) to (${targetX}, ${targetY})`
      );

      contentGroup
        .append("path")
        .attr("d", pathData)
        .attr("fill", "none")
        .attr("stroke", styles.connection.color)
        .attr("stroke-width", styles.connection.strokeWidth)
        .attr("marker-end", "url(#arrowhead)");
    }
  });

  console.log(
    `[HashStructure] renderHorizontalChain: Completed rendering ${chain.length} nodes`
  );
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
      const targetY = nodePositions["buckets"].y; // Connect to top of buckets array

      // Create simple 5-part path with sharp corners
      const pathData = `M ${sourceX} ${sourceY} 
                       L ${sourceX + 20} ${sourceY}
                       L ${sourceX + 20} ${sourceY + 45}
                       L ${targetX + nodePositions["buckets"].width} ${
        sourceY + 45
      }
                       L ${targetX + nodePositions["buckets"].width - 10} ${
        sourceY + 45
      }
                       L ${
                         targetX + nodePositions["buckets"].width - 10
                       } ${targetY}`;

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
          .attr("stroke", "#2563eb")
          .attr("stroke-width", styles.connection.strokeWidth)
          .attr("marker-end", "url(#arrowhead)");
      }
    });
  }
}

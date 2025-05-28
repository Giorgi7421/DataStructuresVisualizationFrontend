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

  const nodePositions = {};
  const allConnections = [];

  const hashData = parseHashStructure(instanceVariables, addressObjectMap);

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

  defineArrowheads(contentGroup, styles.connection.arrowSize);

  const leftSectionX = 20;
  const leftSectionY = 20;
  const leftSectionWidth = Math.max(
    styles.varBox.width + 40,
    styles.bucketArray.width + 40
  );
  const leftSectionHeight = height - 40;

  const instanceVarBoxX = leftSectionX + 10;
  const instanceVarBoxY = leftSectionY + 10;

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
  } catch (error) {
    console.error(
      "[HashStructure] Error rendering instance variables box:",
      error
    );
    instanceVarBoxResult = { height: 80, connectionPoints: [] };
  }

  const hashAreaY = leftSectionY;
  const hashAreaX = leftSectionX + leftSectionWidth + 30;

  const baseHashAreaWidth = width - hashAreaX - 30;

  const estimatedContentWidth = leftSectionWidth + baseHashAreaWidth;
  const estimatedScale = Math.min((width - 80) / estimatedContentWidth, 1);

  const scalingCompensation = estimatedScale < 1 ? 4.0 / estimatedScale : 3.0;
  const hashAreaWidth = baseHashAreaWidth * scalingCompensation;

  const hashAreaHeight = leftSectionHeight;

  const totalSections =
    hashData && hashData.buckets ? hashData.buckets.length + 1 : 2;

  const minSectionHeight =
    styles.node.headerHeight +
    styles.node.fieldHeight * 3 +
    styles.node.fieldSpacing * 2 +
    styles.node.padding * 2 +
    60;
  const calculatedTotalHeight = totalSections * minSectionHeight;

  const effectiveHashAreaHeight = Math.max(
    hashAreaHeight,
    calculatedTotalHeight
  );
  const sectionHeight = effectiveHashAreaHeight / totalSections;

  const localVarBoxX = hashAreaX + 30;
  const localVarBoxY = instanceVarBoxY;

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
  } catch (error) {
    console.error(
      "[HashStructure] Error rendering local variables box:",
      error
    );
    localVarBoxResult = { height: 80, connectionPoints: [] };
  }

  const instanceVarBoxHeight = instanceVarBoxResult?.height || 80;
  const remainingLeftSectionHeight =
    leftSectionHeight - instanceVarBoxHeight - 40;
  const bucketArrayHeight =
    hashData && hashData.buckets
      ? styles.bucketArray.headerHeight +
        hashData.buckets.length * styles.bucketArray.bucketHeight +
        styles.bucketArray.padding * 2
      : 100;

  const bucketArrayX =
    leftSectionX + (leftSectionWidth - styles.bucketArray.width) / 2;
  const bucketArrayY =
    leftSectionY +
    instanceVarBoxHeight +
    80 +
    (remainingLeftSectionHeight - bucketArrayHeight) / 2;

  if (hashData && hashData.buckets) {
    const bucketArrayGroup = contentGroup
      .append("g")
      .attr("class", "bucket-array");

    bucketArrayGroup
      .append("rect")
      .attr("x", bucketArrayX)
      .attr("y", bucketArrayY)
      .attr("width", styles.bucketArray.width)
      .attr("height", bucketArrayHeight)
      .attr("fill", styles.bucketArray.fill)
      .attr("stroke", styles.bucketArray.stroke)
      .attr("stroke-width", 2);

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

    nodePositions["buckets"] = {
      x: bucketArrayX,
      y: bucketArrayY,
      width: styles.bucketArray.width,
      height: bucketArrayHeight,
    };

    hashData.buckets.forEach((bucket, index) => {
      const bucketY =
        bucketArrayY +
        styles.bucketArray.headerHeight +
        styles.bucketArray.padding +
        index * styles.bucketArray.bucketHeight;

      bucketArrayGroup
        .append("rect")
        .attr("x", bucketArrayX + 5)
        .attr("y", bucketY)
        .attr("width", styles.bucketArray.width - 10)
        .attr("height", styles.bucketArray.bucketHeight - 2)
        .attr("fill", styles.bucketArray.bucketFill)
        .attr("stroke", styles.bucketArray.bucketStroke);

      bucketArrayGroup
        .append("text")
        .attr("x", bucketArrayX + 15)
        .attr("y", bucketY + styles.bucketArray.bucketHeight / 2 + 4)
        .attr("font-size", styles.bucketArray.fontSize)
        .attr("fill", styles.bucketArray.indexTextFill)
        .text(bucket.index);

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

  if (hashData && hashData.buckets) {
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
        nodePositions,
        instanceVarBoxY
      );

      drawVariableConnections(
        contentGroup,
        instanceVarBoxResult,
        localVarBoxResult,
        hashData,
        nodePositions,
        styles
      );
    } catch (error) {
      console.error(
        "[HashStructure] Error during hash structure rendering:",
        error
      );

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

function parseHashStructure(instanceVariables, addressObjectMap) {
  const hashVariableNames = ["buckets", "table", "data", "hashTable", "map"];
  let bucketsAddress = null;
  let bucketCount = 0;

  for (const varName of hashVariableNames) {
    if (instanceVariables[varName] && isAddress(instanceVariables[varName])) {
      bucketsAddress = instanceVariables[varName];
      break;
    }
  }

  const countVariableNames = ["nBuckets", "bucketCount", "capacity", "size"];
  for (const varName of countVariableNames) {
    if (
      instanceVariables[varName] &&
      typeof instanceVariables[varName] === "number"
    ) {
      bucketCount = instanceVariables[varName];
      break;
    }
  }

  if (!bucketsAddress) {
    return null;
  }

  const bucketsData = addressObjectMap[bucketsAddress];
  if (!bucketsData) {
    return null;
  }

  const buckets = [];
  const actualBucketCount = bucketCount || Object.keys(bucketsData).length;
  const chainedNodeAddresses = new Set();

  for (let i = 0; i < actualBucketCount; i++) {
    const bucketAddress = bucketsData[i] || bucketsData[i.toString()];

    const chain = bucketAddress
      ? parseChain(bucketAddress, addressObjectMap)
      : null;

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

  const orphanNodes = findOrphanNodes(
    addressObjectMap,
    chainedNodeAddresses,
    bucketsAddress
  );

  return {
    bucketsAddress,
    buckets,
    bucketCount: actualBucketCount,
    orphanNodes,
  };
}

function findOrphanNodes(
  addressObjectMap,
  chainedNodeAddresses,
  bucketsAddress
) {
  const orphanNodes = [];

  for (const [address, nodeData] of Object.entries(addressObjectMap)) {
    if (address === bucketsAddress) {
      continue;
    }

    if (chainedNodeAddresses.has(address)) {
      continue;
    }

    if (Array.isArray(nodeData)) {
      continue;
    }

    if (nodeData && typeof nodeData === "object") {
      const hasNodeLikeStructure =
        nodeData.hasOwnProperty("key") ||
        nodeData.hasOwnProperty("value") ||
        nodeData.hasOwnProperty("data") ||
        nodeData.hasOwnProperty("linkAddress") ||
        nodeData.hasOwnProperty("nextAddress") ||
        nodeData.hasOwnProperty("next");

      if (hasNodeLikeStructure) {
        orphanNodes.push({
          address: address,
          ...nodeData,
        });
      }
    }
  }

  return orphanNodes;
}

function parseChain(startAddress, addressObjectMap) {
  if (!startAddress || !addressObjectMap[startAddress]) {
    return null;
  }

  const nodes = [];
  let currentAddress = startAddress;
  const visited = new Set();
  const MAX_CHAIN_LENGTH = 50;

  while (
    currentAddress &&
    !visited.has(currentAddress) &&
    nodes.length < MAX_CHAIN_LENGTH
  ) {
    visited.add(currentAddress);
    const nodeData = addressObjectMap[currentAddress];

    if (!nodeData) {
      break;
    }

    const node = {
      address: currentAddress,
      ...nodeData,
    };

    nodes.push(node);

    const nextAddress =
      nodeData.nextAddress ||
      nodeData.next ||
      nodeData.linkAddress ||
      nodeData.link ||
      nodeData.successor ||
      null;

    if (!nextAddress || nextAddress === "0x0" || nextAddress === "null") {
      break;
    }

    currentAddress = nextAddress;
  }
  return nodes.length > 0 ? nodes : null;
}

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
  nodePositions,
  variableBoxY
) {
  const nodeWidth = styles.node.width;
  const nodeSpacing = 60;

  const sectionsStartX = startX;
  const sectionsStartY = startY;

  const sectionsAreaWidth = availableWidth + 800;
  const sectionsAreaHeight = availableHeight;

  if (hashData.orphanNodes && hashData.orphanNodes.length > 0) {
    const localVarSectionY = sectionsStartY;

    const orphanNodesStartX = sectionsStartX + 400;

    const fieldCount = calculateMaxFieldCount(hashData.orphanNodes);
    const fieldsAreaHeight =
      fieldCount * styles.node.fieldHeight +
      (fieldCount - 1) * styles.node.fieldSpacing;
    const actualNodeHeight =
      styles.node.headerHeight + styles.node.padding * 2 + fieldsAreaHeight;

    const orphanNodesY = variableBoxY;

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
  }

  hashData.buckets.forEach((bucket, index) => {
    const bucketSectionIndex = bucket.index + 1;
    const sectionX = sectionsStartX;
    const sectionY = sectionsStartY + bucketSectionIndex * sectionHeight;

    if (bucket.chain) {
      const fieldCount = calculateMaxFieldCount(bucket.chain);
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

      const firstNode = bucket.chain[0];
      if (firstNode && nodePositions[firstNode.address]) {
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

        const baseDistance = 200;
        const distanceReduction = 15;
        const minDistance = 20;
        const horizontalDistance = Math.max(
          minDistance,
          baseDistance - bucket.index * distanceReduction
        );

        const midX = sourceX + horizontalDistance;
        const cornerRadius = 8;

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

function calculateMaxFieldCount(nodes) {
  if (!nodes || nodes.length === 0) {
    return 3;
  }

  let maxFieldCount = 0;
  nodes.forEach((node) => {
    const fields = extractNodeFields(node);
    const fieldCount = Object.keys(fields).length;
    maxFieldCount = Math.max(maxFieldCount, fieldCount);
  });

  return Math.max(maxFieldCount, 3);
}

function extractNodeFields(node) {
  const fields = {};

  const skipFields = ["address"];

  for (const [key, value] of Object.entries(node)) {
    if (!skipFields.includes(key)) {
      fields[key] = value !== null && value !== undefined ? value : "null";
    }
  }

  if (Object.keys(fields).length === 0) {
    fields.data = "null";
  }
  return fields;
}

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
  const totalNodesWidth = chain.length * nodeWidth;
  const usableWidth = availableWidth - startX - 20;
  const availableSpacingWidth = usableWidth - totalNodesWidth;

  const dynamicSpacing =
    chain.length > 1
      ? Math.max(baseNodeSpacing, availableSpacingWidth / (chain.length - 1))
      : baseNodeSpacing;

  const maxSpacing = 170;
  const finalSpacing = Math.min(dynamicSpacing, maxSpacing);

  chain.forEach((node, index) => {
    const nodeX = startX + index * (nodeWidth + finalSpacing);
    const nodeY = startY;

    const nodeSpec = {
      x: nodeX,
      y: nodeY,
      address: node.address,
      title: node.address,
      fields: extractNodeFields(node),
      isCurrent: false,
      isIsolated: false,
    };

    renderGenericNode(
      contentGroup,
      nodeSpec,
      styles.node,
      nodePositions,
      isAddress,
      truncateAddress
    );

    if (index < chain.length - 1) {
      const nextNode = chain[index + 1];
      const nextNodeX = startX + (index + 1) * (nodeWidth + finalSpacing);

      const nodeFields = Object.keys(nodeSpec.fields);
      const nextPointerFields = [
        "linkAddress",
        "nextAddress",
        "next",
        "link",
        "successor",
      ];
      let nextPointerFieldIndex = -1;
      let nextPointerFieldName = null;

      for (const fieldName of nextPointerFields) {
        const fieldIndex = nodeFields.indexOf(fieldName);
        if (fieldIndex !== -1) {
          nextPointerFieldIndex = fieldIndex;
          nextPointerFieldName = fieldName;
          break;
        }
      }

      if (nextPointerFieldIndex === -1 && nodeFields.length > 0) {
        nextPointerFieldIndex = nodeFields.length - 1;
        nextPointerFieldName = nodeFields[nextPointerFieldIndex];
      }

      const sourceX = nodeX + nodeWidth;
      const sourceY =
        nextPointerFieldIndex >= 0
          ? nodeY +
            styles.node.headerHeight +
            styles.node.padding +
            nextPointerFieldIndex *
              (styles.node.fieldHeight + styles.node.fieldSpacing) +
            styles.node.fieldHeight / 2
          : nodeY + styles.node.headerHeight / 2;

      const targetX = nextNodeX;
      const targetY = nodeY + styles.node.headerHeight / 2;

      const midX = sourceX + (targetX - sourceX) / 2;
      const cornerRadius = 8;

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
  });
}

function drawVariableConnections(
  contentGroup,
  instanceVarBoxResult,
  localVarBoxResult,
  hashData,
  nodePositions,
  styles
) {
  if (instanceVarBoxResult?.connectionPoints && nodePositions["buckets"]) {
    const bucketsConnectionPoint = instanceVarBoxResult.connectionPoints.find(
      (cp) =>
        cp.targetAddress === hashData.bucketsAddress || cp.varName === "buckets"
    );

    if (bucketsConnectionPoint && bucketsConnectionPoint.sourceCoords) {
      const sourceX = bucketsConnectionPoint.sourceCoords.x;
      const sourceY = bucketsConnectionPoint.sourceCoords.y;
      const targetX = nodePositions["buckets"].x;
      const targetY = nodePositions["buckets"].y;

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

  if (localVarBoxResult?.connectionPoints) {
    localVarBoxResult.connectionPoints.forEach((connectionPoint) => {
      if (
        connectionPoint.targetAddress &&
        nodePositions[connectionPoint.targetAddress]
      ) {
        const targetPos = nodePositions[connectionPoint.targetAddress];

        const arrowLength = 80;
        const arrowEndX = targetPos.x + targetPos.width;
        const arrowStartX = arrowEndX + arrowLength;
        const arrowY = targetPos.y + styles.node.headerHeight / 2;

        contentGroup
          .append("line")
          .attr("x1", arrowStartX)
          .attr("y1", arrowY)
          .attr("x2", arrowEndX)
          .attr("y2", arrowY)
          .attr("stroke", "#2563eb")
          .attr("stroke-width", 2);

        const arrowheadSize = 5;
        contentGroup
          .append("polygon")
          .attr(
            "points",
            `${arrowEndX},${arrowY} ${arrowEndX + arrowheadSize},${
              arrowY - arrowheadSize / 2
            } ${arrowEndX + arrowheadSize},${arrowY + arrowheadSize / 2}`
          )
          .attr("fill", "#2563eb");

        const textY = arrowY - 8;
        const textX = arrowStartX - arrowLength / 2;

        contentGroup
          .append("text")
          .attr("x", textX)
          .attr("y", textY)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", "bold")
          .attr("fill", "#2563eb")
          .text(connectionPoint.varName);
      } else {
        console.log(
          `[HashStructure] No target node found for address ${connectionPoint.targetAddress}`
        );
      }
    });
  }
}

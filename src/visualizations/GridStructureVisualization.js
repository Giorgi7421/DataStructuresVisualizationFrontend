import {
  defineArrowheads,
  renderVariableBox,
  isAddress,
  truncateAddress,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

export function renderGridStructureVisualization(
  contentGroup,
  width,
  height,
  operation,
  memorySnapshot,
  snapshotIdentifier
) {
  const state = memorySnapshot || operation.state || {};
  const instanceVariables = state.instanceVariables || state || {};
  const addressObjectMap = state.addressObjectMap || {};

  let elemsAddress = null;
  let addresses = [];
  if (
    instanceVariables.elems &&
    typeof instanceVariables.elems === "string" &&
    isAddress(instanceVariables.elems) &&
    Object.prototype.hasOwnProperty.call(
      addressObjectMap,
      instanceVariables.elems
    ) &&
    Array.isArray(addressObjectMap[instanceVariables.elems])
  ) {
    elemsAddress = instanceVariables.elems;
    addresses = addressObjectMap[elemsAddress];
  } else {
    const mapKeys = Object.keys(addressObjectMap);
    const arrayEntries = mapKeys.filter(
      (key) =>
        Object.prototype.hasOwnProperty.call(addressObjectMap, key) &&
        Array.isArray(addressObjectMap[key])
    );
    if (arrayEntries.length === 1) {
      elemsAddress = arrayEntries[0];
      addresses = addressObjectMap[elemsAddress];
    }
  }

  const stylesForCalc = { cell: { height: 40 }, padding: 5 };
  const unreferencedRowSpacing = 5;
  const unreferencedSectionBottomMargin = 15;
  let unreferencedRowsBlockHeight = 0;
  let unreferencedRowAddrs = [];

  if (addressObjectMap) {
    const allPotentialRowArrayAddrs = Object.keys(addressObjectMap).filter(
      (key) => key !== elemsAddress && Array.isArray(addressObjectMap[key])
    );
    const referencedSet = new Set(
      addresses.filter(
        (addr) => addr && typeof addr === "string" && isAddress(addr)
      )
    );
    unreferencedRowAddrs = allPotentialRowArrayAddrs
      .filter((addr) => !referencedSet.has(addr))
      .sort();

    if (unreferencedRowAddrs.length > 0) {
      unreferencedRowsBlockHeight =
        unreferencedRowAddrs.length *
          (stylesForCalc.cell.height + unreferencedRowSpacing) -
        unreferencedRowSpacing +
        unreferencedSectionBottomMargin;
      console.log(
        "[GridViz] Unreferenced rows identified:",
        unreferencedRowAddrs,
        "Block height:",
        unreferencedRowsBlockHeight
      );
    } else {
      console.log("[GridViz] No unreferenced rows identified.");
    }
  }

  const nodePositions = {};
  const allConnections = [];

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
    cell: {
      width: 60,
      height: 40,
      fill: "#ffffff",
      stroke: "#94a3b8",
      textFill: "#334155",
      fontSize: "14px",
    },
    address: {
      width: 80,
      height: 30,
      fill: "#f1f5f9",
      stroke: "#94a3b8",
      textFill: "#0ea5e9",
      fontSize: "12px",
    },
    connection: {
      strokeWidth: 1.5,
      color: "#334155",
      cornerRadius: 8,
      markerId: "array-arrow",
    },
  };

  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles);

  if (defs.select("#array-arrow").empty()) {
    defs
      .append("marker")
      .attr("id", "array-arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 10)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .attr("markerUnits", "strokeWidth")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", styles.connection.color || "#334155");
  }

  const topMargin = 30;
  const varBoxX = 30;
  let mainGridStartY = topMargin + unreferencedRowsBlockHeight;

  const addressesArrayX = varBoxX + styles.varBox.width + 60;
  const addressesArrayY = mainGridStartY + 10;
  const addressBoxX = addressesArrayX;
  const addressBoxY = addressesArrayY - styles.cell.height;

  let varBoxY =
    addressesArrayY +
    styles.cell.height / 2 -
    styles.varBox.headerHeight -
    styles.varBox.fieldHeight / 2;

  if (unreferencedRowAddrs.length > 0) {
    let currentUnreferencedY = topMargin;
    const unreferencedRowAddressBoxX = addressesArrayX + 140 + 120;
    const unreferencedRowDataStartX = unreferencedRowAddressBoxX + 100;

    unreferencedRowAddrs.forEach((unrefAddr) => {
      const rowAddressBoxWidth = 100;

      contentGroup
        .append("rect")
        .attr("x", unreferencedRowAddressBoxX)
        .attr("y", currentUnreferencedY)
        .attr("width", rowAddressBoxWidth)
        .attr("height", styles.cell.height)
        .attr("fill", styles.cell.fill)
        .attr("stroke", styles.cell.stroke)
        .attr("stroke-width", 1)
        .attr("rx", 3);
      contentGroup
        .append("text")
        .attr("x", unreferencedRowAddressBoxX + rowAddressBoxWidth / 2)
        .attr("y", currentUnreferencedY + styles.cell.height / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("font-size", styles.cell.fontSize)
        .attr("font-weight", "bold")
        .attr("fill", styles.varBox.addressValueFill)
        .text(truncateAddress(String(unrefAddr), 10));

      const rowData = addressObjectMap[unrefAddr] || [];
      if (rowData.length > 0) {
        contentGroup
          .append("path")
          .attr(
            "d",
            `M ${unreferencedRowAddressBoxX + rowAddressBoxWidth} ${
              currentUnreferencedY + styles.cell.height / 2
            } L ${unreferencedRowDataStartX} ${
              currentUnreferencedY + styles.cell.height / 2
            }`
          )
          .attr("fill", "none")
          .attr("stroke", styles.connection.color)
          .attr("stroke-width", styles.connection.strokeWidth)
          .attr("marker-end", "url(#array-arrow)");
      }
      rowData.forEach((cellValue, colIdx) => {
        const cellX2 = unreferencedRowDataStartX + colIdx * styles.cell.width;
        const cellGroup2 = contentGroup
          .append("g")
          .attr("transform", `translate(${cellX2}, ${currentUnreferencedY})`);
        cellGroup2
          .append("rect")
          .attr("width", styles.cell.width)
          .attr("height", styles.cell.height)
          .attr("fill", styles.cell.fill)
          .attr("stroke", styles.cell.stroke)
          .attr("stroke-width", 1);
        cellGroup2
          .append("line")
          .attr("x1", 0)
          .attr("y1", 18)
          .attr("x2", styles.cell.width)
          .attr("y2", 18)
          .attr("stroke", styles.cell.stroke)
          .attr("stroke-width", 0.5);
        cellGroup2
          .append("text")
          .attr("x", styles.cell.width / 2)
          .attr("y", 9)
          .attr("dy", ".35em")
          .attr("text-anchor", "middle")
          .attr("fill", "#64748b")
          .style("font-size", "10px")
          .text(colIdx);
        cellGroup2
          .append("text")
          .attr("x", styles.cell.width / 2)
          .attr("y", 18 + (styles.cell.height - 18) / 2)
          .attr("dy", ".35em")
          .attr("text-anchor", "middle")
          .attr("fill", styles.cell.textFill)
          .style("font-size", styles.cell.fontSize)
          .text(truncateAddress(String(cellValue), 10));
      });
      currentUnreferencedY += styles.cell.height + 5;
    });
  }

  const instanceVarBoxResult = renderVariableBox(
    contentGroup,
    "Instance Variables",
    instanceVariables,
    varBoxX,
    varBoxY,
    styles.varBox,
    "instance",
    isAddress
  );

  if (instanceVarBoxResult && instanceVarBoxResult.connectionPoints) {
  }

  const localVariables = state.localVariables || {};
  if (Object.keys(localVariables).length > 0) {
    const addressesArrayHeight = addresses.length * styles.cell.height;
    const localVarsX = addressesArrayX;
    const localVarsY = addressesArrayY + addressesArrayHeight + 40;
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
    if (localVarsResult && localVarsResult.connectionPoints) {
      allConnections.push(...localVarsResult.connectionPoints);
    }
  }

  if (elemsAddress && instanceVarBoxResult.connectionPoints) {
    const elemsConnectionPoint = instanceVarBoxResult.connectionPoints.find(
      (p) => p.sourceName.endsWith("-elems")
    );
    if (elemsConnectionPoint && elemsConnectionPoint.sourceCoords) {
      const startX = elemsConnectionPoint.sourceCoords.x;
      const startY = elemsConnectionPoint.sourceCoords.y;

      const endTargetX = addressBoxX;
      const endTargetY = addressBoxY + styles.cell.height / 2;

      const path = generateOrthogonalPath(
        { x: startX, y: startY },
        { x: endTargetX, y: endTargetY },
        styles.connection.cornerRadius,
        "H-V-H",
        15,
        null
      );
      contentGroup
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", styles.connection.color)
        .attr("stroke-width", styles.connection.strokeWidth)
        .attr("marker-end", `url(#${styles.connection.markerId})`);
    } else {
      const instanceVarKeys = Object.keys(instanceVariables);
      const fieldIndex = instanceVarKeys.indexOf("elems");
      if (
        fieldIndex !== -1 &&
        Object.prototype.hasOwnProperty.call(instanceVariables, "elems")
      ) {
        const startXfb = varBoxX + styles.varBox.width;
        const startYfb =
          varBoxY +
          styles.varBox.headerHeight +
          styles.varBox.padding +
          fieldIndex *
            (styles.varBox.fieldHeight + styles.varBox.fieldSpacing) +
          styles.varBox.fieldHeight / 2;

        const endXfb = addressBoxX;
        const endYfb = addressBoxY + styles.cell.height / 2;
        contentGroup
          .append("path")
          .attr("d", `M ${startXfb} ${startYfb} L ${endXfb} ${endYfb}`)
          .attr("fill", "none")
          .attr("stroke", styles.connection.color)
          .attr("stroke-width", styles.connection.strokeWidth)
          .attr("marker-end", `url(#${styles.connection.markerId})`);
      }
    }
  }

  const addressCellWidth = 140;
  addresses.forEach((rowAddress, idx) => {
    const cellX = addressesArrayX;
    const cellY = addressesArrayY + idx * styles.cell.height;
    const cellGroup = contentGroup
      .append("g")
      .attr("transform", `translate(${cellX}, ${cellY})`);
    cellGroup
      .append("rect")
      .attr("width", addressCellWidth)
      .attr("height", styles.cell.height)
      .attr("fill", styles.cell.fill)
      .attr("stroke", styles.cell.stroke)
      .attr("stroke-width", 1);

    cellGroup
      .append("line")
      .attr("x1", 0)
      .attr("y1", 18)
      .attr("x2", addressCellWidth)
      .attr("y2", 18)
      .attr("stroke", styles.cell.stroke)
      .attr("stroke-width", 0.5);

    cellGroup
      .append("text")
      .attr("x", addressCellWidth / 2)
      .attr("y", 9)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .style("font-size", "10px")
      .text(idx);

    cellGroup
      .append("text")
      .attr("x", addressCellWidth / 2)
      .attr("y", 18 + (styles.cell.height - 18) / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", styles.cell.textFill)
      .style("font-size", styles.cell.fontSize)
      .text(truncateAddress(String(rowAddress), 10));

    nodePositions[rowAddress] = {
      x: cellX,
      y: cellY,
      width: addressCellWidth,
      height: styles.cell.height,
    };

    const gap = 120;
    const rowAddressBoxWidth = 100;
    const rowAddressBoxX = addressesArrayX + addressCellWidth + gap;
    const rowStartX = rowAddressBoxX + rowAddressBoxWidth;
    const rowStartY = cellY;

    contentGroup
      .append("rect")
      .attr("x", rowAddressBoxX)
      .attr("y", rowStartY)
      .attr("width", rowAddressBoxWidth)
      .attr("height", styles.cell.height)
      .attr("fill", styles.cell.fill)
      .attr("stroke", styles.cell.stroke)
      .attr("stroke-width", 1)
      .attr("rx", 3);
    contentGroup
      .append("text")
      .attr("x", rowAddressBoxX + rowAddressBoxWidth / 2)
      .attr("y", rowStartY + styles.cell.height / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("font-size", styles.cell.fontSize)
      .attr("font-weight", "bold")
      .attr("fill", styles.varBox.addressValueFill)
      .text(truncateAddress(String(rowAddress), 10));

    const path = generateOrthogonalPath(
      {
        x: cellX + addressCellWidth,
        y: cellY + styles.cell.height / 2,
      },
      {
        x: rowAddressBoxX,
        y: rowStartY + styles.cell.height / 2,
      },
      styles.connection.cornerRadius,
      "H-V",
      20,
      null
    );
    contentGroup
      .append("path")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", styles.connection.color)
      .attr("stroke-width", styles.connection.strokeWidth)
      .attr("marker-end", "url(#array-arrow)");

    if (
      addressObjectMap[rowAddress] &&
      addressObjectMap[rowAddress].length > 0
    ) {
      const start = {
        x: rowAddressBoxX + rowAddressBoxWidth,
        y: rowStartY + styles.cell.height / 2,
      };
      const end = {
        x: rowStartX + 6,
        y: rowStartY + styles.cell.height / 2,
      };
      console.log("Row connection path:", { start, end });
      contentGroup
        .append("path")
        .attr(
          "d",
          generateOrthogonalPath(
            start,
            end,
            styles.connection.cornerRadius,
            "H-V",
            10,
            null
          )
        )
        .attr("fill", "none")
        .attr("stroke", styles.connection.color)
        .attr("stroke-width", styles.connection.strokeWidth);
    }

    const rowData = addressObjectMap[rowAddress] || [];
    rowData.forEach((cellValue, colIdx) => {
      const cellX2 = rowStartX + colIdx * styles.cell.width;
      const cellY2 = rowStartY;
      const cellGroup2 = contentGroup
        .append("g")
        .attr("transform", `translate(${cellX2}, ${cellY2})`);
      cellGroup2
        .append("rect")
        .attr("width", styles.cell.width)
        .attr("height", styles.cell.height)
        .attr("fill", styles.cell.fill)
        .attr("stroke", styles.cell.stroke)
        .attr("stroke-width", 1);
      cellGroup2
        .append("line")
        .attr("x1", 0)
        .attr("y1", 18)
        .attr("x2", styles.cell.width)
        .attr("y2", 18)
        .attr("stroke", styles.cell.stroke)
        .attr("stroke-width", 0.5);
      cellGroup2
        .append("text")
        .attr("x", styles.cell.width / 2)
        .attr("y", 9)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", "#64748b")
        .style("font-size", "10px")
        .text(colIdx);
      cellGroup2
        .append("text")
        .attr("x", styles.cell.width / 2)
        .attr("y", 18 + (styles.cell.height - 18) / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", styles.cell.textFill)
        .style("font-size", styles.cell.fontSize)
        .text(truncateAddress(String(cellValue), 10));
    });

    nodePositions[rowAddress] = {
      x: rowAddressBoxX,
      y: rowStartY,
      width: rowAddressBoxWidth,
      height: styles.cell.height,
    };
  });

  if (addresses.length > 0 && elemsAddress) {
    const addressBoxX = addressesArrayX;
    const addressBoxY = addressesArrayY - styles.cell.height;

    contentGroup
      .append("rect")
      .attr("x", addressBoxX)
      .attr("y", addressBoxY)
      .attr("width", addressCellWidth)
      .attr("height", styles.cell.height)
      .attr("fill", styles.cell.fill)
      .attr("stroke", styles.cell.stroke)
      .attr("stroke-width", 1)
      .attr("rx", 3);

    contentGroup
      .append("text")
      .attr("x", addressBoxX + addressCellWidth / 2)
      .attr("y", addressBoxY + styles.cell.height / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("font-size", styles.cell.fontSize)
      .attr("font-weight", "bold")
      .attr("fill", styles.varBox.addressValueFill)
      .text(truncateAddress(String(elemsAddress), 10));

    contentGroup
      .append("path")
      .attr(
        "d",
        generateOrthogonalPath(
          {
            x: addressBoxX + addressCellWidth / 2,
            y: addressBoxY + styles.cell.height,
          },
          {
            x: addressesArrayX + addressCellWidth / 2,
            y: addressesArrayY,
          },
          styles.connection.cornerRadius,
          "V-H",
          10,
          null
        )
      )
      .attr("fill", "none")
      .attr("stroke", styles.connection.color)
      .attr("stroke-width", styles.connection.strokeWidth);
  }

  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-from-local-vars");
  allConnections.forEach((conn) => {
    if (!conn.sourceCoords || !conn.targetAddress) {
      console.warn("[GridViz] Connection missing source/target info:", conn);
      return;
    }

    const sourcePoint = conn.sourceCoords;
    const targetData = nodePositions[conn.targetAddress];

    if (!targetData) {
      console.warn(
        `[GridViz] Target for connection not found in nodePositions: ${conn.targetAddress}`
      );
      return;
    }

    const targetPoint = {
      x:
        sourcePoint.x < targetData.x + targetData.width / 2
          ? targetData.x
          : targetData.x + targetData.width,
      y: targetData.y + targetData.height / 2,
    };

    const markerId = styles.connection.markerId;
    const color = styles.connection.color;
    const strokeWidth = styles.connection.strokeWidth;
    const cornerRadius = styles.connection.cornerRadius;

    const deltaXOverallMid = Math.abs(targetPoint.x - sourcePoint.x);
    const deltaYOverallMid = Math.abs(targetPoint.y - sourcePoint.y);

    let initialOffset;
    const xDistForOffset = deltaXOverallMid / 2 - cornerRadius * 2;
    const yDistForOffset = deltaYOverallMid * 0.4;
    initialOffset = Math.max(5, Math.min(30, xDistForOffset, yDistForOffset));
    if (isNaN(initialOffset) || initialOffset < 5) initialOffset = 15;

    const path = generateOrthogonalPath(
      sourcePoint,
      targetPoint,
      cornerRadius,
      "H-V-H",
      initialOffset,
      null
    );

    if (path) {
      connectionsGroup
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", strokeWidth)
        .attr("marker-end", markerId ? `url(#${markerId})` : null);
    } else {
      console.warn("[GridViz] Could not generate path for connection:", conn);
    }
  });
}

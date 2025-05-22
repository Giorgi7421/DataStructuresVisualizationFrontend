import {
  defineArrowheads,
  renderVariableBox,
  isAddress,
  truncateAddress,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

import { defaultVisualizationStyles } from "../utils/visualizationUtils";

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

  // Initialize nodePositions and allConnections
  const nodePositions = {};
  const allConnections = [];

  // Styles (similar to array visualization)
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

  // Define arrowheads
  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles);
  // Explicitly define the array-arrow marker
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

  let addresses = [];
  const elemsAddress = instanceVariables.elems;
  if (elemsAddress && addressObjectMap[elemsAddress]) {
    addresses = addressObjectMap[elemsAddress];
  }

  // 1. Render 'elems' variable box
  const varBoxX = 30;
  let varBoxY = 30;
  const addressesArrayX = varBoxX + styles.varBox.width + 60;
  const addressesArrayY = varBoxY + 10;
  const addressBoxX = addressesArrayX;
  const addressBoxY = addressesArrayY - styles.cell.height;
  varBoxY =
    addressesArrayY +
    styles.cell.height / 2 -
    styles.varBox.headerHeight -
    styles.varBox.fieldHeight / 2;

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
  // Collect connections from instance variables if any (though elems is handled separately below)
  if (instanceVarBoxResult && instanceVarBoxResult.connectionPoints) {
    // Filter out the elems connection if we are drawing it manually, or ensure it's styled distinctly
    // For now, let's assume renderVariableBox doesn't draw for 'elems' if we handle it manually.
    // Or, if it does, this new logic will draw ON TOP OF IT or DUPLICATE it for local vars.
    // We are primarily interested in local var connections here.
  }

  // Render local variable box below addresses array
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

  // Arrow from 'elems' field in Instance Variables to the start of addresses array (main elems pointer)
  if (elemsAddress && instanceVarBoxResult.connectionPoints) {
    const elemsConnectionPoint = instanceVarBoxResult.connectionPoints.find(
      (p) => p.sourceName.endsWith("-elems")
    );
    if (elemsConnectionPoint && elemsConnectionPoint.sourceCoords) {
      const startX = elemsConnectionPoint.sourceCoords.x;
      const startY = elemsConnectionPoint.sourceCoords.y;

      // Target the middle of the left side of the addressBox above the vertical addresses array
      const endTargetX = addressBoxX; // Target left edge
      const endTargetY = addressBoxY + styles.cell.height / 2; // Target vertical middle

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
      // Fallback logic (can be kept or removed if the above is reliable)
      const instanceVarKeys = Object.keys(instanceVariables);
      const fieldIndex = instanceVarKeys.indexOf("elems");
      if (fieldIndex !== -1 && Object.prototype.hasOwnProperty.call(instanceVariables, 'elems')) {
        const startXfb = varBoxX + styles.varBox.width;
        const startYfb =
          varBoxY +
          styles.varBox.headerHeight +
          styles.varBox.padding +
          fieldIndex *
            (styles.varBox.fieldHeight + styles.varBox.fieldSpacing) +
          styles.varBox.fieldHeight / 2;
        // Fallback still targets old way, consider updating if this path is taken often
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
    // Draw index partition line (like in array viz)
    cellGroup
      .append("line")
      .attr("x1", 0)
      .attr("y1", 18)
      .attr("x2", addressCellWidth)
      .attr("y2", 18)
      .attr("stroke", styles.cell.stroke)
      .attr("stroke-width", 0.5);
    // Index
    cellGroup
      .append("text")
      .attr("x", addressCellWidth / 2)
      .attr("y", 9)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .style("font-size", "10px")
      .text(idx);
    // Address value
    cellGroup
      .append("text")
      .attr("x", addressCellWidth / 2)
      .attr("y", 18 + (styles.cell.height - 18) / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", styles.cell.textFill)
      .style("font-size", styles.cell.fontSize)
      .text(truncateAddress(String(rowAddress), 10));

    // Store position of this row's address box
    nodePositions[rowAddress] = {
      x: cellX,
      y: cellY,
      width: addressCellWidth,
      height: styles.cell.height,
    };

    // Offset row arrays and address boxes to the right of the addresses array
    const gap = 120;
    const rowAddressBoxWidth = 100;
    const rowAddressBoxX = addressesArrayX + addressCellWidth + gap;
    const rowStartX = rowAddressBoxX + rowAddressBoxWidth;
    const rowStartY = cellY;
    // Add address box to the left of the row array (wider)
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
    // Draw arrow from address cell to row address box (horizontal)
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

    // Draw horizontal arrow from right center of row address box to left center of first cell in row array
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

    // Render the row array horizontally
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

    // Store position of the ACTUAL ROW TAG (rowAddressBox)
    nodePositions[rowAddress] = {
      x: rowAddressBoxX,
      y: rowStartY,
      width: rowAddressBoxWidth,
      height: styles.cell.height,
    };
  });

  // Add address box above the addresses array (for elemsAddress)
  if (addresses.length > 0 && elemsAddress) {
    const addressBoxX = addressesArrayX;
    const addressBoxY = addressesArrayY - styles.cell.height; // flush with addresses array
    // Draw the box
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
    // Draw the address value
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
    // Draw vertical arrow from address box to first cell of addresses array
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

  // --- ARROW DRAWING LOGIC (NEW SECTION) ---
  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-from-local-vars");
  allConnections.forEach((conn) => {
    if (!conn.sourceCoords || !conn.targetAddress) {
      console.warn("[GridViz] Connection missing source/target info:", conn);
      return;
    }

    const sourcePoint = conn.sourceCoords;
    const targetData = nodePositions[conn.targetAddress]; // Target is a row's address box

    if (!targetData) {
      console.warn(
        `[GridViz] Target for connection not found in nodePositions: ${conn.targetAddress}`
      );
      return;
    }

    // Determine targetPoint on the edge of the targetData bounding box
    const targetPoint = {
      x:
        sourcePoint.x < targetData.x + targetData.width / 2
          ? targetData.x
          : targetData.x + targetData.width,
      y: targetData.y + targetData.height / 2,
    };

    const markerId = styles.connection.markerId; // "array-arrow"
    const color = styles.connection.color;
    const strokeWidth = styles.connection.strokeWidth;
    const cornerRadius = styles.connection.cornerRadius;

    const deltaXOverallMid = Math.abs(targetPoint.x - sourcePoint.x);
    const deltaYOverallMid = Math.abs(targetPoint.y - sourcePoint.y);

    let initialOffset;
    const xDistForOffset = deltaXOverallMid / 2 - cornerRadius * 2;
    const yDistForOffset = deltaYOverallMid * 0.4;
    initialOffset = Math.max(5, Math.min(30, xDistForOffset, yDistForOffset));
    if (isNaN(initialOffset) || initialOffset < 5) initialOffset = 15; // Fallback

    const path = generateOrthogonalPath(
      sourcePoint,
      targetPoint,
      cornerRadius,
      "H-V-H", // Force H-V-H path style
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

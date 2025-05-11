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
  // Use memorySnapshot or operation.state
  const state = memorySnapshot || operation.state || {};
  const instanceVariables = state.instanceVariables || state || {};
  const addressObjectMap = state.addressObjectMap || {};

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
      markerId: "grid-arrow",
    },
  };

  // Define arrowheads
  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles);

  // 1. Render 'elems' variable box
  const elemsAddress = instanceVariables.elems;
  const varBoxX = 30;
  const varBoxY = 30;
  renderVariableBox(
    contentGroup,
    "Instance Variables",
    { elems: elemsAddress },
    varBoxX,
    varBoxY,
    styles.varBox,
    "instance",
    isAddress
  );

  // 2. Render the addresses array as a vertical array (like array visualization, but vertical)
  let addresses = [];
  if (elemsAddress && addressObjectMap[elemsAddress]) {
    addresses = addressObjectMap[elemsAddress];
  }
  const addressesArrayX = varBoxX + styles.varBox.width + 60;
  const addressesArrayY = varBoxY + 10; // align with varBox
  const cellSpacingY = 0;

  // Draw arrow from 'elems' to addresses array (vertical)
  if (elemsAddress) {
    const path = generateOrthogonalPath(
      {
        x: varBoxX + styles.varBox.width,
        y: varBoxY + styles.varBox.headerHeight + styles.varBox.fieldHeight / 2,
      },
      {
        x: addressesArrayX,
        y: addressesArrayY + styles.cell.height / 2,
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
      .attr("marker-end", `url(#${styles.connection.markerId})`);
  }

  // Render addresses array as vertical array
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

    // Offset row arrays and address boxes to the right of the addresses array
    const gap = 40;
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
      .attr("marker-end", `url(#${styles.connection.markerId})`);
    // Draw horizontal arrow from right center of row address box to left center of first cell in row array
    if (
      addressObjectMap[rowAddress] &&
      addressObjectMap[rowAddress].length > 0
    ) {
      contentGroup
        .append("path")
        .attr(
          "d",
          generateOrthogonalPath(
            {
              x: rowAddressBoxX + rowAddressBoxWidth,
              y: rowStartY + styles.cell.height / 2,
            },
            {
              x: rowStartX,
              y: rowStartY + styles.cell.height / 2,
            },
            styles.connection.cornerRadius,
            "H-V",
            10,
            null
          )
        )
        .attr("fill", "none")
        .attr("stroke", styles.connection.color)
        .attr("stroke-width", styles.connection.strokeWidth)
        .attr("marker-end", `url(#${styles.connection.markerId})`);
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
  });

  // Add address box above the addresses array (like in array visualization)
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
      .attr("stroke-width", styles.connection.strokeWidth)
      .attr("marker-end", `url(#${styles.connection.markerId})`);
  }
}

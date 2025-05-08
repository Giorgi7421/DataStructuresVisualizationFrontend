import {
  defineArrowheads,
  renderVariableBox,
  renderGenericNode,
  isAddress,
  truncateAddress,
  // Add any other utilities needed from visualizationUtils
} from "../utils/visualizationUtils";

export const renderArrayVectorVisualization = (
  contentGroup,
  width,
  height,
  operation,
  memorySnapshot
) => {
  console.log(
    "TOP OF renderArrayVectorVisualization. Op:", // Renamed Log
    operation,
    "Snap:",
    memorySnapshot
  );

  const state = memorySnapshot || operation.state || {}; // Prioritize snapshot
  const localVariables = state.localVariables || {};
  const instanceVariables = state.instanceVariables || {};
  const addressObjectMap = state.addressObjectMap || {};

  // Define styles for array visualization
  const styles = {
    varBox: {
      width: 200,
      headerHeight: 25,
      fieldHeight: 25,
      fieldSpacing: 5,
      padding: 10,
      fill: "#ffffff",
      stroke: "#cbd5e1",
      titleFill: "#cbd5e1",
      titleFillOpacity: 0.3,
      titleStroke: "#cbd5e1",
      textFill: "#475569",
      valueTextFill: "#475569",
      addressValueFill: "#2563eb",
      fieldRectFill: "white",
      fieldRectStroke: "#e2e8f0",
      fontSize: "12px",
      titleFontSize: "13px",
    },
    arrayCell: {
      width: 60,
      height: 40,
      fill: "#f1f5f9",
      stroke: "#94a3b8",
      textFill: "#1e293b",
      indexTextFill: "#64748b",
      fontSize: "14px",
      indexFontSize: "10px",
      spacing: 5,
    },
    connection: {
      strokeWidth: 1.5,
      defaultColor: "#64748b",
      cornerRadius: 5,
      markerId: "array-pointer-arrow",
    },
    layout: {
      varBoxSpacingY: 20,
      arrayTopMargin: 30,
      elementsPerRow: 10, // Max elements before wrapping (for large arrays)
      rowSpacingY: 20, // Vertical spacing between rows of array elements
    },
  };

  // Define Arrowheads
  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles); // You might need a specific arrowhead for arrays

  const nodePositions = {}; // To store positions of variable boxes if needed
  const allConnections = []; // To store connection details

  const firstColX = 30;
  const varBoxTopMargin = styles.layout.arrayTopMargin || 30;

  // 1. Render Instance Variables (if any)
  let instanceVarsBoxHeight = 0;
  let currentY = varBoxTopMargin;
  if (Object.keys(instanceVariables).length > 0) {
    const instanceVarsX = firstColX;
    const instanceVarsResult = renderVariableBox(
      contentGroup,
      "Instance Variables",
      instanceVariables,
      instanceVarsX,
      currentY,
      styles.varBox,
      "instance-array",
      isAddress
    );
    allConnections.push(...instanceVarsResult.connectionPoints);
    instanceVarsBoxHeight = instanceVarsResult.height;
    nodePositions["instance_vars_box"] = {
      x: instanceVarsX,
      y: currentY,
      width: styles.varBox.width,
      height: instanceVarsBoxHeight,
    };
    currentY += instanceVarsBoxHeight + (styles.layout.varBoxSpacingY || 20);
  }

  // 2. Render the Array/Vector itself
  const arrayDataAddress = instanceVariables?.array || instanceVariables?.data; // Common names
  const size = instanceVariables?.size || instanceVariables?.count || 0;
  let actualArrayData = [];

  if (
    arrayDataAddress &&
    addressObjectMap &&
    addressObjectMap[arrayDataAddress]
  ) {
    actualArrayData = addressObjectMap[arrayDataAddress];
    if (!Array.isArray(actualArrayData)) {
      console.warn(
        "ArrayVectorVisualization: Expected array data at address but found:", // Renamed Log
        actualArrayData
      );
      actualArrayData = []; // Treat as empty if not an array
    }
  } else {
    // Sometimes the array might be directly in instanceVariables (e.g. for simple arrays)
    if (Array.isArray(instanceVariables?.array)) {
      actualArrayData = instanceVariables.array;
    } else if (Array.isArray(instanceVariables?.data)) {
      actualArrayData = instanceVariables.data;
    }
    // console.log("ArrayVectorVisualization: No array found at address, or addressObjectMap missing."); // Renamed Log (if uncommented)
  }

  const displayableArray = actualArrayData.slice(0, size);
  const cellWidth = styles.arrayCell.width;
  const cellHeight = styles.arrayCell.height;
  const cellSpacing = styles.arrayCell.spacing;
  const elementsPerRow = styles.layout.elementsPerRow || 10;
  const rowSpacingY = styles.layout.rowSpacingY || 20;

  let arrayStartX = firstColX;
  if (
    Object.keys(instanceVariables).length > 0 &&
    (instanceVariables.array || instanceVariables.data)
  ) {
    // If instance vars box is rendered and it contains the array pointer, start array to its right
    arrayStartX = firstColX + styles.varBox.width + 40;
  } else if (Object.keys(instanceVariables).length > 0) {
    // If instance vars are present but don't include the array, start array below them
    // currentY is already updated past instance vars box
  } else {
    // No instance vars, array starts near top
    // currentY is varBoxTopMargin
  }

  displayableArray.forEach((value, index) => {
    const rowIndex = Math.floor(index / elementsPerRow);
    const colIndex = index % elementsPerRow;

    const x = arrayStartX + colIndex * (cellWidth + cellSpacing);
    const y = currentY + rowIndex * (cellHeight + rowSpacingY);

    const cellGroup = contentGroup
      .append("g")
      .attr("transform", `translate(${x}, ${y})`);

    cellGroup
      .append("rect")
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("fill", styles.arrayCell.fill)
      .attr("stroke", styles.arrayCell.stroke)
      .attr("stroke-width", 1);

    cellGroup
      .append("text")
      .attr("x", cellWidth / 2)
      .attr("y", cellHeight / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", styles.arrayCell.textFill)
      .style("font-size", styles.arrayCell.fontSize)
      .text(truncateAddress(String(value), 8)); // Truncate long values

    // Render index label below the cell
    cellGroup
      .append("text")
      .attr("x", cellWidth / 2)
      .attr("y", cellHeight + 12) // Position below cell
      .attr("text-anchor", "middle")
      .attr("fill", styles.arrayCell.indexTextFill)
      .style("font-size", styles.arrayCell.indexFontSize)
      .text(`[${index}]`);

    nodePositions[`array_cell_${index}`] = {
      x,
      y,
      width: cellWidth,
      height: cellHeight,
      address: `array_cell_${index}`,
    };
  });

  let arrayTotalHeight = 0;
  if (displayableArray.length > 0) {
    const numRows = Math.ceil(displayableArray.length / elementsPerRow);
    arrayTotalHeight =
      numRows * cellHeight +
      (numRows - 1) * rowSpacingY +
      (styles.arrayCell.indexFontSize + 15); // Add space for index labels
  }
  currentY += arrayTotalHeight;

  // 3. Render Local Variables (if any), below the array
  if (Object.keys(localVariables).length > 0) {
    currentY += styles.layout.varBoxSpacingY || 20; // Add spacing before local vars
    const localVarsX = firstColX;
    const localVarsResult = renderVariableBox(
      contentGroup,
      "Local Variables",
      localVariables,
      localVarsX,
      currentY,
      styles.varBox,
      "local-array",
      isAddress
    );
    allConnections.push(...localVarsResult.connectionPoints);
    nodePositions["local_vars_box"] = {
      x: localVarsX,
      y: currentY,
      width: styles.varBox.width,
      height: localVarsResult.height,
    };
    currentY += localVarsResult.height;
  }

  // 4. Render Connections (if any - e.g. pointers from var boxes to array cells if addresses match)
  // This part is complex and depends on how addresses are represented and if cells have addresses.
  // For now, it's a placeholder.
  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");

  allConnections.forEach((conn) => {
    // Example: if conn.targetAddress matches an array cell's effective address
    // const sourcePos = nodePositions[conn.sourceName]; // This is from renderVariableBox
    // const targetPos = nodePositions[conn.targetAddress]; // This needs to be mapped to array cells
    // if (sourcePos && targetPos) { ... draw path ... }
    console.log("Processing connection for ArrayVector Viz:", conn); // Renamed Log
  });

  console.log(
    "Finished ArrayVectorVisualization render. Node Positions:", // Renamed Log
    nodePositions
  );
  // Placeholder: Auto-fit or center the visualization if needed
  // autoFitVisualization(svg, contentGroup, zoomBehavior, width, height);
};

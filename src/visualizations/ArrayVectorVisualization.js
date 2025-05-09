import {
  defineArrowheads,
  renderVariableBox,
  renderGenericNode,
  isAddress,
  truncateAddress,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

// Import default styles to reference colors/etc.
import { defaultVisualizationStyles } from "../utils/visualizationUtils";

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
      // Borrowing from defaultVisualizationStyles.varBox
      width: 200, // Keep slightly narrower
      headerHeight: 25,
      fieldHeight: 25,
      fieldSpacing: 5,
      padding: 10,
      fill: "#ffffff",
      stroke: "#94a3b8", // slate-400
      titleFill: "#94a3b8",
      titleFillOpacity: 0.3,
      titleStroke: "#94a3b8",
      textFill: "#334155", // slate-700
      valueTextFill: "#334155",
      addressValueFill: "#0ea5e9", // sky-500
      fieldRectFill: "white",
      fieldRectStroke: "#e2e8f0", // slate-200
      fontSize: "12px",
      titleFontSize: "13px",
    },
    arrayCell: {
      width: 80, // Reduced width
      height: 50, // Increased height
      fill: "#ffffff", // White fill like nodes
      stroke: "#94a3b8", // Slate stroke like nodes
      textFill: "#334155", // Dark text like node values
      indexTextFill: "#64748b", // Slate-500 for indices
      fontSize: "14px",
      indexFontSize: "10px",
      indexPartitionHeight: 18, // Adjusted for new height
      spacing: 0, // <<< SET TO 0
    },
    connection: {
      // Borrowing from defaultVisualizationStyles.connection
      strokeWidth: 1.5,
      instanceVarColor: "#334155", // Dark gray for instance vars
      defaultColor: "#64748b", // Slate fallback
      cornerRadius: 8, // Consistent corner radius
      // Use a specific marker ID that defineArrowheads WILL create based on instanceVarColor
      llInstanceVarMarkerId: "array-instance-var-arrow",
    },
    layout: {
      // Borrowing from defaultVisualizationStyles.layout
      nodeSpacingX: 60,
      varBoxSpacingY: 20,
      nodesStartXOffset: 60,
      layerSpacingY: 120,
      // Array specific layout
      arrayTopMargin: 30,
      elementsPerRow: 10,
      rowSpacingY: 20,
    },
  };

  // Define Arrowheads
  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles); // You might need a specific arrowhead for arrays

  // --- Layout Initialization ---
  const nodePositions = {};
  const allConnections = [];
  let intermediateBoxPos = null; // <<< Declare variable early

  const firstColX = 30;
  const varBoxTopMargin = styles.layout.arrayTopMargin || 30;

  // --- 1. Render Instance Variables ---
  let instanceVarsBoxHeight = 0;
  let currentY = varBoxTopMargin;

  if (Object.keys(instanceVariables).length > 0) {
    const instanceVarsX = firstColX;
    // Destructure height and connectionPoints
    const instanceVarsResult = renderVariableBox(
      contentGroup,
      "Instance Variables",
      instanceVariables,
      instanceVarsX,
      currentY,
      styles.varBox,
      "instance", // Simple prefix
      isAddress
    );
    // Add type to connections
    allConnections.push(...instanceVarsResult.connectionPoints);
    instanceVarsBoxHeight = instanceVarsResult.height;

    nodePositions["instance_vars_box"] = {
      x: instanceVarsX,
      y: currentY,
      width: styles.varBox.width,
      height: instanceVarsBoxHeight,
    };
    // Update currentY AFTER rendering the box + spacing
    currentY += instanceVarsBoxHeight + styles.layout.varBoxSpacingY;
  }

  // --- Prepare data needed for intermediate box & array ---
  const arrayVarKey = Object.keys(instanceVariables).find(
    (key) => key === "array" || key === "data"
  );
  const arrayDataAddress = arrayVarKey ? instanceVariables[arrayVarKey] : null;
  const arrayVarConnection = allConnections.find(
    (c) => c.varName === arrayVarKey && c.sourceName.startsWith("instance-")
  );
  const arrayVarSourceCoords = arrayVarConnection
    ? arrayVarConnection.sourceCoords
    : null;

  // --- 2. Render Local Variables (below instance vars) ---
  if (Object.keys(localVariables).length > 0) {
    currentY += styles.layout.varBoxSpacingY; // Add spacing AFTER instance vars
    const localVarsX = firstColX;
    const localVarsY = currentY; // Use updated Y
    const { height: locHeight, connectionPoints: localConnPoints } =
      renderVariableBox(
        contentGroup,
        "Local Variables",
        localVariables,
        localVarsX,
        localVarsY,
        styles.varBox,
        "local", // Simple prefix
        isAddress
      );
    // Add type to connections
    localConnPoints.forEach((conn) => (conn.type = "local"));
    allConnections.push(...localConnPoints);

    nodePositions["local_vars_box"] = {
      x: localVarsX,
      y: localVarsY,
      width: styles.varBox.width,
      height: locHeight,
    };
  }

  // --- 3. Render the Array/Vector (to the right of var boxes) ---
  let actualArrayData = [];
  if (
    arrayDataAddress &&
    addressObjectMap &&
    addressObjectMap[arrayDataAddress]
  ) {
    actualArrayData = addressObjectMap[arrayDataAddress];
    if (!Array.isArray(actualArrayData)) {
      console.warn(
        "ArrayVectorVisualization: Expected array data at address but found:",
        actualArrayData
      );
      actualArrayData = [];
    }
  } else {
    // Handle case where array data might be inline or missing
    if (Array.isArray(instanceVariables?.array)) {
      actualArrayData = instanceVariables.array;
    } else if (Array.isArray(instanceVariables?.data)) {
      actualArrayData = instanceVariables.data;
    }
  }

  const cellWidth = styles.arrayCell.width;
  const cellHeight = styles.arrayCell.height;
  const cellSpacing = styles.arrayCell.spacing;
  const elementsPerRow = styles.layout.elementsPerRow || 10;
  const rowSpacingY = styles.layout.rowSpacingY || 20;

  // --- Create Intermediate Address Box (Positioned relative to arrayVarSourceCoords) ---
  if (arrayDataAddress && arrayVarSourceCoords) {
    const boxWidth = 80;
    const boxHeight = styles.arrayCell.height;
    // Position horizontally right of the source point + spacing
    const boxX =
      arrayVarSourceCoords.x + (styles.layout.nodeSpacingX || 60) / 2;
    // Position vertically centered with the source point
    const boxY = arrayVarSourceCoords.y - boxHeight / 2;

    const interGroup = contentGroup
      .append("g")
      .attr("class", "intermediate-address-box");

    interGroup
      .append("rect")
      .attr("x", boxX)
      .attr("y", boxY)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("fill", styles.arrayCell.fill)
      .attr("stroke", styles.arrayCell.stroke)
      .attr("rx", 3);

    interGroup
      .append("text")
      .attr("x", boxX + boxWidth / 2)
      .attr("y", boxY + boxHeight / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", styles.varBox.addressValueFill)
      .text(String(arrayDataAddress)); // Display full address

    intermediateBoxPos = {
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
    };
    nodePositions["intermediate_array_address_box"] = intermediateBoxPos;
  }

  // --- Render Array/Vector (Positioned relative to Intermediate Box or Var Boxes) ---
  const arrayStartX = intermediateBoxPos
    ? intermediateBoxPos.x + intermediateBoxPos.width // No extra spacing
    : firstColX + styles.varBox.width + (styles.layout.nodeSpacingX || 60); // Keep spacing if no intermediate box

  const arrayStartY = intermediateBoxPos
    ? intermediateBoxPos.y // Align top of array with top of intermediate box
    : varBoxTopMargin; // Default if no intermediate box

  if (actualArrayData && actualArrayData.length > 0) {
    actualArrayData.forEach((value, index) => {
      const rowIndex = Math.floor(index / elementsPerRow);
      const colIndex = index % elementsPerRow;

      // Direct value from actualArrayData
      const cellValue = value;

      const x = arrayStartX + colIndex * cellWidth; // Use cellWidth only, no spacing
      const y = arrayStartY + rowIndex * (cellHeight + rowSpacingY);

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

      // Draw separator line for index partition
      const indexPartHeight = styles.arrayCell.indexPartitionHeight || 15;
      cellGroup
        .append("line")
        .attr("x1", 0)
        .attr("y1", indexPartHeight)
        .attr("x2", cellWidth)
        .attr("y2", indexPartHeight)
        .attr("stroke", styles.arrayCell.stroke)
        .attr("stroke-width", 0.5);

      // Render Index text in the top partition
      cellGroup
        .append("text")
        .attr("x", cellWidth / 2)
        .attr("y", indexPartHeight / 2) // Center in the index partition
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", styles.arrayCell.indexTextFill)
        .style("font-size", styles.arrayCell.indexFontSize)
        .text(index);

      cellGroup
        .append("text")
        .attr("x", cellWidth / 2)
        .attr("y", indexPartHeight + (cellHeight - indexPartHeight) / 2) // Center in the value partition
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", styles.arrayCell.textFill)
        .style("font-size", styles.arrayCell.fontSize)
        .text(truncateAddress(String(cellValue), 10)); // <<< Use calculated cellValue

      nodePositions[`array_cell_${index}`] = {
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        address: `array_cell_${index}`,
      };
    });
  }

  // --- Draw specific connections ---
  allConnections.forEach((conn) => {
    // Original placeholder comment
    console.log("Processing connection for ArrayVector Viz:", conn); // Renamed Log
  });

  // Restore the specific arrow drawing loop added previously
  // (This loop should be adapted in the next step based on the new plan)
  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");

  allConnections.forEach((conn) => {
    // Only draw instance variable connections for now, specifically the array pointer
    // *** This logic needs modification for the intermediate box plan ***
    // if (conn.type === 'instance' && conn.targetAddress === arrayDataAddress) {
    // ... existing arrow drawing logic targeting cell 0 ...
    // }
  });

  // --- Draw Arrows (Step 2: Connect to Intermediate Box & Box to Array) ---
  if (intermediateBoxPos) {
    // 1. Arrow from Var Box Field to Intermediate Box
    // Use the pre-calculated source coordinates
    if (arrayVarSourceCoords) {
      const sourcePoint = arrayVarSourceCoords;
      const targetPoint = {
        // Target left-middle of intermediate box
        x: intermediateBoxPos.x,
        y: intermediateBoxPos.y + intermediateBoxPos.height / 2,
      };
      const path1 = generateOrthogonalPath(
        sourcePoint,
        targetPoint,
        styles.connection.cornerRadius,
        "H-V-H",
        20
      );
      if (path1) {
        connectionsGroup
          .append("path")
          .attr("d", path1)
          .attr("fill", "none")
          .attr(
            "stroke",
            styles.connection.instanceVarColor || styles.connection.defaultColor
          )
          .attr("stroke-width", styles.connection.strokeWidth)
          .attr(
            "marker-end",
            `url(#${
              styles.connection.llInstanceVarMarkerId ||
              styles.connection.markerId
            })`
          ); // Use defined marker
      }
    }

    /*
    // 2. Arrow from Intermediate Box to First Array Cell (if array exists)
    if (capacity > 0 && nodePositions["array_cell_0"]) {
      const sourcePoint = {
        x: intermediateBoxPos.x + intermediateBoxPos.width,
        y: intermediateBoxPos.y + intermediateBoxPos.height / 2,
      };
      const firstCellPos = nodePositions["array_cell_0"];
      const targetPoint = {
        x: firstCellPos.x,
        y: firstCellPos.y + firstCellPos.height / 2,
      };
      const path2 = generateOrthogonalPath(
        sourcePoint,
        targetPoint,
        styles.connection.cornerRadius,
        "H-V-H", // Or adjust as needed
        15 // Shorter initial segment
      );
      if (path2) {
        connectionsGroup
          .append("path")
          .attr("d", path2)
          .attr("fill", "none")
          .attr("stroke", styles.connection.instanceVarColor || styles.connection.defaultColor)
          .attr("stroke-width", styles.connection.strokeWidth)
          .attr("marker-end", `url(#${styles.connection.llInstanceVarMarkerId || styles.connection.markerId})`);
      }
    }
    */
  }

  console.log(
    "Finished ArrayVectorVisualization render. Node Positions:", // Renamed Log
    nodePositions
  );
  // Placeholder: Auto-fit or center the visualization if needed
  // autoFitVisualization(svg, contentGroup, zoomBehavior, width, height);
};

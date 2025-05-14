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

export const renderArrayStructureVisualization = (
  contentGroup,
  width,
  height,
  operation,
  memorySnapshot,
  snapshotIdentifier
) => {
  console.log(
    `[${snapshotIdentifier || "ArrayViz"}] TOP OF RENDER. Op:`,
    operation,
    "Snap:",
    memorySnapshot
  );

  const state = memorySnapshot || operation.state || {}; // Prioritize snapshot
  console.log(
    `[${
      snapshotIdentifier || "ArrayViz"
    } Debug] Effective 'state' for rendering:`,
    JSON.parse(JSON.stringify(state))
  );
  console.log(
    `[${
      snapshotIdentifier || "ArrayViz"
    } Debug] Direct 'memorySnapshot' received:`,
    JSON.parse(JSON.stringify(memorySnapshot))
  );
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
  let intermediateBoxPos = null;
  const firstColX = 30;
  const varBoxTopMargin = styles.layout.arrayTopMargin || 30;
  let currentLayoutY = varBoxTopMargin; // Initialize currentLayoutY ONCE

  // --- 1. Render Instance Variables ---
  if (Object.keys(instanceVariables).length > 0) {
    const instanceVarsX = firstColX;
    const instanceVarsResult = renderVariableBox(
      contentGroup,
      "Instance Variables",
      instanceVariables,
      instanceVarsX,
      currentLayoutY, // Use currentLayoutY
      styles.varBox,
      "instance",
      isAddress
    );
    allConnections.push(...instanceVarsResult.connectionPoints);
    nodePositions["instance_vars_box"] = {
      x: instanceVarsX,
      y: currentLayoutY,
      width: styles.varBox.width,
      height: instanceVarsResult.height,
    };
    currentLayoutY += instanceVarsResult.height + styles.layout.varBoxSpacingY;
  }

  // --- Prepare data needed for intermediate box & array ---
  console.log(
    `[${snapshotIdentifier || "ArrayViz"}] Instance Variables:`,
    instanceVariables
  );
  const arrayVarKey = Object.keys(instanceVariables).find(
    (key) =>
      key === "array" ||
      key === "data" ||
      key === "digits" ||
      key === "vector" ||
      key === "first" ||
      key === "second"
  );
  console.log(
    `[${snapshotIdentifier || "ArrayViz"}] Found array variable key:`,
    arrayVarKey
  );
  const arrayDataAddress = arrayVarKey ? instanceVariables[arrayVarKey] : null;
  console.log(
    `[${snapshotIdentifier || "ArrayViz"}] Array data address:`,
    arrayDataAddress
  );
  const arrayVarConnection = allConnections.find(
    (c) => c.varName === arrayVarKey && c.sourceName.startsWith("instance-")
  );
  console.log(
    `[${snapshotIdentifier || "ArrayViz"}] Array variable connection:`,
    arrayVarConnection
  );
  const arrayVarSourceCoords = arrayVarConnection
    ? arrayVarConnection.sourceCoords
    : null;
  console.log(
    `[${snapshotIdentifier || "ArrayViz"}] Array variable source coordinates:`,
    arrayVarSourceCoords
  );

  // --- 2. Render Local Variables (below instance vars) ---
  console.log(
    `[${snapshotIdentifier || "ArrayViz"} Debug] Local Variables object:`,
    JSON.parse(JSON.stringify(localVariables))
  );
  if (Object.keys(localVariables).length > 0) {
    console.log(
      `[${
        snapshotIdentifier || "ArrayViz"
      } Debug] Attempting to render Local Variables box.`
    );
    const localVarsX = firstColX;
    const localVarsY = currentLayoutY; // Position below instance vars
    const { height: locHeight, connectionPoints: localConnPoints } =
      renderVariableBox(
        contentGroup,
        "Local Variables",
        localVariables,
        localVarsX,
        localVarsY,
        styles.varBox,
        "local",
        isAddress
      );
    localConnPoints.forEach((conn) => (conn.type = "local"));
    allConnections.push(...localConnPoints);
    nodePositions["local_vars_box"] = {
      x: localVarsX,
      y: localVarsY,
      width: styles.varBox.width,
      height: locHeight,
    };
    currentLayoutY += locHeight + styles.layout.varBoxSpacingY;
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

  let mainArraySystemBottomY = currentLayoutY; // Start with Y below var boxes
  let localVarsBoxPosition = nodePositions["local_vars_box"];

  // --- Create Intermediate Address Box for Main Array ---
  if (arrayDataAddress && arrayVarSourceCoords) {
    const boxWidth = 80;
    const boxHeight = styles.arrayCell.height;
    const boxX =
      arrayVarSourceCoords.x + (styles.layout.nodeSpacingX || 60) / 2;

    // Align top of intermediate box with top of instance variables box (or source field Y if no box)
    const instanceVarsBoxTopY = nodePositions["instance_vars_box"]
      ? nodePositions["instance_vars_box"].y
      : arrayVarSourceCoords
      ? arrayVarSourceCoords.y - styles.varBox.fieldHeight / 2
      : varBoxTopMargin;
    const boxY = instanceVarsBoxTopY;

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
      .text(String(arrayDataAddress));

    intermediateBoxPos = {
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
    };
    nodePositions["intermediate_array_address_box"] = intermediateBoxPos;
    mainArraySystemBottomY = Math.max(mainArraySystemBottomY, boxY + boxHeight);
  }

  // --- Render Main Array/Vector ---
  const arrayStartX = intermediateBoxPos
    ? intermediateBoxPos.x + intermediateBoxPos.width
    : firstColX + styles.varBox.width + (styles.layout.nodeSpacingX || 60);
  const arrayStartY = intermediateBoxPos
    ? intermediateBoxPos.y
    : varBoxTopMargin; // Or currentLayoutY if main array should be strictly below all var boxes

  let mainArrayRenderedHeight = 0;
  if (actualArrayData && actualArrayData.length > 0) {
    actualArrayData.forEach((value, index) => {
      const x = arrayStartX + index * cellWidth;
      const y = arrayStartY;
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
      const indexPartHeight = styles.arrayCell.indexPartitionHeight || 15;
      cellGroup
        .append("line")
        .attr("x1", 0)
        .attr("y1", indexPartHeight)
        .attr("x2", cellWidth)
        .attr("y2", indexPartHeight)
        .attr("stroke", styles.arrayCell.stroke)
        .attr("stroke-width", 0.5);
      cellGroup
        .append("text")
        .attr("x", cellWidth / 2)
        .attr("y", indexPartHeight / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", styles.arrayCell.indexTextFill)
        .style("font-size", styles.arrayCell.indexFontSize)
        .text(index);
      cellGroup
        .append("text")
        .attr("x", cellWidth / 2)
        .attr("y", indexPartHeight + (cellHeight - indexPartHeight) / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", styles.arrayCell.textFill)
        .style("font-size", styles.arrayCell.fontSize)
        .text(truncateAddress(String(value), 10));
      nodePositions[`array_cell_${index}`] = {
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        address: `array_cell_${index}`,
      };
    });
    mainArrayRenderedHeight = cellHeight; // Since it's single line
    mainArraySystemBottomY = Math.max(
      mainArraySystemBottomY,
      arrayStartY + mainArrayRenderedHeight
    );
  }

  currentLayoutY = mainArraySystemBottomY + rowSpacingY * 2; // Prepare Y for other arrays

  // --- Render Other Arrays from addressObjectMap ---
  let otherArraysStartX;
  let otherArraysStartY;

  if (localVarsBoxPosition) {
    otherArraysStartX =
      localVarsBoxPosition.x +
      localVarsBoxPosition.width +
      (styles.layout.nodesStartXOffset || 60);
    otherArraysStartY = localVarsBoxPosition.y; // Align top of other arrays with top of local vars box
  } else {
    // Fallback if no local vars box: position to the right of where instance vars would be, and below main array system
    otherArraysStartX =
      firstColX + styles.varBox.width + (styles.layout.nodesStartXOffset || 60);
    otherArraysStartY = currentLayoutY; // currentLayoutY is already below main array system here
  }

  let currentOtherArrayY = otherArraysStartY;

  Object.entries(addressObjectMap).forEach(([address, data]) => {
    if (Array.isArray(data) && address !== arrayDataAddress) {
      const subsequentArrayData = data;
      if (subsequentArrayData.length === 0) return;

      const subIntermediateBoxWidth = 80;
      const subIntermediateBoxHeight = styles.arrayCell.height;

      // Position this intermediate box based on calculated otherArraysStartX and currentOtherArrayY
      const subIntermediateBoxX = otherArraysStartX;
      const subIntermediateBoxY = currentOtherArrayY;

      const subInterGroup = contentGroup
        .append("g")
        .attr("class", `intermediate-box-${address}`);
      subInterGroup
        .append("rect")
        .attr("x", subIntermediateBoxX)
        .attr("y", subIntermediateBoxY)
        .attr("width", subIntermediateBoxWidth)
        .attr("height", subIntermediateBoxHeight)
        .attr("fill", styles.arrayCell.fill)
        .attr("stroke", styles.arrayCell.stroke)
        .attr("rx", 3);
      subInterGroup
        .append("text")
        .attr("x", subIntermediateBoxX + subIntermediateBoxWidth / 2)
        .attr("y", subIntermediateBoxY + subIntermediateBoxHeight / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", styles.varBox.addressValueFill)
        .text(String(address));
      nodePositions[`intermediate_box_${address}`] = {
        x: subIntermediateBoxX,
        y: subIntermediateBoxY,
        width: subIntermediateBoxWidth,
        height: subIntermediateBoxHeight,
      };

      const subsequentArrayStartX =
        subIntermediateBoxX + subIntermediateBoxWidth;
      subsequentArrayData.forEach((value, index) => {
        const x = subsequentArrayStartX + index * cellWidth;
        const y = subIntermediateBoxY; // Align cells with this other array's intermediate box Y
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
        const indexPartHeight = styles.arrayCell.indexPartitionHeight || 15;
        cellGroup
          .append("line")
          .attr("x1", 0)
          .attr("y1", indexPartHeight)
          .attr("x2", cellWidth)
          .attr("y2", indexPartHeight)
          .attr("stroke", styles.arrayCell.stroke)
          .attr("stroke-width", 0.5);
        cellGroup
          .append("text")
          .attr("x", cellWidth / 2)
          .attr("y", indexPartHeight / 2)
          .attr("dy", ".35em")
          .attr("text-anchor", "middle")
          .attr("fill", styles.arrayCell.indexTextFill)
          .style("font-size", styles.arrayCell.indexFontSize)
          .text(index);
        cellGroup
          .append("text")
          .attr("x", cellWidth / 2)
          .attr("y", indexPartHeight + (cellHeight - indexPartHeight) / 2)
          .attr("dy", ".35em")
          .attr("text-anchor", "middle")
          .attr("fill", styles.arrayCell.textFill)
          .style("font-size", styles.arrayCell.fontSize)
          .text(truncateAddress(String(value), 10));
        nodePositions[`array_${address}_cell_${index}`] = {
          x,
          y,
          width: cellWidth,
          height: cellHeight,
          address: `array_${address}_cell_${index}`,
        };
      });
      currentOtherArrayY += subIntermediateBoxHeight + rowSpacingY; // Increment Y for the next "other" array
    }
  });

  // Update overall layout Y based on the bottom of the other arrays or the main array system
  currentLayoutY = Math.max(mainArraySystemBottomY, currentOtherArrayY);

  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");

  // --- Draw specific connections ---
  console.log(
    `[${snapshotIdentifier || "ArrayViz"}] All collected connections:`,
    JSON.parse(JSON.stringify(allConnections))
  ); // Log all connections
  allConnections.forEach((conn) => {
    console.log(
      `[${snapshotIdentifier || "ArrayViz"}] Processing connection:`,
      JSON.parse(JSON.stringify(conn))
    ); // Log each connection being processed
    let sourcePoint = conn.sourceCoords;
    let targetIntermediateBoxKey = null;
    let targetIntermediateBoxPos = null;

    // ----> ADDED: Get source container box data <----
    let sourceContainerBoxPosData = null;
    if (conn.sourceName && conn.sourceName.startsWith("instance-")) {
      sourceContainerBoxPosData = nodePositions["instance_vars_box"];
    } else if (conn.sourceName && conn.sourceName.startsWith("local-")) {
      sourceContainerBoxPosData = nodePositions["local_vars_box"];
    }
    // ----> END ADDED <----

    // Determine if the connection targets an intermediate box
    if (conn.targetAddress === arrayDataAddress) {
      targetIntermediateBoxKey = "intermediate_array_address_box";
    } else if (
      addressObjectMap[conn.targetAddress] &&
      Array.isArray(addressObjectMap[conn.targetAddress])
    ) {
      targetIntermediateBoxKey = `intermediate_box_${conn.targetAddress}`;
    }

    if (targetIntermediateBoxKey) {
      targetIntermediateBoxPos = nodePositions[targetIntermediateBoxKey];
    }

    // Logging for variable connections
    if (
      conn.sourceName &&
      (conn.sourceName.startsWith("local-") ||
        conn.sourceName.startsWith("instance-"))
    ) {
      console.log(
        `[${snapshotIdentifier || "ArrayViz"} Var Conn Debug] Var: ${
          conn.varName
        } (Type: ${conn.sourceName.split("-")[0]}), TargetAddr: ${
          conn.targetAddress
        }`
      );
      console.log(
        `[${
          snapshotIdentifier || "ArrayViz"
        } Var Conn Debug] -> TargetKey: ${targetIntermediateBoxKey}, FoundPos: ${!!targetIntermediateBoxPos}`
      );
    }

    // Draw connection from a variable (instance or local) to an intermediate box
    if (sourcePoint && targetIntermediateBoxPos) {
      const isInstanceToArray =
        conn.sourceName?.startsWith("instance-") && targetIntermediateBoxPos; // MODIFIED: Check for any valid target box
      const isLocalToArray =
        conn.sourceName?.startsWith("local-") && targetIntermediateBoxPos; // General case for local pointing to any array

      if (isInstanceToArray || isLocalToArray) {
        // ---- REPLACING WITH LLV/WBV LOGIC ----
        let actualSourceEgressPoint, finalTargetPointForPath;
        let path = "";
        let markerId = styles.connection.llInstanceVarMarkerId; // Default for var connections
        let color = styles.connection.instanceVarColor; // Default for var connections
        const cornerRadius = styles.connection.cornerRadius || 5;
        let pathOrientationHint = "auto";
        const sNodeStyle = styles.varBox; // Use varBox style for thresholds as source is var box field

        const Y_THRESHOLD = (sNodeStyle.fieldHeight || 25) * 1.5; // Adjusted threshold
        const HORIZONTAL_OVERSHOOT = 20;
        const INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP = 20;

        // 1. Source Data (already have sourceContainerBoxPosData and sourcePoint from conn.sourceCoords)
        if (!sourceContainerBoxPosData || !sourcePoint) {
          console.warn(
            `[${
              snapshotIdentifier || "ArrayViz"
            } Arrow] Missing source VarBox data or field coords:`,
            conn
          );
          return; // Skip this connection
        }

        // 2. Target Data is targetIntermediateBoxPos (already have this)

        // 3. Coordinates & Deltas
        const sourceOverallMidX =
          sourceContainerBoxPosData.x + sourceContainerBoxPosData.width / 2;
        const sourceFieldActualY = sourcePoint.y; // Y from the actual field

        const targetOverallMidX =
          targetIntermediateBoxPos.x + targetIntermediateBoxPos.width / 2;
        const targetOverallMidY =
          targetIntermediateBoxPos.y + targetIntermediateBoxPos.height / 2;

        let decisionSourceY = sourceFieldActualY; // For var box connections, decision Y is the field's Y

        const deltaXOverallMid = Math.abs(
          targetOverallMidX - sourceOverallMidX
        );
        const deltaYDecisionMid = Math.abs(targetOverallMidY - decisionSourceY);

        console.log(
          `[${snapshotIdentifier || "ArrayViz"} ArrowDecision] Var: ${
            conn.varName
          }, DeltaX: ${deltaXOverallMid.toFixed(
            2
          )}, DeltaY: ${deltaYDecisionMid.toFixed(
            2
          )}, Y_THRESH: ${Y_THRESHOLD.toFixed(2)}`
        );

        // 4. Egress Side & Source Point (actualSourceEgressPoint)
        const chosenEgressSide =
          targetOverallMidX < sourceOverallMidX ? "left" : "right";
        actualSourceEgressPoint = { y: sourceFieldActualY };
        if (chosenEgressSide === "left") {
          actualSourceEgressPoint.x = sourceContainerBoxPosData.x;
        } else {
          actualSourceEgressPoint.x =
            sourceContainerBoxPosData.x + sourceContainerBoxPosData.width;
        }

        // 5. Path Style Decision & Target Point (finalTargetPointForPath)
        if (deltaYDecisionMid <= Y_THRESHOLD) {
          pathOrientationHint = "H-V-H";
          finalTargetPointForPath = {
            x:
              sourceOverallMidX < targetOverallMidX
                ? targetIntermediateBoxPos.x // Target left edge
                : targetIntermediateBoxPos.x + targetIntermediateBoxPos.width, // Target right edge
            y: targetOverallMidY, // Target middle Y
          };
          console.log(
            `[${
              snapshotIdentifier || "ArrayViz"
            } ArrowDecision] Path Hint: H-V-H (Y-thresh met)`
          );
        } else {
          pathOrientationHint = "H-V_to_target_top";
          const sourceRightX =
            sourceContainerBoxPosData.x + sourceContainerBoxPosData.width;
          const targetRightX =
            targetIntermediateBoxPos.x + targetIntermediateBoxPos.width;

          const overlap =
            Math.max(sourceContainerBoxPosData.x, targetIntermediateBoxPos.x) <
            Math.min(sourceRightX, targetRightX);
          console.log(
            `[${
              snapshotIdentifier || "ArrayViz"
            } ArrowDecision] Path Hint: H-V (Y-thresh NOT met). Overlap: ${overlap}`
          );

          if (!overlap) {
            let approachingEdgeX =
              chosenEgressSide === "right"
                ? targetIntermediateBoxPos.x
                : targetRightX;
            let overshotX =
              chosenEgressSide === "right"
                ? approachingEdgeX + HORIZONTAL_OVERSHOOT
                : approachingEdgeX - HORIZONTAL_OVERSHOOT;
            finalTargetPointForPath = {
              x: overshotX,
              y:
                decisionSourceY < targetOverallMidY
                  ? targetIntermediateBoxPos.y
                  : targetIntermediateBoxPos.y +
                    targetIntermediateBoxPos.height,
            };
          } else {
            let turnX =
              chosenEgressSide === "right"
                ? actualSourceEgressPoint.x +
                  INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP
                : actualSourceEgressPoint.x -
                  INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP;
            finalTargetPointForPath = {
              x: turnX,
              y:
                decisionSourceY < targetOverallMidY
                  ? targetIntermediateBoxPos.y
                  : targetIntermediateBoxPos.y +
                    targetIntermediateBoxPos.height,
            };
          }
        }

        // 6. Marker and Color already set by default for var connections

        // 7. Initial Offset for path generation
        let initialOffset = 15;
        if (pathOrientationHint === "H-V-H") {
          const xDistForOffset = deltaXOverallMid / 2 - cornerRadius * 2;
          const yDistForOffset =
            Math.abs(finalTargetPointForPath.y - actualSourceEgressPoint.y) *
            0.4;
          initialOffset = Math.max(
            5,
            Math.min(30, xDistForOffset, yDistForOffset)
          );
        }

        // Logging before path generation (can be kept for debugging)
        console.log(
          `[${snapshotIdentifier || "ArrayViz"} PathGen Pre-Check] Var: ${
            conn.varName
          }`
        );
        console.log(
          `  Source Container:`,
          JSON.parse(JSON.stringify(sourceContainerBoxPosData))
        );
        console.log(
          `  Target Intermediate Box:`,
          JSON.parse(JSON.stringify(targetIntermediateBoxPos))
        );
        console.log(
          `  Actual Source Egress:`,
          JSON.parse(JSON.stringify(actualSourceEgressPoint))
        );
        console.log(
          `  Final Target Point:`,
          JSON.parse(JSON.stringify(finalTargetPointForPath))
        );
        console.log(`  Path Hint: ${pathOrientationHint}`);
        console.log(`  Initial Offset: ${initialOffset}`);

        // 8. Generate Path
        path = generateOrthogonalPath(
          actualSourceEgressPoint,
          finalTargetPointForPath,
          cornerRadius,
          pathOrientationHint,
          initialOffset,
          null
        );

        // 9. Draw Path
        if (path) {
          connectionsGroup
            .append("path")
            .attr("d", path)
            .attr("fill", "none")
            .attr("stroke", color || styles.connection.defaultColor)
            .attr("stroke-width", styles.connection.strokeWidth)
            .attr("marker-end", markerId ? `url(#${markerId})` : null);
          if (isLocalToArray) {
            console.log(
              `[${
                snapshotIdentifier || "ArrayViz"
              } Local Conn Debug] -> Successfully DREW arrow for ${
                conn.varName
              } to ${targetIntermediateBoxKey} using ${pathOrientationHint}`
            );
          } else if (isInstanceToArray) {
            console.log(
              `[${
                snapshotIdentifier || "ArrayViz"
              } Instance Conn Debug] -> Successfully DREW arrow for ${
                conn.varName
              } to ${targetIntermediateBoxKey} using ${pathOrientationHint}`
            );
          }
        } else if (isLocalToArray) {
          console.log(
            `[${
              snapshotIdentifier || "ArrayViz"
            } Local Conn Debug] -> Path generation FAILED for ${
              conn.varName
            } (PathHint: ${pathOrientationHint})`
          );
        } else if (isInstanceToArray) {
          console.log(
            `[${
              snapshotIdentifier || "ArrayViz"
            } Instance Conn Debug] -> Path generation FAILED for ${
              conn.varName
            } (PathHint: ${pathOrientationHint})`
          );
        }
      }
    } else if (
      conn.sourceName &&
      (conn.sourceName.startsWith("local-") ||
        conn.sourceName.startsWith("instance-"))
    ) {
      console.log(
        `[${
          snapshotIdentifier || "ArrayViz"
        } Var Conn Debug] -> Arrow not drawn for ${conn.varName} (Type: ${
          conn.sourceName.split("-")[0]
        }) because sourcePoint or targetIntermediateBoxPos is missing/null.`
      );
      console.log(
        `[${
          snapshotIdentifier || "ArrayViz"
        } Var Conn Debug] ---> sourcePoint: ${!!sourcePoint}, targetIntermediateBoxPos: ${!!targetIntermediateBoxPos}`
      );
    }
  });

  console.log(
    `[${
      snapshotIdentifier || "ArrayViz"
    }] Finished ArrayVectorVisualization render. Node Positions:`,
    nodePositions
  );
  // Placeholder: Auto-fit or center the visualization if needed
  // autoFitVisualization(svg, contentGroup, zoomBehavior, width, height);
};

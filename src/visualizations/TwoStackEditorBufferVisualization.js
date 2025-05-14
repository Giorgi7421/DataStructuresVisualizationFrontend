import {
  defineArrowheads,
  renderVariableBox,
  isAddress,
  truncateAddress,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

export const renderTwoStackEditorBufferVisualization = (
  contentGroup,
  width,
  height,
  operation,
  memorySnapshot,
  snapshotIdentifier
) => {
  console.log(
    `[${snapshotIdentifier || "TwoStackViz"}] TOP OF RENDER. Op:`,
    operation,
    "Snap:",
    memorySnapshot
  );

  const state = memorySnapshot || operation.state || {};
  const localVariables = state.localVariables || {};
  const instanceVariables = state.instanceVariables || {};
  const addressObjectMap = state.addressObjectMap || {};

  const styles = {
    varBox: {
      width: 220,
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
    stackCell: {
      width: 50,
      height: 30,
      fill: "#ffffff",
      stroke: "#cbd5e1", // Lighter stroke for cells
      textFill: "#334155",
      fontSize: "14px",
      spacingY: 2,
    },
    addressLabel: {
      // Style to mimic grid's address boxes
      height: 25, // Adjusted height
      fill: "#f1f5f9", // Light grey fill, similar to grid's address box
      stroke: "#94a3b8", // Border color, similar to grid's address box
      textFill: "#0ea5e9", // Blue text for address, similar to grid
      fontSize: "11px",
      paddingX: 8, // Horizontal padding within the label box
      marginTop: 0, // Changed from 5 to 0 to remove gap
    },
    cursor: {
      width: 4,
      // height will be set after styles.stackCell is defined
      fill: "#fb923c", // Orange
    },
    connection: {
      strokeWidth: 1.5,
      instanceVarColor: "#334155",
      defaultColor: "#64748b",
      cornerRadius: 8,
      llInstanceVarMarkerId: "ts-instance-var-arrow",
    },
    layout: {
      varBoxSpacingY: 20,
      stacksTopMargin: 50,
      stacksXOffset: 20,
      cursorStackGap: 10, // Gap between a stack and the cursor
    },
  };

  // Now define parts of styles that depend on other parts
  styles.cursor.height = styles.stackCell.height + 4;

  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles);

  const nodePositions = {};
  const allConnections = [];
  const leftColumnX = 5;
  let yPosTracker = styles.layout.stacksTopMargin; // General Y tracker, starts for Stacks

  // --- STACKS AREA FIRST (to determine their bottom edge) ---
  const stacksDrawingAreaTopY = yPosTracker; // Stacks start at the initial top margin

  // --- Determine Starting X for Stacks Area ---
  const leftColumnWidth = styles.varBox.width;
  const stacksAreaStartX =
    leftColumnX + leftColumnWidth + styles.layout.stacksXOffset + 30;

  // --- Prepare Stack Data ---
  const beforeStackAddress = instanceVariables.before;
  const afterStackAddress = instanceVariables.after;

  let beforeData = [];
  if (beforeStackAddress && addressObjectMap[beforeStackAddress]) {
    beforeData = addressObjectMap[beforeStackAddress];
  } else if (Array.isArray(instanceVariables.before)) {
    // Fallback if data is inline
    beforeData = instanceVariables.before;
  }

  let afterData = [];
  if (afterStackAddress && addressObjectMap[afterStackAddress]) {
    afterData = addressObjectMap[afterStackAddress];
  } else if (Array.isArray(instanceVariables.after)) {
    // Fallback
    afterData = instanceVariables.after;
  }

  // --- 4. Layout and Render Stacks, Labels & Cursor ---
  // Stacks area top is aligned with the top of the Instance Variables box
  // const stacksDrawingAreaTopY = instanceVariablesY; // Align with the Y where Instance Vars were rendered

  const cellWidth = styles.stackCell.width;
  const cellHeight = styles.stackCell.height;
  const cellSpacingY = styles.stackCell.spacingY;

  // Helper function to calculate stack height
  const calculateStackVisualHeight = (numCells, itemHeight, itemSpacingY) => {
    if (numCells === 0) return 0;
    return numCells * itemHeight + (numCells - 1) * itemSpacingY;
  };

  const beforeStackActualHeight = calculateStackVisualHeight(
    beforeData.length,
    cellHeight,
    cellSpacingY
  );
  const afterStackActualHeight = calculateStackVisualHeight(
    afterData.length,
    cellHeight,
    cellSpacingY
  );
  const maxStackVisualHeight = Math.max(
    beforeStackActualHeight,
    afterStackActualHeight
  );

  // --- Determine dynamic widths based on potential label text ---
  const beforeLabelText = truncateAddress(beforeStackAddress || "null");
  const estBeforeTextWidth =
    beforeLabelText.length * (parseInt(styles.addressLabel.fontSize) * 0.7);
  const beforeStackCellWidth = Math.max(
    cellWidth,
    estBeforeTextWidth + styles.addressLabel.paddingX * 2
  );

  const afterLabelText = truncateAddress(afterStackAddress || "null");
  const estAfterTextWidth =
    afterLabelText.length * (parseInt(styles.addressLabel.fontSize) * 0.7);
  const afterStackCellWidth = Math.max(
    cellWidth,
    estAfterTextWidth + styles.addressLabel.paddingX * 2
  );

  // --- Stacks Rendering ---
  const beforeStackTopRenderY =
    stacksDrawingAreaTopY + (maxStackVisualHeight - beforeStackActualHeight);
  const afterStackTopRenderY =
    stacksDrawingAreaTopY + (maxStackVisualHeight - afterStackActualHeight);

  let beforeStackBottomY = beforeStackTopRenderY + beforeStackActualHeight;
  let afterStackBottomY = afterStackTopRenderY + afterStackActualHeight;

  const beforeStackX = stacksAreaStartX;

  if (beforeData.length > 0) {
    beforeData.forEach((char, index) => {
      const y = beforeStackTopRenderY + index * (cellHeight + cellSpacingY);
      const cellGroup = contentGroup
        .append("g")
        .attr("transform", `translate(${beforeStackX}, ${y})`);
      cellGroup
        .append("rect")
        .attr("width", beforeStackCellWidth)
        .attr("height", cellHeight)
        .attr("fill", styles.stackCell.fill)
        .attr("stroke", styles.stackCell.stroke);
      cellGroup
        .append("text")
        .attr("x", beforeStackCellWidth / 2)
        .attr("y", cellHeight / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", styles.stackCell.textFill)
        .style("font-size", styles.stackCell.fontSize)
        .text(String(char));
      if (index === 0) {
        nodePositions["before_stack_top"] = {
          x: beforeStackX,
          y: y, // This is beforeStackTopRenderY for the first element
          width: beforeStackCellWidth,
          height: cellHeight,
          address: beforeStackAddress,
        };
      }
      // beforeStackBottomY is already calculated and will be correct
    });
  } else {
    nodePositions["before_stack_top"] = {
      x: beforeStackX,
      y: beforeStackTopRenderY, // Top line of the empty stack placeholder
      width: beforeStackCellWidth,
      height: cellHeight, // Conceptual height for targeting
      isEmpty: true,
      address: beforeStackAddress,
    };
    // beforeStackBottomY remains beforeStackTopRenderY if empty (height is 0)
  }

  const cursorX =
    beforeStackX + beforeStackCellWidth + styles.layout.cursorStackGap;

  // Recalculate cursorPosY based on the (potentially shifted) beforeStack
  let cursorPosY;
  const beforeStackEffectiveTopForCursor = beforeStackTopRenderY;
  if (beforeData.length > 0) {
    cursorPosY =
      beforeStackEffectiveTopForCursor +
      beforeData.length * (cellHeight + cellSpacingY) -
      cellSpacingY / 2;
  } else {
    cursorPosY = beforeStackEffectiveTopForCursor - cellHeight / 2; // Center on where first item would be
  }

  const effectiveCursorY = Math.max(
    stacksDrawingAreaTopY, // Ensure cursor doesn't go above the general stack area top
    cursorPosY - styles.cursor.height / 2
  );
  /* CURSOR REMOVED
  contentGroup
    .append("rect")
    .attr("x", cursorX)
    .attr("y", effectiveCursorY)
    .attr("width", styles.cursor.width)
    .attr("height", styles.cursor.height)
    .attr("fill", styles.cursor.fill)
    .attr("rx", 2)
    .attr("ry", 2);
  */

  // Adjust afterStackX as cursor is removed
  const afterStackX =
    beforeStackX + beforeStackCellWidth + styles.layout.cursorStackGap;
  // afterStackBottomY is already calculated

  if (afterData.length > 0) {
    afterData.forEach((char, index) => {
      const y = afterStackTopRenderY + index * (cellHeight + cellSpacingY);
      const cellGroup = contentGroup
        .append("g")
        .attr("transform", `translate(${afterStackX}, ${y})`);
      cellGroup
        .append("rect")
        .attr("width", afterStackCellWidth)
        .attr("height", cellHeight)
        .attr("fill", styles.stackCell.fill)
        .attr("stroke", styles.stackCell.stroke);
      cellGroup
        .append("text")
        .attr("x", afterStackCellWidth / 2)
        .attr("y", cellHeight / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", styles.stackCell.textFill)
        .style("font-size", styles.stackCell.fontSize)
        .text(String(char));
      if (index === 0) {
        nodePositions["after_stack_top"] = {
          x: afterStackX,
          y: y, // This is afterStackTopRenderY for the first element
          width: afterStackCellWidth,
          height: cellHeight,
          address: afterStackAddress,
        };
      }
      // afterStackBottomY is already calculated
    });
  } else {
    nodePositions["after_stack_top"] = {
      x: afterStackX,
      y: afterStackTopRenderY, // Top line of the empty stack placeholder
      width: afterStackCellWidth,
      height: cellHeight, // Conceptual height for targeting
      isEmpty: true,
      address: afterStackAddress,
    };
    // afterStackBottomY remains afterStackTopRenderY if empty (height is 0)
  }

  // --- Address Labels (Now rendered AFTER stacks and positioned below them) ---
  if (beforeStackAddress) {
    const beforeLabelVisualX = beforeStackX + beforeStackCellWidth / 2; // Center of the stack
    const beforeLabelVisualY =
      beforeStackBottomY + styles.addressLabel.marginTop;
    const beforeLabelGroup = contentGroup
      .append("g")
      .attr(
        "transform",
        `translate(${
          beforeLabelVisualX - beforeStackCellWidth / 2
        }, ${beforeLabelVisualY})`
      );
    beforeLabelGroup
      .append("rect")
      .attr("width", beforeStackCellWidth)
      .attr("height", styles.addressLabel.height)
      .attr("fill", styles.addressLabel.fill)
      .attr("stroke", styles.addressLabel.stroke)
      .attr("rx", 3);
    beforeLabelGroup
      .append("text")
      .attr("x", beforeStackCellWidth / 2)
      .attr("y", styles.addressLabel.height / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", styles.addressLabel.textFill)
      .style("font-size", styles.addressLabel.fontSize)
      .text(beforeLabelText);
    nodePositions["before_stack_address_label"] = {
      x: beforeLabelVisualX - beforeStackCellWidth / 2,
      y: beforeLabelVisualY,
      width: beforeStackCellWidth,
      height: styles.addressLabel.height,
      address: beforeStackAddress,
    };
  }

  if (afterStackAddress) {
    const afterLabelVisualX = afterStackX + afterStackCellWidth / 2;
    const afterLabelVisualY = afterStackBottomY + styles.addressLabel.marginTop;
    const afterLabelGroup = contentGroup
      .append("g")
      .attr(
        "transform",
        `translate(${
          afterLabelVisualX - afterStackCellWidth / 2
        }, ${afterLabelVisualY})`
      );
    afterLabelGroup
      .append("rect")
      .attr("width", afterStackCellWidth)
      .attr("height", styles.addressLabel.height)
      .attr("fill", styles.addressLabel.fill)
      .attr("stroke", styles.addressLabel.stroke)
      .attr("rx", 3);
    afterLabelGroup
      .append("text")
      .attr("x", afterStackCellWidth / 2)
      .attr("y", styles.addressLabel.height / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", styles.addressLabel.textFill)
      .style("font-size", styles.addressLabel.fontSize)
      .text(afterLabelText);
    nodePositions["after_stack_address_label"] = {
      x: afterLabelVisualX - afterStackCellWidth / 2,
      y: afterLabelVisualY,
      width: afterStackCellWidth,
      height: styles.addressLabel.height,
      address: afterStackAddress,
    };
  }

  // After rendering stacks and their labels, calculate their total bottom extent:
  let bottomOfStacksAndLabelsArea =
    stacksDrawingAreaTopY + maxStackVisualHeight;
  if (
    nodePositions["before_stack_address_label"] ||
    nodePositions["after_stack_address_label"]
  ) {
    // If any label was rendered, add its height and margin
    // Assuming both labels if present are at same Y relative to stack bottom
    bottomOfStacksAndLabelsArea +=
      styles.addressLabel.height + styles.addressLabel.marginTop;
  }

  // --- Now position the Variable Column (Instance then Local) BELOW the stacks ---
  yPosTracker = bottomOfStacksAndLabelsArea + styles.layout.varBoxSpacingY; // Y for the top of Instance Vars

  // --- Render Instance Variables (Top of the variable column, below stacks) ---
  if (Object.keys(instanceVariables).length > 0) {
    const instanceVarsX = leftColumnX;
    const instanceVarsY = yPosTracker;
    const instanceVarsResult = renderVariableBox(
      contentGroup,
      "Instance Variables",
      instanceVariables,
      instanceVarsX,
      instanceVarsY,
      styles.varBox,
      "instance",
      isAddress
    );
    allConnections.push(...instanceVarsResult.connectionPoints);
    nodePositions["instance_vars_box"] = {
      x: instanceVarsX,
      y: instanceVarsY,
      width: styles.varBox.width,
      height: instanceVarsResult.height,
    };
    yPosTracker += instanceVarsResult.height + styles.layout.varBoxSpacingY;
  }

  // --- Render Local Variables (Below Instance Variables) ---
  if (Object.keys(localVariables).length > 0) {
    const localVarsX = leftColumnX;
    const localVarsY = yPosTracker; // Positioned below instance vars
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
    nodePositions["local_vars_box"] = {
      x: localVarsX,
      y: localVarsY,
      width: styles.varBox.width,
      height: localVarsResult.height,
    };
    // yPosTracker += localVarsResult.height + styles.layout.varBoxSpacingY; // No further elements in this column
  }

  // --- 5. Render Connections ---
  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");
  allConnections.forEach((conn) => {
    if (!conn.sourceCoords || !conn.targetAddress) return;

    let targetData = null;
    let targetNodeKeySuffix = ""; // To pick between label and stack top for targeting

    if (conn.targetAddress === beforeStackAddress) {
      targetData = nodePositions["before_stack_address_label"];
      // Fallback if label not rendered (e.g. null address), target stack top directly
      if (!targetData) targetData = nodePositions["before_stack_top"];
    } else if (conn.targetAddress === afterStackAddress) {
      targetData = nodePositions["after_stack_address_label"];
      if (!targetData) targetData = nodePositions["after_stack_top"];
    }

    if (conn.sourceName.startsWith("instance-") && targetData) {
      const sourcePoint = conn.sourceCoords;
      // Target: Middle of the BOTTOM edge of the label
      const finalTargetPoint = {
        x: targetData.x + targetData.width / 2, // Middle X of the label
        y: targetData.y + targetData.height, // Bottom edge of the label
      };

      const r = 4; // Use a smaller, fixed corner radius of 4px

      const sx = sourcePoint.x;
      const sy = sourcePoint.y;
      const tx = finalTargetPoint.x;
      const ty = finalTargetPoint.y;

      // Determine direction for sweep flag and adjustments
      const xDirection = Math.sign(tx - sx); // 1 if target is to the right, -1 if to the left
      const yDirection = Math.sign(ty - sy); // 1 if target is below source, -1 if target is above source

      // sweepFlag logic:
      // - H-Right, V-Down (xDir=1, yDir=1): Clockwise (1)
      // - H-Right, V-Up   (xDir=1, yDir=-1): Counter-Clockwise (0)
      // - H-Left,  V-Down (xDir=-1, yDir=1): Counter-Clockwise (0)
      // - H-Left,  V-Up   (xDir=-1, yDir=-1): Clockwise (1)
      // This corresponds to: sweepFlag is 1 if (xDirection * yDirection === 1), otherwise 0.
      const finalSweepFlag = xDirection * yDirection === 1 ? 1 : 0;

      let manualPath;
      if (r > 0 && Math.abs(tx - sx) >= r && Math.abs(ty - sy) >= r) {
        // Segments must be at least as long as radius
        // Only add radius if segments are long enough
        manualPath = `M ${sx} ${sy} L ${
          tx - xDirection * r
        } ${sy} A ${r} ${r} 0 0 ${finalSweepFlag} ${tx} ${
          sy + yDirection * r
        } L ${tx} ${ty}`;
      } else {
        // Fallback to sharp corner if radius is 0 or segments too short
        manualPath = `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`; // Sharp H-V
      }

      connectionsGroup
        .append("path")
        .attr("d", manualPath) // Use the manually constructed path
        .attr("fill", "none")
        .attr("stroke", styles.connection.instanceVarColor)
        .attr("stroke-width", styles.connection.strokeWidth)
        .attr("marker-end", `url(#${styles.connection.llInstanceVarMarkerId})`);
    }
  });

  console.log(
    `[${snapshotIdentifier || "TwoStackViz"}] Render Complete. NodePos:`,
    nodePositions
  );
};

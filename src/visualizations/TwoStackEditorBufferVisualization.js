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
      stroke: "#cbd5e1",
      textFill: "#334155",
      fontSize: "14px",
      spacingY: 2,
    },
    addressLabel: {
      height: 25,
      fill: "#f1f5f9",
      stroke: "#94a3b8",
      textFill: "#0ea5e9",
      fontSize: "11px",
      paddingX: 8,
      marginTop: 0,
    },
    cursor: {
      width: 4,

      fill: "#fb923c",
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
      cursorStackGap: 10,
    },
  };

  styles.cursor.height = styles.stackCell.height + 4;

  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles);

  const nodePositions = {};
  const allConnections = [];
  const leftColumnX = 5;
  let yPosTracker = styles.layout.stacksTopMargin;

  const stacksDrawingAreaTopY = yPosTracker;

  const leftColumnWidth = styles.varBox.width;
  const stacksAreaStartX =
    leftColumnX + leftColumnWidth + styles.layout.stacksXOffset + 30;

  const beforeStackAddress = instanceVariables.before;
  const afterStackAddress = instanceVariables.after;

  let beforeData = [];
  if (beforeStackAddress && addressObjectMap[beforeStackAddress]) {
    beforeData = addressObjectMap[beforeStackAddress];
  } else if (Array.isArray(instanceVariables.before)) {
    beforeData = instanceVariables.before;
  }

  let afterData = [];
  if (afterStackAddress && addressObjectMap[afterStackAddress]) {
    afterData = addressObjectMap[afterStackAddress];
  } else if (Array.isArray(instanceVariables.after)) {
    afterData = instanceVariables.after;
  }

  const cellWidth = styles.stackCell.width;
  const cellHeight = styles.stackCell.height;
  const cellSpacingY = styles.stackCell.spacingY;

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
          y: y,
          width: beforeStackCellWidth,
          height: cellHeight,
          address: beforeStackAddress,
        };
      }
    });
  } else {
    nodePositions["before_stack_top"] = {
      x: beforeStackX,
      y: beforeStackTopRenderY,
      width: beforeStackCellWidth,
      height: cellHeight,
      isEmpty: true,
      address: beforeStackAddress,
    };
  }

  const cursorX =
    beforeStackX + beforeStackCellWidth + styles.layout.cursorStackGap;

  let cursorPosY;
  const beforeStackEffectiveTopForCursor = beforeStackTopRenderY;
  if (beforeData.length > 0) {
    cursorPosY =
      beforeStackEffectiveTopForCursor +
      beforeData.length * (cellHeight + cellSpacingY) -
      cellSpacingY / 2;
  } else {
    cursorPosY = beforeStackEffectiveTopForCursor - cellHeight / 2;
  }

  const effectiveCursorY = Math.max(
    stacksDrawingAreaTopY,
    cursorPosY - styles.cursor.height / 2
  );

  const afterStackX =
    beforeStackX + beforeStackCellWidth + styles.layout.cursorStackGap;

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
          y: y,
          width: afterStackCellWidth,
          height: cellHeight,
          address: afterStackAddress,
        };
      }
    });
  } else {
    nodePositions["after_stack_top"] = {
      x: afterStackX,
      y: afterStackTopRenderY,
      width: afterStackCellWidth,
      height: cellHeight,
      isEmpty: true,
      address: afterStackAddress,
    };
  }

  if (beforeStackAddress) {
    const beforeLabelVisualX = beforeStackX + beforeStackCellWidth / 2;
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

  let bottomOfStacksAndLabelsArea =
    stacksDrawingAreaTopY + maxStackVisualHeight;
  if (
    nodePositions["before_stack_address_label"] ||
    nodePositions["after_stack_address_label"]
  ) {
    bottomOfStacksAndLabelsArea +=
      styles.addressLabel.height + styles.addressLabel.marginTop;
  }

  yPosTracker = bottomOfStacksAndLabelsArea + styles.layout.varBoxSpacingY;

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

  if (Object.keys(localVariables).length > 0) {
    const localVarsX = leftColumnX;
    const localVarsY = yPosTracker;
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
  }

  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");
  allConnections.forEach((conn) => {
    if (!conn.sourceCoords || !conn.targetAddress) return;

    let targetData = null;
    let targetNodeKeySuffix = "";

    if (conn.targetAddress === beforeStackAddress) {
      targetData = nodePositions["before_stack_address_label"];

      if (!targetData) targetData = nodePositions["before_stack_top"];
    } else if (conn.targetAddress === afterStackAddress) {
      targetData = nodePositions["after_stack_address_label"];
      if (!targetData) targetData = nodePositions["after_stack_top"];
    }

    if (conn.sourceName.startsWith("instance-") && targetData) {
      const sourcePoint = conn.sourceCoords;

      const finalTargetPoint = {
        x: targetData.x + targetData.width / 2,
        y: targetData.y + targetData.height,
      };

      const r = 4;

      const sx = sourcePoint.x;
      const sy = sourcePoint.y;
      const tx = finalTargetPoint.x;
      const ty = finalTargetPoint.y;

      const xDirection = Math.sign(tx - sx);
      const yDirection = Math.sign(ty - sy);

      const finalSweepFlag = xDirection * yDirection === 1 ? 1 : 0;

      let manualPath;
      if (r > 0 && Math.abs(tx - sx) >= r && Math.abs(ty - sy) >= r) {
        manualPath = `M ${sx} ${sy} L ${
          tx - xDirection * r
        } ${sy} A ${r} ${r} 0 0 ${finalSweepFlag} ${tx} ${
          sy + yDirection * r
        } L ${tx} ${ty}`;
      } else {
        manualPath = `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
      }

      connectionsGroup
        .append("path")
        .attr("d", manualPath)
        .attr("fill", "none")
        .attr("stroke", styles.connection.instanceVarColor)
        .attr("stroke-width", styles.connection.strokeWidth)
        .attr("marker-end", `url(#${styles.connection.llInstanceVarMarkerId})`);
    }
  });
};

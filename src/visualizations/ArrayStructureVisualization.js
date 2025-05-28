import {
  defineArrowheads,
  renderVariableBox,
  renderGenericNode,
  isAddress,
  truncateAddress,
  generateOrthogonalPath,
} from "../utils/visualizationUtils";

import { defaultVisualizationStyles } from "../utils/visualizationUtils";

const isObjectValue = (value, addressObjectMap) => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return true;
  }

  const valueStr = String(value);
  if (isAddress(valueStr) && addressObjectMap && addressObjectMap[valueStr]) {
    const data = addressObjectMap[valueStr];
    const isObj =
      typeof data === "object" && data !== null && !Array.isArray(data);
    return isObj;
  }

  if (
    valueStr.includes("Object") ||
    valueStr.includes("@") ||
    valueStr === "[object Object]"
  ) {
    const objectAddresses = Object.keys(addressObjectMap).filter((addr) => {
      const data = addressObjectMap[addr];
      return typeof data === "object" && data !== null && !Array.isArray(data);
    });

    if (objectAddresses.length > 0) {
      return true;
    }
  }
  return false;
};

const renderObjectCellContent = (
  cellGroup,
  cellWidth,
  cellHeight,
  value,
  addressObjectMap,
  nodePositions,
  styles,
  index,
  isMainArray = true
) => {
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

  let objectData = null;
  let objectAddress = null;

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    objectData = value;
    objectAddress = `object_${index}`;
  } else if (isAddress(String(value)) && addressObjectMap[value]) {
    objectData = addressObjectMap[value];
    objectAddress = String(value);
  } else if (
    String(value).includes("Object") ||
    String(value) === "[object Object]"
  ) {
    const objectEntries = Object.entries(addressObjectMap).filter(
      ([addr, data]) => {
        return (
          typeof data === "object" && data !== null && !Array.isArray(data)
        );
      }
    );

    if (objectEntries.length > index) {
      const [addr, data] = objectEntries[index];
      objectData = data;
      objectAddress = addr;
    } else if (objectEntries.length > 0) {
      const [addr, data] = objectEntries[0];
      objectData = data;
      objectAddress = addr;
    }
  } else {
    for (const [addr, data] of Object.entries(addressObjectMap)) {
      if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        objectData = data;
        objectAddress = addr;
        break;
      }
    }
  }

  if (!objectData) {
    cellGroup
      .append("text")
      .attr("x", cellWidth / 2)
      .attr("y", indexPartHeight + (cellHeight - indexPartHeight) / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", styles.arrayCell.textFill)
      .style("font-size", styles.arrayCell.fontSize)
      .text(truncateAddress(String(value), 10));
    return;
  }

  const nodeGroup = cellGroup.append("g").attr("class", "object-node");

  const nodeAreaHeight = cellHeight - indexPartHeight;
  const nodeWidth = cellWidth - 4;
  const nodeHeight = Math.min(nodeAreaHeight - 4, 40);

  const nodeX = 2;
  const nodeY = indexPartHeight + 2;

  nodeGroup
    .append("rect")
    .attr("x", nodeX)
    .attr("y", nodeY)
    .attr("width", nodeWidth)
    .attr("height", nodeHeight)
    .attr("fill", "#ffffff")
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 1)
    .attr("rx", 3);

  const fields = Object.entries(objectData);
  const maxFields = Math.min(fields.length, 3);
  const fieldHeight = Math.max(10, nodeHeight / maxFields - 2);

  fields.slice(0, maxFields).forEach(([key, value], idx) => {
    const fieldY = nodeY + idx * fieldHeight + fieldHeight / 2 + 4;

    nodeGroup
      .append("text")
      .attr("x", nodeX + 4)
      .attr("y", fieldY)
      .attr("dy", ".35em")
      .attr("text-anchor", "start")
      .attr("font-size", "7px")
      .attr("font-weight", "bold")
      .attr("fill", "#64748b")
      .text(`${key}:`);

    const valueStr = String(value);
    const displayValue = isAddress(valueStr) ? "[ref]" : valueStr;

    nodeGroup
      .append("text")
      .attr("x", nodeX + nodeWidth - 4)
      .attr("y", fieldY)
      .attr("dy", ".35em")
      .attr("text-anchor", "end")
      .attr("font-size", "7px")
      .attr("fill", "#334155")
      .text(truncateAddress(displayValue, 6));
  });
};

const renderPrimitiveCellContent = (
  cellGroup,
  cellWidth,
  cellHeight,
  value,
  styles,
  index
) => {
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
};

export const renderArrayStructureVisualization = (
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
    arrayCell: {
      width: 80,
      height: 50,
      fill: "#ffffff",
      stroke: "#94a3b8",
      textFill: "#334155",
      indexTextFill: "#64748b",
      fontSize: "14px",
      indexFontSize: "10px",
      indexPartitionHeight: 18,
      spacing: 0,
    },
    connection: {
      strokeWidth: 1.5,
      instanceVarColor: "#334155",
      defaultColor: "#64748b",
      cornerRadius: 8,

      llInstanceVarMarkerId: "array-instance-var-arrow",
    },
    layout: {
      nodeSpacingX: 60,
      varBoxSpacingY: 20,
      nodesStartXOffset: 60,
      layerSpacingY: 120,

      arrayTopMargin: 30,
      elementsPerRow: 10,
      rowSpacingY: 20,
    },
  };

  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles);

  const nodePositions = {};
  const allConnections = [];
  let intermediateBoxPos = null;
  const firstColX = 30;
  const varBoxTopMargin = styles.layout.arrayTopMargin || 30;
  let currentLayoutY = varBoxTopMargin;

  if (Object.keys(instanceVariables).length > 0) {
    const instanceVarsX = firstColX;
    const instanceVarsResult = renderVariableBox(
      contentGroup,
      "Instance Variables",
      instanceVariables,
      instanceVarsX,
      currentLayoutY,
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

  const arrayVarKey = Object.keys(instanceVariables).find(
    (key) =>
      key === "array" ||
      key === "data" ||
      key === "digits" ||
      key === "vector" ||
      key === "first" ||
      key === "second"
  );
  const arrayDataAddress = arrayVarKey ? instanceVariables[arrayVarKey] : null;
  const arrayVarConnection = allConnections.find(
    (c) => c.varName === arrayVarKey && c.sourceName.startsWith("instance-")
  );
  const arrayVarSourceCoords = arrayVarConnection
    ? arrayVarConnection.sourceCoords
    : null;

  if (Object.keys(localVariables).length > 0) {
    const localVarsX = firstColX;
    const localVarsY = currentLayoutY;
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

  let mainArraySystemBottomY = currentLayoutY;
  let localVarsBoxPosition = nodePositions["local_vars_box"];

  if (arrayDataAddress && arrayVarSourceCoords) {
    const boxWidth = 80;
    const boxHeight = styles.arrayCell.height;
    const boxX =
      arrayVarSourceCoords.x + (styles.layout.nodeSpacingX || 60) / 2;

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

  const arrayStartX = intermediateBoxPos
    ? intermediateBoxPos.x + intermediateBoxPos.width
    : firstColX + styles.varBox.width + (styles.layout.nodeSpacingX || 60);
  const arrayStartY = intermediateBoxPos
    ? intermediateBoxPos.y
    : varBoxTopMargin;

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

      const isObject = isObjectValue(value, addressObjectMap);

      if (isObject) {
        renderObjectCellContent(
          cellGroup,
          cellWidth,
          cellHeight,
          value,
          addressObjectMap,
          nodePositions,
          styles,
          index,
          true
        );
      } else {
        renderPrimitiveCellContent(
          cellGroup,
          cellWidth,
          cellHeight,
          value,
          styles,
          index
        );
      }

      nodePositions[`array_cell_${index}`] = {
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        address: `array_cell_${index}`,
      };
    });
    mainArrayRenderedHeight = cellHeight;
    mainArraySystemBottomY = Math.max(
      mainArraySystemBottomY,
      arrayStartY + mainArrayRenderedHeight
    );
  }

  currentLayoutY = mainArraySystemBottomY + rowSpacingY * 2;

  let otherArraysStartX;
  let otherArraysStartY;

  if (localVarsBoxPosition) {
    otherArraysStartX =
      localVarsBoxPosition.x +
      localVarsBoxPosition.width +
      (styles.layout.nodesStartXOffset || 60);
    otherArraysStartY = localVarsBoxPosition.y;
  } else {
    otherArraysStartX =
      firstColX + styles.varBox.width + (styles.layout.nodesStartXOffset || 60);
    otherArraysStartY = currentLayoutY;
  }

  let currentOtherArrayY = otherArraysStartY;

  Object.entries(addressObjectMap).forEach(([address, data]) => {
    if (Array.isArray(data) && address !== arrayDataAddress) {
      const subsequentArrayData = data;

      const subIntermediateBoxWidth = 80;
      const subIntermediateBoxHeight = styles.arrayCell.height;

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
        const y = subIntermediateBoxY;
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

        if (isObjectValue(value, addressObjectMap)) {
          renderObjectCellContent(
            cellGroup,
            cellWidth,
            cellHeight,
            value,
            addressObjectMap,
            nodePositions,
            styles,
            index,
            false
          );
        } else {
          renderPrimitiveCellContent(
            cellGroup,
            cellWidth,
            cellHeight,
            value,
            styles,
            index
          );
        }

        nodePositions[`array_${address}_cell_${index}`] = {
          x,
          y,
          width: cellWidth,
          height: cellHeight,
          address: `array_${address}_cell_${index}`,
        };
      });
      currentOtherArrayY += subIntermediateBoxHeight + rowSpacingY;
    }
  });

  currentLayoutY = Math.max(mainArraySystemBottomY, currentOtherArrayY);

  const connectionsGroup = contentGroup
    .append("g")
    .attr("class", "connections-group");

  allConnections.forEach((conn) => {
    let sourcePoint = conn.sourceCoords;
    let targetIntermediateBoxKey = null;
    let targetIntermediateBoxPos = null;

    let sourceContainerBoxPosData = null;
    if (conn.sourceName && conn.sourceName.startsWith("instance-")) {
      sourceContainerBoxPosData = nodePositions["instance_vars_box"];
    } else if (conn.sourceName && conn.sourceName.startsWith("local-")) {
      sourceContainerBoxPosData = nodePositions["local_vars_box"];
    }

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

    if (sourcePoint && targetIntermediateBoxPos) {
      const isInstanceToArray =
        conn.sourceName?.startsWith("instance-") && targetIntermediateBoxPos;
      const isLocalToArray =
        conn.sourceName?.startsWith("local-") && targetIntermediateBoxPos;

      if (isInstanceToArray || isLocalToArray) {
        let actualSourceEgressPoint, finalTargetPointForPath;
        let path = "";
        let markerId = styles.connection.llInstanceVarMarkerId;
        let color = styles.connection.instanceVarColor;
        const cornerRadius = styles.connection.cornerRadius || 5;
        let pathOrientationHint = "auto";
        const sNodeStyle = styles.varBox;

        const Y_THRESHOLD = (sNodeStyle.fieldHeight || 25) * 1.5;
        const HORIZONTAL_OVERSHOOT = 20;
        const INITIAL_HORIZONTAL_SEGMENT_FOR_OVERLAP = 20;

        if (!sourceContainerBoxPosData || !sourcePoint) {
          console.warn(
            `[${
              snapshotIdentifier || "ArrayViz"
            } Arrow] Missing source VarBox data or field coords:`,
            conn
          );
          return;
        }

        const sourceOverallMidX =
          sourceContainerBoxPosData.x + sourceContainerBoxPosData.width / 2;
        const sourceFieldActualY = sourcePoint.y;

        const targetOverallMidX =
          targetIntermediateBoxPos.x + targetIntermediateBoxPos.width / 2;
        const targetOverallMidY =
          targetIntermediateBoxPos.y + targetIntermediateBoxPos.height / 2;

        let decisionSourceY = sourceFieldActualY;

        const deltaXOverallMid = Math.abs(
          targetOverallMidX - sourceOverallMidX
        );
        const deltaYDecisionMid = Math.abs(targetOverallMidY - decisionSourceY);

        const chosenEgressSide =
          targetOverallMidX < sourceOverallMidX ? "left" : "right";
        actualSourceEgressPoint = { y: sourceFieldActualY };
        if (chosenEgressSide === "left") {
          actualSourceEgressPoint.x = sourceContainerBoxPosData.x;
        } else {
          actualSourceEgressPoint.x =
            sourceContainerBoxPosData.x + sourceContainerBoxPosData.width;
        }

        if (deltaYDecisionMid <= Y_THRESHOLD) {
          pathOrientationHint = "H-V-H";
          finalTargetPointForPath = {
            x:
              sourceOverallMidX < targetOverallMidX
                ? targetIntermediateBoxPos.x
                : targetIntermediateBoxPos.x + targetIntermediateBoxPos.width,
            y: targetOverallMidY,
          };
        } else {
          pathOrientationHint = "H-V_to_target_top";
          const sourceRightX =
            sourceContainerBoxPosData.x + sourceContainerBoxPosData.width;
          const targetRightX =
            targetIntermediateBoxPos.x + targetIntermediateBoxPos.width;

          const overlap =
            Math.max(sourceContainerBoxPosData.x, targetIntermediateBoxPos.x) <
            Math.min(sourceRightX, targetRightX);

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

        path = generateOrthogonalPath(
          actualSourceEgressPoint,
          finalTargetPointForPath,
          cornerRadius,
          pathOrientationHint,
          initialOffset,
          null
        );

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
};

// src/utils/visualizationUtils.js

// Helper function to check if a value is an address
export const isAddress = (value) => {
  if (!value) return false;
  return typeof value === "string" && value.match(/^0x[0-9a-f]+$/i);
};

// Helper function to truncate addresses for display
export const truncateAddress = (address, length = 6) => {
  if (!address) return "null";
  const stringAddress = String(address);
  if (isAddress(stringAddress)) {
    return `${stringAddress.substring(0, 2 + length)}...`;
  }
  // If it's not a typical address (e.g. could be "null", a number, or other string)
  // show a bit more if it's short, or truncate if long
  if (stringAddress.length > 10) {
    return `${stringAddress.substring(0, 8)}...`;
  }
  return stringAddress;
};

// Helper to generate curved path between two points
export const generateCurvedPath = (
  source,
  target,
  pathType = "default",
  curveFactor = 0.4
) => {
  // Calculate the vector between points
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  // Determine if connection is horizontal/vertical/diagonal for default behavior
  const isMainlyHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
  const isMainlyVertical = Math.abs(dy) > Math.abs(dx) * 1.5;

  const distanceTotal = Math.sqrt(dx * dx + dy * dy);
  let controlDistance = Math.min(distanceTotal * curveFactor, 80); // Use curveFactor

  let cp1x, cp1y, cp2x, cp2y;

  if (pathType === "longArcDown") {
    // Revised for ERD-style orthogonal connector with ROUNDED corners: Down, Horizontal, Up
    const verticalDipFromSource = 30;
    const cornerRadius = 8; // Increased radius for more visible rounding

    let path = `M ${source.x} ${source.y}`;
    const firstVerticalY = source.y + verticalDipFromSource;
    const targetHorizontalSign = Math.sign(target.x - source.x);

    // Segment 1: Go down to the start of the first curve
    path += ` V ${firstVerticalY - cornerRadius}`;
    // Corner 1: Rounded turn from vertical (down) to horizontal (right or left)
    path += ` Q ${source.x} ${firstVerticalY}, ${
      source.x + targetHorizontalSign * cornerRadius
    } ${firstVerticalY}`;
    // Segment 2: Go horizontal towards the start of the second curve
    path += ` H ${target.x - targetHorizontalSign * cornerRadius}`;
    // Corner 2: Rounded turn from horizontal to vertical (up)
    path += ` Q ${target.x} ${firstVerticalY}, ${target.x} ${
      firstVerticalY - cornerRadius
    }`;
    // Segment 3: Go vertical up to target's Y
    path += ` V ${target.y}`;

    console.log("[generateCurvedPath] longArcDown Data (Rounded):", {
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      generatedPath: path,
    });
    return path;
  } else if (pathType === "arcUpHigh") {
    // New: Force a path that arcs upwards significantly
    const arcHeight = Math.max(80, distanceTotal * 0.3, Math.abs(dx) * 0.25); // Increased arc height
    cp1x = source.x + dx * 0.3;
    cp1y = source.y - arcHeight;
    cp2x = target.x - dx * 0.3;
    cp2y = target.y - arcHeight;
  } else if (pathType === "orthogonalNext") {
    // ERD-style for node-to-node next pointers: H, V, H
    const horizontalOffset = 20; // Use a fixed horizontal offset
    let path = `M ${source.x} ${source.y}`;
    // Segment 1: Horizontal line out from source
    path += ` H ${source.x + horizontalOffset}`;
    // Segment 2: Vertical line to align with target Y
    path += ` V ${target.y}`;
    // Segment 3: Horizontal line into target
    path += ` H ${target.x}`;
    console.log("[generateCurvedPath] orthogonalNext Data:", {
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      generatedPath: path,
    });
    return path;
  } else {
    // Default pathing logic
    if (isMainlyHorizontal) {
      cp1x = source.x + Math.sign(dx) * controlDistance;
      cp1y = source.y;
      cp2x = target.x - Math.sign(dx) * controlDistance;
      cp2y = target.y;
    } else if (isMainlyVertical) {
      cp1x = source.x;
      cp1y = source.y + Math.sign(dy) * controlDistance;
      cp2x = target.x;
      cp2y = target.y - Math.sign(dy) * controlDistance;
    } else {
      cp1x = source.x + Math.sign(dx) * controlDistance;
      cp1y = source.y + Math.sign(dy) * controlDistance * 0.3;
      cp2x = target.x - Math.sign(dx) * controlDistance;
      cp2y = target.y - Math.sign(dy) * controlDistance * 0.3;
    }
  }

  return `M ${source.x} ${source.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${target.x} ${target.y}`;
};

// Universal Orthogonal Path Generator
export const generateOrthogonalPath = (
  source,
  target,
  cornerRadius = 5,
  hint = "auto",
  initialOffset = 30,
  detourTargetY = null
) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  let path = `M ${source.x} ${source.y}`;
  let orientation = hint;

  if (hint === "auto") {
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      orientation = "H-V-H";
    } else {
      orientation = "V-H-V";
    }
  }

  if (orientation === "H-V-H") {
    const sourceSignX = Math.sign(dx) || 1;
    const targetSignY = Math.sign(dy) || 1;
    const turn1X = source.x + sourceSignX * initialOffset;
    const turn1Y = source.y;
    const turn2X = turn1X;
    const turn2Y = target.y;
    const effectiveRadiusH1 = Math.min(
      cornerRadius,
      Math.abs(turn1X - source.x)
    );
    const effectiveRadiusV = Math.min(cornerRadius, Math.abs(turn2Y - turn1Y));
    const effectiveRadiusH2 = Math.min(
      cornerRadius,
      Math.abs(target.x - turn2X)
    );
    path += ` H ${turn1X - sourceSignX * effectiveRadiusH1}`;
    path += ` Q ${turn1X} ${turn1Y}, ${turn1X} ${
      turn1Y + targetSignY * effectiveRadiusV
    }`;
    path += ` V ${turn2Y - targetSignY * effectiveRadiusV}`;
    path += ` Q ${turn2X} ${turn2Y}, ${
      turn2X + sourceSignX * effectiveRadiusH2
    } ${turn2Y}`;
    path += ` H ${target.x}`;
  } else if (orientation === "V-H-V") {
    const sourceSignY = Math.sign(dy) || 1;
    const targetSignX = Math.sign(dx) || 1;
    let turn1Yactual;
    let useDetour = false;
    if (
      detourTargetY !== null &&
      hint === "V-H-V" &&
      detourTargetY > source.y
    ) {
      console.log(
        `[generateOrthogonalPath] V-H-V: Applying detour. SourceY: ${source.y}, DetourTargetY: ${detourTargetY}`
      );
      turn1Yactual = detourTargetY;
      useDetour = true;
    } else {
      turn1Yactual = source.y + sourceSignY * initialOffset;
      if (detourTargetY !== null && hint === "V-H-V") {
        console.log(
          `[generateOrthogonalPath] V-H-V: DetourY (${detourTargetY}) provided but NOT applied. SourceY: ${source.y}`
        );
      }
    }
    const turn1X = source.x;
    const turn1Y = turn1Yactual;
    const turn2X = target.x;
    const turn2Y = turn1Y;
    const signV1 = useDetour ? 1 : sourceSignY;
    const signV2 = useDetour ? Math.sign(target.y - turn1Y) || -1 : sourceSignY;
    const effectiveRadiusV1 = Math.min(
      cornerRadius,
      Math.abs(turn1Y - source.y)
    );
    const effectiveRadiusH = Math.min(cornerRadius, Math.abs(turn2X - turn1X));
    const effectiveRadiusV2 = Math.min(
      cornerRadius,
      Math.abs(target.y - turn2Y)
    );
    path += ` V ${turn1Y - signV1 * effectiveRadiusV1}`;
    path += ` Q ${turn1X} ${turn1Y}, ${
      turn1X + targetSignX * effectiveRadiusH
    } ${turn1Y}`;
    path += ` H ${turn2X - targetSignX * effectiveRadiusH}`;
    path += ` Q ${turn2X} ${turn2Y}, ${turn2X} ${
      turn2Y + signV2 * effectiveRadiusV2
    }`;
    path += ` V ${target.y}`;
    if (useDetour) {
      console.log("[generateOrthogonalPath] V-H-V DETOUR path constructed:");
      console.log(
        `  Source: (${source.x}, ${source.y}), Target: (${target.x}, ${target.y}), DetourY: ${turn1Yactual}`
      );
      console.log(`  Path: ${path}`);
    }
  } else if (orientation === "H-V_to_target_top") {
    const sourceSignX = Math.sign(dx) || 1;
    const targetSignY = Math.sign(dy) || 1;
    const turn1X = target.x;
    const turn1Y = source.y;
    const effectiveRadiusH1 = Math.min(
      cornerRadius,
      Math.abs(turn1X - source.x)
    );
    const effectiveRadiusV = Math.min(
      cornerRadius,
      Math.abs(target.y - turn1Y)
    );
    path += ` H ${turn1X - sourceSignX * effectiveRadiusH1}`;
    path += ` Q ${turn1X} ${turn1Y}, ${turn1X} ${
      turn1Y + targetSignY * effectiveRadiusV
    }`;
    path += ` V ${target.y}`;
    console.log("[generateOrthogonalPath] H-V_to_target_top path constructed:");
    console.log(
      `  Source: (${source.x}, ${source.y}), Target: (${target.x}, ${target.y})`
    );
    console.log(`  Path: ${path}`);
  } else {
    console.warn(
      `[generateOrthogonalPath] Unknown orientation: ${orientation}. Drawing straight line.`
    );
    path += ` L ${target.x} ${target.y}`;
  }

  console.log(
    `[generateOrthogonalPath] Hint: ${hint}, Orientation: ${orientation}, Path: ${path}`
  );
  return path;
};

// Hardcoded Path Generator for 'end' pointer
export const generateHardcodedEndPointerPath = (
  sourceConnectionPoint,
  targetNodePosition,
  verticalDrop = 75,
  horizontalClearance = 20,
  cornerRadius = 8
) => {
  let path = `M ${sourceConnectionPoint.x} ${sourceConnectionPoint.y}`;
  const p0 = sourceConnectionPoint;
  const p1x = p0.x - horizontalClearance;
  path += ` H ${p1x}`;
  const p2y = p0.y + verticalDrop;
  path += ` V ${p2y}`;
  const targetCenterX = targetNodePosition.x + targetNodePosition.width / 2;
  path += ` H ${targetCenterX}`;
  const targetAttachY = targetNodePosition.y + targetNodePosition.height;
  path += ` V ${targetAttachY}`;
  console.log("[generateHardcodedEndPointerPath - SHARP] Constructed:", {
    path,
    p0,
    p1x,
    p2y,
    targetCenterX,
    targetAttachY,
    verticalDrop,
    horizontalClearance,
  });
  return path;
};

// Smart Detour Path Generator (for specific cases like 'end' pointer)
export const generateSmartDetourPath = (
  sourcePoint,
  targetNodePos,
  standoff = 30,
  cornerRadius = 8
) => {
  let path = `M ${sourcePoint.x} ${sourcePoint.y}`;
  const horizontalPathY = sourcePoint.y + standoff;
  const sourceSegmentEndX = sourcePoint.x;
  const targetAttachX = targetNodePos.x + targetNodePos.width / 2;
  const targetAttachY = targetNodePos.y + targetNodePos.height;
  const horizontalSegmentStartX = sourcePoint.x;
  const horizontalSegmentEndX = targetAttachX;
  const signY_sourceToHorizontal =
    Math.sign(horizontalPathY - sourcePoint.y) || 1;
  const signX_horizontal =
    Math.sign(horizontalSegmentEndX - horizontalSegmentStartX) || 1;
  const signY_horizontalToTarget =
    Math.sign(targetAttachY - horizontalPathY) || 1;
  const rV1 = Math.min(cornerRadius, Math.abs(horizontalPathY - sourcePoint.y));
  const rH = Math.min(
    cornerRadius,
    Math.abs(horizontalSegmentEndX - horizontalSegmentStartX)
  );
  const rV2 = Math.min(cornerRadius, Math.abs(targetAttachY - horizontalPathY));
  path += ` V ${horizontalPathY - signY_sourceToHorizontal * rV1}`;
  path += ` Q ${sourceSegmentEndX} ${horizontalPathY}, ${
    horizontalSegmentStartX + signX_horizontal * rH
  } ${horizontalPathY}`;
  path += ` H ${horizontalSegmentEndX - signX_horizontal * rH}`;
  path += ` Q ${horizontalSegmentEndX} ${horizontalPathY}, ${horizontalSegmentEndX} ${
    horizontalPathY + signY_horizontalToTarget * rV2
  }`;
  path += ` V ${targetAttachY}`;
  console.log("[generateSmartDetourPath] Path constructed:", {
    path,
    sourcePoint,
    targetNodeX: targetNodePos.x,
    targetNodeY: targetNodePos.y,
    targetNodeWidth: targetNodePos.width,
    targetNodeHeight: targetNodePos.height,
    standoff,
    horizontalPathY,
    targetAttachX,
    targetAttachY,
  });
  return path;
};

// Helper function to render a generic variable box
export const renderVariableBox = (
  group,
  title,
  variables,
  x,
  y,
  styleConfig,
  type,
  isAddressFn // Use isAddress from this file implicitly
) => {
  const boxGroup = group
    .append("g")
    .attr("class", `${type}-variables-box-group`);
  const connectionPoints = [];
  const defaultConfig = {
    width: 180,
    headerHeight: 25,
    fieldHeight: 25,
    fieldSpacing: 5,
    padding: 10,
    fill: "#f9f9f9",
    stroke: "#cccccc",
    titleFill: "#eeeeee",
    titleStroke: "#cccccc",
    titleTextFill: "#333333",
    keyTextFill: "#333333",
    valueTextFill: "#333333",
    addressValueFill: "#0000cc",
    fieldRectFill: "#ffffff",
    fieldRectStroke: "#dddddd",
    fontSize: "12px",
    titleFontSize: "13px",
  };
  const s = { ...defaultConfig, ...styleConfig };
  const varCount = Object.keys(variables).length;
  const contentHeight =
    varCount * s.fieldHeight +
    (varCount > 0 ? (varCount - 1) * s.fieldSpacing : 0);
  const boxHeight =
    s.headerHeight + (varCount > 0 ? s.padding * 2 + contentHeight : s.padding);
  boxGroup
    .append("rect")
    .attr("x", x)
    .attr("y", y)
    .attr("width", s.width)
    .attr("height", boxHeight)
    .attr("fill", s.fill)
    .attr("stroke", s.stroke)
    .attr("stroke-width", 1)
    .attr("rx", 5);
  boxGroup
    .append("rect")
    .attr("x", x)
    .attr("y", y)
    .attr("width", s.width)
    .attr("height", s.headerHeight)
    .attr("fill", s.titleFill)
    .attr(
      "fill-opacity",
      s.titleFillOpacity !== undefined ? s.titleFillOpacity : 1
    )
    .attr("stroke", s.titleStroke || s.stroke)
    .attr("stroke-width", 1)
    .attr("rx", 5)
    .attr("ry", 0);
  boxGroup
    .append("text")
    .attr("x", x + s.width / 2)
    .attr("y", y + s.headerHeight / 2 + parseFloat(s.titleFontSize) / 3)
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .attr("font-size", s.titleFontSize)
    .attr("fill", s.titleTextFill)
    .text(title);
  if (varCount > 0) {
    boxGroup
      .append("line")
      .attr("x1", x)
      .attr("y1", y + s.headerHeight)
      .attr("x2", x + s.width)
      .attr("y2", y + s.headerHeight)
      .attr("stroke", s.titleStroke || s.stroke)
      .attr("stroke-width", 0.5);
  }
  let fieldCurrentY = y + s.headerHeight + s.padding;
  Object.entries(variables).forEach(([key, value]) => {
    const fieldGroup = boxGroup.append("g").attr("class", `var-field-${key}`);
    if (s.fieldRectFill || s.fieldRectStroke) {
      fieldGroup
        .append("rect")
        .attr("x", x + s.padding / 2)
        .attr("y", fieldCurrentY - s.padding / 2)
        .attr("width", s.width - s.padding)
        .attr("height", s.fieldHeight)
        .attr(
          "fill",
          s.fieldRectFill === "none" ? "transparent" : s.fieldRectFill
        )
        .attr(
          "stroke",
          s.fieldRectStroke === "none" ? "transparent" : s.fieldRectStroke
        )
        .attr("stroke-width", 1)
        .attr("rx", 3);
    }
    fieldGroup
      .append("text")
      .attr("x", x + s.padding)
      .attr(
        "y",
        fieldCurrentY + s.fieldHeight / 2 - parseFloat(s.fontSize) / 3 + 2
      )
      .attr("font-size", s.fontSize)
      .attr("font-weight", "bold")
      .attr("fill", s.keyTextFill)
      .text(`${key}:`);
    const stringValue = String(value);
    const isAddr = isAddress(stringValue); // Use isAddress from this file
    fieldGroup
      .append("text")
      .attr("x", x + s.width - s.padding)
      .attr(
        "y",
        fieldCurrentY + s.fieldHeight / 2 - parseFloat(s.fontSize) / 3 + 2
      )
      .attr("text-anchor", "end")
      .attr("font-size", s.fontSize)
      .attr("font-weight", isAddr ? "bold" : "normal")
      .attr("fill", isAddr ? s.addressValueFill : s.valueTextFill)
      .text(stringValue);
    if (isAddr) {
      const connectionData = {
        sourceName: `${type}-${key}`,
        sourceCoords: {
          x: x + s.width,
          y:
            fieldCurrentY +
            s.fieldHeight / 2 -
            parseFloat(s.fontSize) / 3 +
            2 -
            s.padding / 2 +
            s.fieldHeight / 2,
        },
        targetAddress: stringValue,
        type: type,
        varName: key,
      };
      if (type === "instance") {
        connectionData.leftSourceCoords = {
          x: x,
          y: connectionData.sourceCoords.y,
        };
      }
      connectionPoints.push(connectionData);
    }
    fieldCurrentY += s.fieldHeight + s.fieldSpacing;
  });
  return { height: boxHeight, connectionPoints: connectionPoints };
};

// Helper function to define standard arrowhead markers in the SVG <defs>
export const defineArrowheads = (defs, globalStyles) => {
  const createMarker = (id, color, size = 8, refX = 8) => {
    if (defs.select(`#${id}`).empty()) {
      defs
        .append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", refX)
        .attr("refY", 0)
        .attr("markerWidth", size)
        .attr("markerHeight", size)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    }
  };
  const connStyles = globalStyles?.connection || {};
  const defaultBlue = "#0284c7";
  const defaultDarkGray = "#334155";
  const defaultSlate = "#64748b";
  const defaultRed = "#ef4444";
  const defaultGreen = "#166534";
  createMarker("array-arrow", connStyles.arrayArrowColor || defaultBlue);
  createMarker("var-ref-arrow", connStyles.varRefColor || defaultDarkGray);
  createMarker("next-arrow", connStyles.nextColor || defaultBlue);
  createMarker("prev-arrow", connStyles.prevColor || defaultRed);
  createMarker("current-arrow", connStyles.currentColor || defaultGreen);
  createMarker(
    "ll-next-arrow",
    connStyles.llNextColor || connStyles.nextColor || defaultBlue,
    7,
    7
  );
  createMarker(
    "ll-instance-var-arrow",
    connStyles.llInstanceVarColor || connStyles.varRefColor || defaultDarkGray,
    7,
    7
  );
};

// Helper function to render a generic node
export const renderGenericNode = (
  group,
  nodeSpec,
  styleConfig,
  positionsMap,
  isAddressFn, // Use isAddress from this file implicitly
  truncateAddrFn // Use truncateAddress from this file implicitly
) => {
  console.log(
    `[renderGenericNode] START processing node: ${nodeSpec?.address}`
  );
  const defaultConfig = {
    width: 180,
    headerHeight: 25,
    fieldHeight: 25,
    fieldSpacing: 5,
    padding: 10,
    fill: "#ffffff",
    stroke: "#cccccc",
    titleFill: "#eeeeee",
    titleStroke: "#cccccc",
    titleTextFill: "#333333",
    keyTextFill: "#334155",
    valueTextFill: "#334155",
    addressTextFill: "#0ea5e9",
    fieldRectFill: "none",
    fieldRectStroke: "#e2e8f0",
    fontSize: "12px",
    titleFontSize: "13px",
    currentFill: "#f0f9ff",
    currentStroke: "#0284c7",
    currentStrokeWidth: 1.5,
    isolatedFill: "#fefce8",
    isolatedStroke: "#ca8a04",
    isolatedStrokeWidth: 1.5,
    isolatedDasharray: "4,4",
    height: 100, // Added default
  };
  const s = { ...defaultConfig, ...styleConfig, ...(nodeSpec.style || {}) };
  const { x, y, address, title, fields, isCurrent, isIsolated } = nodeSpec;
  const fieldCount = fields ? Object.keys(fields).length : 0;
  const fieldsAreaHeight =
    fieldCount * s.fieldHeight +
    (fieldCount > 0 ? (fieldCount - 1) * s.fieldSpacing : 0);
  const nodeHeight =
    s.headerHeight +
    (fieldCount > 0 ? s.padding * 2 + fieldsAreaHeight : s.padding);
  const nodeGroup = group
    .append("g")
    .attr("class", `generic-node ${address}`)
    .attr("transform", `translate(${x}, ${y})`);
  nodeGroup
    .append("rect")
    .attr("class", "node-body")
    .attr("width", s.width)
    .attr("height", nodeHeight)
    .attr(
      "fill",
      isCurrent ? s.currentFill : isIsolated ? s.isolatedFill : s.fill
    )
    .attr(
      "stroke",
      isCurrent ? s.currentStroke : isIsolated ? s.isolatedStroke : s.stroke
    )
    .attr(
      "stroke-width",
      isCurrent ? s.currentStrokeWidth : isIsolated ? s.isolatedStrokeWidth : 1
    )
    .attr("stroke-dasharray", isIsolated ? s.isolatedDasharray : "none")
    .attr("rx", 5);
  nodeGroup
    .append("rect")
    .attr("class", "node-header-bg")
    .attr("width", s.width)
    .attr("height", s.headerHeight)
    .attr(
      "fill",
      isCurrent ? s.currentStroke : isIsolated ? s.isolatedStroke : s.titleFill
    )
    .attr(
      "fill-opacity",
      isCurrent || isIsolated
        ? 0.3
        : s.titleFillOpacity !== undefined
        ? s.titleFillOpacity
        : 1
    )
    .attr("stroke", "none")
    .attr("rx", 5)
    .attr("ry", 0);
  nodeGroup
    .append("text")
    .attr("class", "node-title")
    .attr("x", s.width / 2)
    .attr("y", s.headerHeight / 2 + parseFloat(s.titleFontSize) / 3)
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .attr("font-size", s.titleFontSize)
    .attr("fill", s.titleTextFill)
    .text(title || truncateAddress(address)); // Use truncateAddress from this file
  if (fieldCount > 0) {
    nodeGroup
      .append("line")
      .attr("class", "header-divider")
      .attr("x1", 0)
      .attr("y1", s.headerHeight)
      .attr("x2", s.width)
      .attr("y2", s.headerHeight)
      .attr("stroke", s.titleStroke || s.stroke)
      .attr("stroke-width", 0.5);
  }
  if (fields && fieldCount > 0) {
    let fieldCurrentYOffset = s.headerHeight + s.padding;
    console.log(
      `[renderGenericNode] Node ${nodeSpec?.address}: Processing ${fieldCount} fields...`
    );
    Object.entries(fields).forEach(([key, value]) => {
      const fieldGroup = nodeGroup
        .append("g")
        .attr("class", `node-field-group-${key}`);
      const fieldY = fieldCurrentYOffset;
      if (s.fieldRectFill !== "none" || s.fieldRectStroke !== "none") {
        fieldGroup
          .append("rect")
          .attr("class", "field-bg")
          .attr("x", s.padding / 2)
          .attr(
            "y",
            fieldY - s.fieldHeight / 2 - s.padding / 2 + s.fieldHeight / 2
          )
          .attr("width", s.width - s.padding)
          .attr("height", s.fieldHeight)
          .attr(
            "fill",
            s.fieldRectFill === "none" ? "transparent" : s.fieldRectFill
          )
          .attr(
            "stroke",
            s.fieldRectStroke === "none" ? "transparent" : s.fieldRectStroke
          )
          .attr("stroke-width", 0.5)
          .attr("rx", 3);
      }
      fieldGroup
        .append("text")
        .attr("class", "field-key")
        .attr("x", s.padding)
        .attr("y", fieldY + s.fieldHeight / 2 - parseFloat(s.fontSize) / 3 + 2)
        .attr("font-size", s.fontSize)
        .attr("font-weight", "bold")
        .attr("fill", s.keyTextFill)
        .text(`${key}:`);
      const stringValue = String(value);
      const isAddr = isAddress(stringValue); // Use isAddress from this file
      fieldGroup
        .append("text")
        .attr("class", "field-value")
        .attr("x", s.width - s.padding)
        .attr("y", fieldY + s.fieldHeight / 2 - parseFloat(s.fontSize) / 3 + 2)
        .attr("text-anchor", "end")
        .attr("font-size", s.fontSize)
        .attr("font-weight", isAddr ? "bold" : "normal")
        .attr("fill", isAddr ? s.addressTextFill : s.valueTextFill)
        .text(truncateAddress(stringValue)); // Use truncateAddress from this file
      fieldCurrentYOffset += s.fieldHeight + s.fieldSpacing;
    });
    console.log(
      `[renderGenericNode] Node ${nodeSpec?.address}: FINISHED processing fields.`
    );
  }
  if (positionsMap && address) {
    positionsMap[address] = { x: x, y: y, width: s.width, height: nodeHeight };
  } else if (!address) {
    console.warn(
      "renderGenericNode called without an address in nodeSpec. Position not stored."
    );
  }
  console.log(`[renderGenericNode] END processing node: ${nodeSpec?.address}`);
};

// Helper function to show a not implemented message
export const showNotImplementedMessage = (
  contentGroup,
  width,
  height,
  message,
  xPosition,
  yPosition
) => {
  const displayX = xPosition !== undefined ? xPosition : width / 2;
  const displayY = yPosition !== undefined ? yPosition : height / 2;
  contentGroup
    .append("text")
    .attr("class", "not-implemented-message")
    .attr("x", displayX)
    .attr("y", displayY)
    .attr("text-anchor", xPosition !== undefined ? "start" : "middle")
    .attr("font-size", "14px")
    .attr("fill", "#475569")
    .text(`Visualization not implemented for: ${message}`);
};

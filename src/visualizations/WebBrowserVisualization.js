import {
  defineArrowheads,
  renderGenericNode,
  generateCurvedPath,
  isAddress,
  truncateAddress,
  // Add any other utilities needed from visualizationUtils
} from "../utils/visualizationUtils";

export const renderWebBrowserVisualization = (
  contentGroup,
  width,
  height,
  operation,
  memorySnapshot
) => {
  console.log(
    "TOP OF renderWebBrowserVisualization. Op:",
    operation,
    "Snap:",
    memorySnapshot
  );

  const state = memorySnapshot || operation.state || {}; // Prioritize snapshot
  const backStack = state.backStack || []; // Example: { stack: [], top: -1 }
  const forwardStack = state.forwardStack || []; // Example: { stack: [], top: -1 }
  const currentPage = state.currentPage || {
    url: "empty",
    title: "Empty Page",
  };

  // Define styles for web browser visualization
  const styles = {
    node: {
      width: 200,
      headerHeight: 25,
      fieldHeight: 20, // Smaller fields for URL/title
      fieldSpacing: 3,
      padding: 8,
      fill: "#eef2ff", // Light indigo
      stroke: "#a5b4fc", // Indigo
      titleFill: "#a5b4fc",
      titleStroke: "#a5b4fc",
      titleTextFill: "#3730a3", // Dark indigo
      keyTextFill: "#4338ca",
      valueTextFill: "#4f46e5",
      addressTextFill: "#6366f1",
      fontSize: "11px",
      titleFontSize: "12px",
    },
    stackLabel: {
      fontSize: "14px",
      fill: "#475569",
      fontWeight: "bold",
    },
    connection: {
      strokeWidth: 1.5,
      defaultColor: "#6b7280", // Gray
      cornerRadius: 8,
      markerId: "browser-nav-arrow",
    },
    layout: {
      stackSpacingX: 250, // Horizontal space between back/current/forward
      stackItemSpacingY: 10, // Vertical space between items in a stack
      topMargin: 50,
      horizontalPadding: 30,
    },
  };

  // Define Arrowheads
  let defs = contentGroup.select("defs");
  if (defs.empty()) {
    defs = contentGroup.append("defs");
  }
  defineArrowheads(defs, styles); // You might need a specific arrowhead

  const nodePositions = {}; // To store positions if needed for complex connections

  const centerX = width / 2;
  const backStackX = centerX - styles.layout.stackSpacingX;
  const forwardStackX = centerX + styles.layout.stackSpacingX;
  let currentY = styles.layout.topMargin;

  // Helper to render a stack (back or forward)
  const renderStack = (stackName, stackObject, startX, startY, isBackStack) => {
    let yOffset = startY;
    contentGroup
      .append("text")
      .attr("x", startX + styles.node.width / 2)
      .attr("y", yOffset - 15)
      .attr("text-anchor", "middle")
      .attr("fill", styles.stackLabel.fill)
      .style("font-size", styles.stackLabel.fontSize)
      .style("font-weight", styles.stackLabel.fontWeight)
      .text(stackName);

    yOffset += 20; // Space after label

    const stackArray = stackObject.stack || [];
    const topIndex = stackObject.top === undefined ? -1 : stackObject.top;
    let maxStackHeight = 0;

    // In back stack, items are typically pushed, so top is last.
    // In forward stack, after navigating back, items are also pushed.
    // We display them visually from bottom (oldest) to top (newest accessible).
    const displayItems = isBackStack
      ? stackArray.slice(0, topIndex + 1).reverse() // Show accessible items, newest at top
      : stackArray.slice(0, topIndex + 1).reverse();

    displayItems.forEach((item, visualIndex) => {
      if (!item || typeof item !== "object") {
        console.warn(`Invalid item in ${stackName}:`, item);
        return;
      }
      const nodeSpec = {
        x: startX,
        y: yOffset,
        address: item.url || `stack-${stackName}-${visualIndex}`,
        title: item.title || truncateAddress(item.url, 20),
        fields: { URL: item.url || "N/A" },
        style: styles.node,
      };
      renderGenericNode(
        contentGroup,
        nodeSpec,
        styles.node,
        nodePositions,
        isAddress,
        truncateAddress
      );
      yOffset += styles.node.height + styles.layout.stackItemSpacingY;
      maxStackHeight = yOffset;
    });
    return maxStackHeight > startY + 20 ? maxStackHeight - (startY + 20) : 0;
  };

  // Render Back Stack
  const backStackHeight = renderStack(
    "Back Stack",
    backStack,
    backStackX,
    currentY,
    true
  );

  // Render Current Page
  contentGroup
    .append("text")
    .attr("x", centerX)
    .attr("y", currentY - 15)
    .attr("text-anchor", "middle")
    .attr("fill", styles.stackLabel.fill)
    .style("font-size", styles.stackLabel.fontSize)
    .style("font-weight", styles.stackLabel.fontWeight)
    .text("Current Page");

  const currentPageSpec = {
    x: centerX - styles.node.width / 2,
    y: currentY + 20, // Space after label
    address: currentPage.url || "current-page",
    title: currentPage.title || truncateAddress(currentPage.url, 20),
    fields: { URL: currentPage.url || "N/A" },
    style: styles.node,
  };
  renderGenericNode(
    contentGroup,
    currentPageSpec,
    styles.node,
    nodePositions,
    isAddress,
    truncateAddress
  );
  const currentPageHeight = styles.node.height + 20;

  // Render Forward Stack
  const forwardStackHeight = renderStack(
    "Forward Stack",
    forwardStack,
    forwardStackX,
    currentY,
    false
  );

  // Placeholder for connections if needed (e.g., if stacks point to page objects by address)
  // const connectionsGroup = contentGroup.append("g").attr("class", "connections-group");

  console.log(
    "Finished Web Browser Visualization render. Node Positions:",
    nodePositions
  );
  // Adjust overall SVG height if necessary, though typically fixed for this viz
  // const maxHeight = Math.max(backStackHeight, currentPageHeight, forwardStackHeight) + styles.layout.topMargin;
  // svg.attr("height", maxHeight + 20);
};

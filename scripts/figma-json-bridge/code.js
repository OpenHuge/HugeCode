const JSON_EXPORT_SETTINGS = {
  format: "JSON_REST_V1",
};

const PNG_EXPORT_SETTINGS = {
  format: "PNG",
  constraint: { type: "SCALE", value: 2 },
};

const SVG_EXPORT_SETTINGS = {
  format: "SVG_STRING",
};

const WINDOW_OPTIONS = {
  width: 460,
  height: 760,
  title: "Local Figma Bridge",
};

const FIGMA_CODEGEN_MAP_PREFIX = "window.__HYPECODE_FIGMA_CODEGEN_MAP__ = ";
const figmaCodegenMapSource = __uiFiles__.figmaCodegenMap;

function injectCodegenMapIntoUi(uiMarkup, mapSource) {
  if (typeof mapSource !== "string" || !mapSource.startsWith(FIGMA_CODEGEN_MAP_PREFIX)) {
    throw new Error("Generated figmaCodegenMap UI asset is missing or malformed.");
  }

  const scriptTag = `<script>${mapSource}</script>`;
  if (uiMarkup.includes("</head>")) {
    return uiMarkup.replace("</head>", `  ${scriptTag}\n  </head>`);
  }

  return `${scriptTag}\n${uiMarkup}`;
}

figma.showUI(injectCodegenMapIntoUi(__uiFiles__.main, figmaCodegenMapSource), WINDOW_OPTIONS);

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function requireSingleSelection() {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) {
    throw new Error("Select exactly one node before exporting.");
  }

  return selection[0];
}

function normalizeNodeId(value) {
  return value.replace(/-/gu, ":");
}

function parseTarget(rawValue) {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.includes("figma.com/")) {
    const url = new URL(trimmed);
    const urlNodeId = url.searchParams.get("node-id");
    if (!urlNodeId) {
      throw new Error("Figma URL did not contain a node-id query parameter.");
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const designIndex = segments.findIndex((segment) => segment === "design");
    const fileKey = designIndex >= 0 ? (segments[designIndex + 1] ?? null) : null;

    return {
      raw: trimmed,
      nodeId: normalizeNodeId(urlNodeId),
      fileKey,
    };
  }

  return {
    raw: trimmed,
    nodeId: normalizeNodeId(trimmed),
    fileKey: null,
  };
}

async function resolveExportNode(target) {
  if (!target) {
    return requireSingleSelection();
  }

  if (target.fileKey && figma.fileKey && target.fileKey !== figma.fileKey) {
    throw new Error(
      `Open the matching Figma file first. Current file key is ${figma.fileKey}, target file key is ${target.fileKey}.`
    );
  }

  const node = await figma.getNodeByIdAsync(target.nodeId);
  if (!node) {
    throw new Error(`Node ${target.nodeId} was not found in the current file.`);
  }

  if (typeof node.exportAsync !== "function") {
    throw new Error(`Node ${target.nodeId} does not support exportAsync.`);
  }

  return node;
}

function buildSuggestedFileName(node) {
  const safeName =
    node.name
      .trim()
      .replace(/[^a-z0-9]+/giu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 48) || "figma-node";

  return `${safeName}-${node.id.replace(/:/gu, "-")}.json`;
}

async function exportSelection(rawTarget) {
  try {
    const target = typeof rawTarget === "string" ? parseTarget(rawTarget) : null;
    const node = await resolveExportNode(target);
    const [json, pngBytes, svgString] = await Promise.all([
      node.exportAsync(JSON_EXPORT_SETTINGS),
      node.exportAsync(PNG_EXPORT_SETTINGS),
      node.exportAsync(SVG_EXPORT_SETTINGS),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      fileKey: figma.fileKey ?? null,
      currentPage: {
        id: figma.currentPage.id,
        name: figma.currentPage.name,
      },
      selection: {
        id: node.id,
        name: node.name,
        type: node.type,
      },
      requestedTarget: target,
      document: json,
      resources: {
        pngBase64: figma.base64Encode(pngBytes),
        svgString,
      },
    };

    figma.ui.postMessage({
      type: "export-ready",
      payload,
      suggestedFileName: buildSuggestedFileName(node),
    });
    figma.notify(`Exported ${node.name}`);
  } catch (error) {
    const message = getErrorMessage(error);
    figma.ui.postMessage({
      type: "export-error",
      message,
    });
    figma.notify(message, { error: true });
  }
}

function collectAliasIds(value, aliasIds) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectAliasIds(item, aliasIds);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  if (value.type === "VARIABLE_ALIAS") {
    const aliasId =
      typeof value.id === "string"
        ? value.id
        : typeof value.variableId === "string"
          ? value.variableId
          : null;
    if (aliasId) {
      aliasIds.add(aliasId);
    }
    return;
  }

  for (const nestedValue of Object.values(value)) {
    collectAliasIds(nestedValue, aliasIds);
  }
}

async function readSelectionCodegenState(selectedNode) {
  if (!selectedNode) {
    return {
      bindings: [],
      message: "Select exactly one node to inspect bound variables.",
    };
  }

  const aliasIds = new Set();
  collectAliasIds(selectedNode.boundVariables ?? null, aliasIds);

  if (aliasIds.size === 0) {
    return {
      bindings: [],
      message: "No bound Figma variables were found on the current selection.",
    };
  }

  const bindings = (
    await Promise.all(
      [...aliasIds].map(async (aliasId) => {
        try {
          const variable = await figma.variables.getVariableByIdAsync(aliasId);
          if (!variable) {
            return {
              id: aliasId,
              name: null,
              resolvedType: null,
              collectionId: null,
              scopes: [],
              missing: true,
            };
          }

          return {
            id: aliasId,
            name: variable.name,
            resolvedType: variable.resolvedType,
            collectionId: variable.variableCollectionId ?? null,
            scopes: Array.isArray(variable.scopes) ? variable.scopes : [],
            missing: false,
          };
        } catch (error) {
          return {
            id: aliasId,
            name: null,
            resolvedType: null,
            collectionId: null,
            scopes: [],
            missing: true,
            error: getErrorMessage(error),
          };
        }
      })
    )
  ).sort((left, right) => {
    const leftName = left.name ?? left.id;
    const rightName = right.name ?? right.id;
    return leftName.localeCompare(rightName);
  });

  return {
    bindings,
    message: `Found ${bindings.length} bound variable${bindings.length === 1 ? "" : "s"}.`,
  };
}

async function postSelectionState() {
  const selection = figma.currentPage.selection;
  const selectedNode = selection.length === 1 ? selection[0] : null;
  const codegenState = await readSelectionCodegenState(selectedNode);

  figma.ui.postMessage({
    type: "selection-state",
    fileKey: figma.fileKey ?? null,
    selectionCount: selection.length,
    selection: selectedNode
      ? {
          id: selectedNode.id,
          name: selectedNode.name,
          type: selectedNode.type,
        }
      : null,
    codegenState,
  });
}

figma.ui.onmessage = async (message) => {
  if (!message || typeof message !== "object") {
    return;
  }

  switch (message.type) {
    case "export-selection":
      await exportSelection(typeof message.target === "string" ? message.target : "");
      break;
    case "refresh-selection":
      await postSelectionState();
      break;
    case "close":
      figma.closePlugin();
      break;
    default:
      break;
  }
};

figma.on("selectionchange", () => {
  void postSelectionState();
});

void postSelectionState();

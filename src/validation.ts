import {
  type AnyCell,
  type MapCell,
  type SheetProxy,
  reduce
} from "@okcontract/cells";

import {
  type EditorNode,
  isArrayNode,
  isDictNode,
  isObjectNode
} from "./groups";

export type ValidationCells = MapCell<MapCell<Error | null, false>[], false>;

// @todo collect at each level
export const extractValidCells = (
  proxy: SheetProxy,
  rootNode: AnyCell<EditorNode>
): ValidationCells => {
  const traverse = (
    node: AnyCell<EditorNode>
  ): MapCell<MapCell<Error | null, false>[], false> =>
    proxy.map([node], (node) => {
      const validCell = node.valid ? [node.valid] : [];

      if (isArrayNode(node)) {
        return proxy.map([node.array], (arrayNodes) => {
          const sub = arrayNodes.map(traverse);
          return proxy.mapNoPrevious(
            sub,
            (...cells) => validCell.concat(...cells),
            `flat:${node.id}`
          );
        });
      }

      if (isDictNode(node)) {
        return proxy.map([node.dict], (dictNodes) => {
          const sub = Object.values(dictNodes).map((node) => traverse(node));
          return proxy.mapNoPrevious(
            sub,
            (...cells) => validCell.concat(...cells),
            `flat:${node.id}`
          );
        });
      }

      if (isObjectNode(node)) {
        return proxy.map([node.object], (objectNodes) => {
          const sub = Object.values(objectNodes).map((node) => traverse(node));
          return proxy.mapNoPrevious(
            sub,
            (...cells) => validCell.concat(...cells),
            `flat:${node.id}`
          );
        });
      }

      // Leaf
      return proxy.new(validCell, "vc");
    });

  return traverse(rootNode);
};

export const isValid = (proxy: SheetProxy, l: ValidationCells) =>
  reduce(proxy, l, (acc, elt) => acc && elt === null, true, "isValid");

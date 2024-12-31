import { produce } from "immer";

import {
  type AnyCell,
  type CellArray,
  type CellObject,
  type MapCell,
  type SheetProxy,
  type ValueCell,
  collector,
  delayed
} from "@okcontract/cells";
import type { Environment } from "@okcontract/lambdascript";

import { map2ObjectsMixed, mapArray, mapObject } from "./map";
import {
  type GroupDefinition,
  type Key,
  type LabelledTypeDefinition,
  MiscGroup,
  MiscGroupID,
  type Path,
  type TypeDefinitionFn,
  type TypeScheme
} from "./types";
import { requiresValidation, validateOrFail } from "./validator";

const DEV = false;

export type NodeArray = {
  array: MapCell<MapCell<EditorNode, false>[], false>;
  page?: number;
};
export type NodeDict = {
  dict: AnyCell<{ [key in string]: AnyCell<EditorNode> }>;
};
export type NodeObject = {
  object: MapCell<Record<string, AnyCell<EditorNode>>, false>;
};

export type BaseNode = {
  id: string; // @todo move `id` to specialized node types?
  key?: Key;
  path: Path;
  undefined?: boolean;
  original: number | undefined;
  value?: number; // AnyCell<unknown>;
  parent: number | null; // AnyCell<unknown>;
  // @todo definition should be a Cell?
  definition: AnyCell<LabelledTypeDefinition>;
  group?: string;
  valid?: MapCell<Error | null, false>;
  rank?: number;
};

export type Leaf = {
  id: string;
};

// @todo Node<NodeType>
export type EditorNode = BaseNode & (NodeArray | NodeDict | NodeObject | Leaf);

export type EditorGroup = [GroupDefinition, EditorNode[], EditorNode[]];

export const isObjectNode = (node: EditorNode): node is BaseNode & NodeObject =>
  node && "object" in node;

export const isArrayNode = (node: EditorNode): node is BaseNode & NodeArray =>
  node && "array" in node;

export const isDictNode = (node: EditorNode): node is BaseNode & NodeDict =>
  node && "dict" in node;

// clearNode collects cells within a deleted node.
const clearNode = (proxy: SheetProxy, node: EditorNode) => {
  // console.log({ remove: node });
  // We collect the value.
  if (node.value !== undefined) proxy._sheet.collect(node.value);
  // And the valid status cell if present.
  if (node.valid !== undefined) proxy._sheet.collect(node.valid);
};

const preserve = (
  a: LabelledTypeDefinition,
  b: LabelledTypeDefinition
): LabelledTypeDefinition => ({
  ...b,
  // force the original group if present
  gr: "gr" in a ? a.gr : "gr" in b ? b.gr : undefined,
  // force the original label if present
  label: "label" in a ? a.label : "label" in b ? b.label : undefined,
  // force the original options if present
  options: "options" in a ? a.options : "options" in b ? b.options : undefined,
  // force the original optional if present
  optional:
    "optional" in a ? a.optional : "optional" in b ? b.optional : undefined
});

/**
 * dataTree builds an editor tree for the given data and schema.
 * @todo types are not reactive
 */
export const dataTree = (
  proxy: SheetProxy,
  value: AnyCell<unknown>,
  schema: TypeScheme, // @todo AnyCell
  env: Environment = undefined,
  options: { name?: string } = {} // @todo
) => {
  // fresh counter for Groups
  let fresh = 0;
  const newId = (where: string) => {
    fresh++;
    DEV && console.log(`NODE=${fresh}: ${where}`);
    return `node:${fresh}`;
  };
  // const _schema = schema.value as TypeScheme;

  // @todo reuse previous tree on types change?
  return proxy.map(
    [schema.types],
    (types) => {
      DEV && console.log("NODE= SCHEMA");
      const d = (msg: string, v: unknown) =>
        DEV && proxy._sheet.debug(undefined, msg, v);

      // console.log("dataTree", { value, schema });
      // @todo map2Objects should accept undefined cells
      // const emptyLTD = proxy.new({} as MapTypeDefinitions, "emptyLTD");

      // @todo reactive on types
      // const types = _schema.types.value;
      // if (types instanceof Error) throw types;

      /**
       * previewType resolves type names without reactivity.
       * This is an initial type resolution, looking for name, label, gr, etc.
       * None of these properties should change within a definition as there will
       * be no reactivity on them.
       * @warning not reactive, we expect all type definitions to be defined before runtime.
       */
      const previewType = async (
        pt: LabelledTypeDefinition | Promise<LabelledTypeDefinition>,
        node: EditorNode,
        // v: unknown,
        _caller?: string
      ): Promise<LabelledTypeDefinition> => {
        const ty = await pt;
        // d("previewType", { caller, ty });
        if ("name" in ty && ty?.name) {
          if (!types?.[ty.name]) throw new Error(`unknown type: ${ty.name}`);
          const rt = types[ty.name];
          if (rt instanceof Error) throw rt;
          const named = rt(node, env, "preview");
          // Preserve the group, and optionally the label.
          return preserve(ty, await named.get());
        }
        return ty;
      };

      const resolveType = (
        td: AnyCell<LabelledTypeDefinition>,
        node: EditorNode,
        label?: string
      ): MapCell<LabelledTypeDefinition, false> => {
        const coll = collector<MapCell<LabelledTypeDefinition, false>>(proxy);
        return proxy.map(
          [td],
          (ty) => {
            if ("name" in ty && ty?.name) {
              // console.log({ name: ty.name });
              if (!types?.[ty.name])
                // console.error("NOT FOUND");
                throw new Error(`unknown type: ${ty.name}`);
              const rt = types[ty.name];
              // console.log({ rt, node: node.id });
              // Preserve the group, and optionally the label.
              const named = rt(node, env, "named");
              return coll(
                proxy.map(
                  [named],
                  (_named) => {
                    // console.log({ _named });
                    // @todo override label?
                    return preserve(ty, _named);
                  },
                  `resolve:${ty.name}`
                )
              );
            }
            return coll(
              td.map(
                (_ty) => ({ ..._ty, label: label ? label : _ty.label }),
                `resolve:${node.id}`
              )
            );
          },
          `resolveType:${node.id}`
        );
      };

      // @todo always ValueCell?
      const getLensID = async (
        _def: LabelledTypeDefinition,
        v: AnyCell<unknown>
      ) => {
        const rt = await previewType(_def, null, "lensed");
        if (rt && "lens" in rt) {
          const lens = rt.lens(v, rt?.options);
          if (lens) return lens.id;
        }
        return v.id;
      };

      const dataTreeAux = async (
        v: AnyCell<unknown>,
        node: BaseNode,
        from?: string
      ): Promise<EditorNode> => {
        d(`NODE= aux:${node.path.join(".")} ${from}`, v);

        // We don't recompute existing paths as they should be reactive on
        // both value and type definition.

        // We have to resolve the `TypeDefinition` without the value first to
        // determine the main case (e.g. object/array/dict). Although allowed
        // by the type, we should never have a definition that returns a different
        // case type or lens depending on the value.
        const _def = await previewType(
          await node.definition.consolidatedValue,
          node
        );
        const lensedID = await getLensID(_def, v);
        const lensed = proxy._sheet.get(lensedID); // no pointer
        // proxy.get(lensedID); // pointer

        const shouldValidate = requiresValidation(_def);
        const valid = shouldValidate
          ? lensed.map(
              (v) => validateOrFail(_def, v),
              `valid.${node.path.join(".")}`
            )
          : undefined;

        // DEV && d("lensed", { lensedID, lensed });

        // @todo Now we merely follow the definition.
        // This check will be performed only once as we don't recompute nodes.
        // _lensed can not change type during the life of the editor.

        // === ARRAY ===
        if ("array" in _def) {
          const array = mapArray(
            proxy,
            lensed as CellArray<unknown>,
            async (_lensed, i, cell): Promise<EditorNode> => {
              // @todo this is redundant with the code in ObjectArrayEdit
              // @todo react on value changes?
              const childNode = {
                id: newId(`[${i}] - value:${cell.id} parent:${lensed.id}`),
                key: i,
                parent: lensed.id,
                value: cell.id,
                group: node.group,
                path: [...node.path, i]
              } as EditorNode;
              // @todo may resolveType should take TypeDefinitionFn?
              const childDef = resolveType(
                _def.array(childNode, env, "childDef.array"),
                childNode
              );
              return dataTreeAux(
                cell as ValueCell<unknown>,
                { ...childNode, definition: childDef },
                "mapArray"
              );
            },
            // @todo options: onRemove = clearNode
            { name: `aux:array.${node.path.join(".")}` }
          );

          return {
            ...node,
            id: newId("[]"),
            value: lensed.id,
            original: node.value,
            array,
            valid
          };
        }

        // === DICT ===
        if ("dict" in _def) {
          // const definition = node.definition.map((_def) =>
          //   "dict" in _def ? { label: _def.label, ..._def.dict } : null
          // );
          const dict: MapCell<
            Record<string, AnyCell<EditorNode>>,
            false
          > = mapObject(
            proxy,
            lensed as CellObject<unknown>,
            async (key, _value, cell): Promise<EditorNode> => {
              const childNode = {
                id: newId(`{${key}}`),
                key,
                parent: lensed.id,
                value: cell.id,
                group: node.group,
                path: [...node.path, key]
              } as BaseNode;
              const childDef = resolveType(
                _def.dict(childNode, env, "childDef.dict"),
                childNode,
                _def.label
              );
              return dataTreeAux(
                cell as ValueCell<unknown>,
                { ...childNode, definition: childDef },
                "dict"
              );
            },
            // @todo options: onRemove = clearNode
            { name: `${node.path.join(".")}.{}` }
          );
          return {
            ...node,
            id: newId("dict"),
            value: lensed.id,
            dict,
            valid,
            original: node.value
          };
        }

        // === OBJECT ===
        if ("object" in _def) {
          const dual = map2ObjectsMixed(
            proxy,
            _def?.object,
            lensed as CellObject<unknown>,
            <T>(
              key: Key,
              def: TypeDefinitionFn,
              fieldCell: ValueCell<T> | undefined
            ): MapCell<EditorNode, false> => {
              // @todo collector should be done by map2ObjectsMixed
              if (!fieldCell) {
                const childNode = {
                  id: newId(`::${key} - value: undefined`),
                  key,
                  parent: lensed.id,
                  path: [...node.path, key],
                  undefined: true
                } as EditorNode;
                // @todo also collect childDef
                const childDef = def(childNode, env, "childDef.object.null");

                // No recursion, we stop here.
                return proxy.map(
                  [childDef],
                  (cd, prev) =>
                    // All values should be reactive and this function should not
                    // be called more than once.
                    (prev !== undefined && prev) ||
                    ({
                      ...childNode,
                      definition: resolveType(childDef, childNode),
                      group: "gr" in cd ? cd.gr : MiscGroupID,
                      rank: "rank" in cd ? cd.rank : undefined
                      // here: 1
                    } as EditorNode),
                  `dual.null[${key}]`
                );
              }
              return proxy.map(
                [fieldCell],
                async (_field, prev): Promise<EditorNode> => {
                  // All values should be reactive and this function should not be called more than once.
                  if (prev !== undefined && !prev?.undefined) return prev;

                  const childNode = {
                    id: newId(`::${key} - value:${fieldCell?.id}`),
                    key,
                    parent: lensed.id,
                    value: fieldCell.id,
                    path: [...node.path, key]
                  } as BaseNode;
                  const childDef = def(childNode, env, "childDef.object");
                  return dataTreeAux(
                    fieldCell,
                    {
                      ...childNode,
                      definition: resolveType(childDef, childNode),
                      // @todo not reactive. switch to cell? (for reordering, etc.)
                      group:
                        childDef?.value && "gr" in childDef.value
                          ? childDef?.value?.gr
                          : MiscGroupID
                      // here: 2
                    },
                    "field"
                  );
                },
                `dual[${key}]`
              );
            },
            {
              name: "dual",
              skipAUndefined: true,
              onRemove: (node) => clearNode(proxy, node)
            }
          );

          DEV &&
            dual.subscribe((d) =>
              console.log({ ID: dual.id, DUAL: d, path: node.path })
            );

          // @todo BaseNodeWithoutDefinition
          const objNode = {
            ...node,
            id: newId("{}"),
            original: node.value,
            value: lensed.id,
            object: dual,
            valid
          } as BaseNode;
          return {
            ...objNode,
            definition: resolveType(node.definition, objNode)
          };
        }

        // === LEAF ===

        // We update the value with a potential lens applied, and add the
        // validation cell.
        return { ...node, value: lensed.id, original: node.value, valid };
      };

      return dataTreeAux(
        value,
        {
          id: newId("root"),
          path: [],
          definition: schema.values,
          original: value.id,
          value: value.id,
          parent: null
        },
        "root"
      ) as unknown as BaseNode & NodeObject;
    },
    options?.name || "dataTree"
  );
};

export type IndexGroups = [GroupDefinition[], { [k: string]: number }];

export const groupsIndex = (_schema: TypeScheme) => {
  // @todo reactive on groups
  const groups = [
    ...(_schema?.gs?.value instanceof Error ? [] : _schema?.gs?.value || [])
      .map((v) => (v.value instanceof Error ? undefined : v.value))
      .filter((v) => v !== undefined),
    MiscGroup
  ];
  const groupsIndex = Object.fromEntries(groups.map((gr, i) => [gr.id, i]));
  // d("groups", { groups, groupsIndex });
  return [groups, groupsIndex] as IndexGroups;
};

/**
 * reduce a Record, then call finalize function.
 * @param proxy
 * @param obj
 * @param fn
 * @param init
 * @returns reduced cell
 */
export const reduce = <T, Int, Ret, NF extends boolean = false>(
  proxy: SheetProxy,
  obj: MapCell<Record<string, AnyCell<T>>, false>,
  fn: (acc: Int, elt: T, index: number) => Int,
  init: Int,
  finalize: (res: Int) => Ret,
  name = "reduce",
  nf?: NF
): MapCell<Ret, NF> => {
  const coll = collector<MapCell<Ret, NF>>(proxy);
  return proxy.mapNoPrevious(
    [obj],
    async (cells) =>
      delayed(
        coll(
          proxy.mapNoPrevious(
            Object.values(cells),
            (..._cells) => finalize(_cells.reduce(fn, init)),
            `_${name}`
          )
        ),
        5
      ),
    `${name}`,
    nf
  );
};

export const objectNodeGroups = (
  proxy: SheetProxy,
  [groups, groupsIndex]: IndexGroups,
  node: BaseNode & NodeObject,
  name = ""
) =>
  reduce(
    proxy,
    node.object,
    (acc, field) =>
      produce(acc, (draft) => {
        const idx = groupsIndex[field.group];
        draft[idx === undefined ? groupsIndex[MiscGroupID] : idx][1].push(
          // @ts-expect-error enum fields are read-only
          field
        );
      }),
    // @todo BaseNode & Leaf
    groups.map((gr) => [gr, []]) as [GroupDefinition, EditorNode[]][],
    // filter empty groups and split undefined nodes at last step
    (l) =>
      // filter empty groups
      l
        .filter(([_gr, nodes]) => nodes?.length)
        // split undefined nodes
        .map(
          ([gr, l]) =>
            [
              gr,
              l.filter((node) => node?.value !== undefined),
              l.filter((node) => node?.value === undefined)
            ] as EditorGroup
        ),
    `sorted:${name}:${node.path.join(".")}`
  );

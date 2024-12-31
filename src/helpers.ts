import {
  type AnyCell,
  Cell,
  type CellArray,
  type SheetProxy,
  type ValueCell
} from "@okcontract/cells";

import type {
  GroupDefinition,
  LabelledTypeDefinition,
  MapTypeDefinitions,
  TypeDefinitionFn,
  TypeScheme
} from "./types";

export const newGroups = (
  proxy: SheetProxy,
  l: GroupDefinition[],
  name = "gs"
): CellArray<GroupDefinition> =>
  proxy.new(l.map((g) => proxy.new(g, `gs.${g.id}`), name));

export const mainGroup = (proxy: SheetProxy) =>
  newGroups(proxy, [{ id: "main", l: "Main" }]);

/**
 * newSchema creates a schema from given values, other parameters being optional.
 * @param proxy
 * @param values
 * @param types (optional)
 * @param gs (optional)
 * @param name ("schema" by default)
 * @returns TypeScheme
 */
export const newSchema = (
  proxy: SheetProxy,
  values: AnyCell<LabelledTypeDefinition>,
  types = proxy.new({} as MapTypeDefinitions, "types"),
  gs = mainGroup(proxy),
  name = "schema"
): TypeScheme => ({
  values,
  types,
  gs
});

/**
 * mapTypeDefinitions is a helper that builds standard mapTypeDefinitions
 * that don't rely on (node, env).
 */
export const mapTypeDefinitions = (
  proxy: SheetProxy,
  obj: Record<string, LabelledTypeDefinition | TypeDefinitionFn>,
  name = "mtd"
): ValueCell<MapTypeDefinitions> =>
  proxy.new(
    Object.fromEntries(
      Object.entries(obj).map(([k, ltd]) => [
        k,
        typeof ltd === "function" ? ltd : () => proxy.new(ltd, `${name}.${k}`)
      ])
    ),
    name
  );

/**
 * objectDefinition creates a new object TypeDefinition.
 */
export const objectDefinition = (
  proxy: SheetProxy,
  obj:
    | AnyCell<MapTypeDefinitions>
    | Record<
        string,
        LabelledTypeDefinition | AnyCell<() => LabelledTypeDefinition>
      >,
  label = "root",
  others?: Partial<LabelledTypeDefinition>
): ValueCell<LabelledTypeDefinition> =>
  proxy.new(
    {
      ...others,
      label,
      object:
        obj instanceof Cell
          ? obj
          : mapTypeDefinitions(proxy, obj, `${label}.object`)
    } as LabelledTypeDefinition,
    `def:${label}`
  );

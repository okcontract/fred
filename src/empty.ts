import {
  type AnyCell,
  Cell,
  type SheetProxy,
  asyncReduce,
  cellify
} from "@okcontract/cells";
import { type Environment, Rational, zero } from "@okcontract/lambdascript";
// @todo remove dependency, use extensions
import {
  type Network,
  NewAddress,
  type StringAddress
} from "@okcontract/multichain";

import { evalTypeAux } from "./eval";
import type {
  LabelledTypeDefinition,
  MapTypeDefinitions,
  TypeDefinition
} from "./types";

// @todo move or remove?
export type mergeDataOptions = {
  deep?: boolean;
  oneElementInArray?: boolean;
  skipNestedObject?: boolean;
  env?: Environment;
  key?: string;
  label?: string;
  cellified?: boolean;
};

export const emptyValueOfTypeDefinition = (
  proxy: SheetProxy,
  types: AnyCell<MapTypeDefinitions>,
  ty: AnyCell<LabelledTypeDefinition | TypeDefinition>,
  options: mergeDataOptions = { deep: false, label: "unknown" }
): AnyCell<unknown> => {
  // console.log("emptyValueOfTypeDefinition", { ty });
  return proxy.map(
    [types, ty],
    (_types, _ty) => {
      const v = emptyValueOfTypeDefinitionAux(proxy, _types, _ty, options);
      return options?.cellified ? cellify(proxy, v) : v;
    },
    `emptyValueOfTypeDefinition:${options?.label}`
  );
};

/**
 * from_value generates a λs expression as string matching the JavaScript value.
 * @param v
 * @returns
 * @todo functions are not supported
 */
const from_value = (v: unknown): string => {
  switch (typeof v) {
    case "function":
      throw new Error("unsupported: function");
    case "bigint":
      return v.toString();
    case "string":
      // SECURITY: do it manually?
      return JSON.stringify(v);
    default:
      return `${v}`;
  }
};

/**
 * emptyValueOfTypeDefinitionAux returns a new value without creating cells.
 * It should preferably be used on temporary actions.
 * @todo do we need proxy here?
 */
export const emptyValueOfTypeDefinitionAux = async (
  proxy: SheetProxy,
  types: MapTypeDefinitions,
  ty: LabelledTypeDefinition | TypeDefinition,
  options: mergeDataOptions = { deep: false }
): Promise<unknown> => {
  // console.log("emptyValueOfTypeDefinitionAux", { ty, options });
  if (!ty) return null;
  if ("def" in ty && ty.def !== undefined)
    return typeof ty.def === "function" ? await ty.def() : ty.def;

  if (options?.deep && "optional" in ty && ty.optional) {
    if ("array" in ty) return null;
    return null;
  }

  if ("name" in ty) {
    console.log("missing name", types, ty.name);
    const tyName = types[ty.name];
    if (tyName instanceof Error || typeof tyName !== "function") throw tyName;
    return emptyValueOfTypeDefinitionAux(
      proxy,
      types,
      await tyName().get(), // @todo (node, env)?
      options
    );
  }

  if ("array" in ty) {
    const arrayTy = await ty.array().get();
    if (arrayTy instanceof Error) throw arrayTy;
    if (
      options.oneElementInArray ||
      // @todo remove Rational
      // convert both to bigint to prevent conversion issues
      ("min" in arrayTy &&
        (arrayTy.min instanceof Rational
          ? arrayTy.min.compare(">", zero)
          : // @todo works with bigint too?
            +arrayTy.min > 0))
    ) {
      return [
        await emptyValueOfTypeDefinitionAux(proxy, types, arrayTy, {
          ...options,
          deep: true
        })
      ];
    }

    return [];
  }

  if ("dict" in ty) return {};

  if ("object" in ty) {
    if (options?.skipNestedObject) return {};
    // console.log("object:", { ty });
    const objectTy = await ty.object?.get();
    if (objectTy instanceof Error) throw objectTy;
    return asyncReduce(
      Object.entries(objectTy),
      async (acc, [k, fn]) => {
        const def = await evalTypeAux(
          proxy,
          types,
          await fn().get(),
          undefined,
          false
        );
        const nv = await emptyValueOfTypeDefinitionAux(proxy, types, def, {
          ...options,
          deep: true
        });
        if (nv === null) return acc;
        // do we want to apply TO here ?
        // if ("to" in def) nv = def.to(nv);
        return { ...acc, [k]: nv };
      },
      {}
    );
  }
  if ("enum" in ty) {
    console.log({ enum: ty.enum });
    if (Array.isArray(ty.enum)) {
      return ty.enum[0] instanceof Cell ? ty.enum[0].value : ty.enum[0];
    }
    // @todo error if empty?
    return Object.keys(ty.enum)?.[0] || "";
  }
  if ("any" in ty) return ""; // FIXME: or 0, false, undefined?
  switch (ty.base) {
    case "string":
      // FIXME: if ("isAddress" in ty)
      return "isBinary" in ty && ty.isBinary
        ? "0x"
        : ty?.isAddress
          ? (ty?.def && NewAddress(ty.def as StringAddress<Network>)) ||
            // we return an empty string to better start editing
            ""
          : "isExpr" in ty && ty.isExpr
            ? options.env &&
              options.key &&
              options?.env?.value(options.key) !== undefined
              ? from_value(options?.env?.value(options.key)) // FIXME: λs.print
              : "" // FIXME
            : "";
    case "boolean":
      return false;
    case "date":
      return new Date();
    case "number": {
      return ty?.min || new Rational(0);
    }
  }
};

import type { SheetProxy } from "@okcontract/cells";

import type {
  LabelledTypeDefinition,
  MapTypeDefinitions,
  TypeDefinition,
  TypeScheme
} from "./types";

export const newTypeScheme = (proxy: SheetProxy): TypeScheme => {
  return {
    values: proxy.new({} as LabelledTypeDefinition),
    types: proxy.new({})
  };
};

/**
 * Datatypes defines the possible datatypes at first level.
 */
export const Datatypes = [
  "string",
  "boolean",
  "date",
  "number",
  "array",
  "object",
  "enum",
  "dict"
]; // as const;

const fieldNameRE = /^[A-Za-z_][A-Za-z0-9_]*$/;
/**
 * isFieldName tests if a field name is valid.
 */
export const isFieldName = (field: string) => fieldNameRE.test(field);

/**
 * valueTypes defines the allowed value types given the type scheme.
 * @param sc type scheme
 */
export const valueTypes = (scTypes: MapTypeDefinitions) => {
  return ["string", "number", "date", "boolean", "enum"].concat(
    Object.keys(scTypes)
  );
};

/**
 * typeLabel is a non technical human-readable description of types.
 * @param datatype
 * @todp base type names should be forbidden for a field name...
 */
export const typeLabel = (
  datatype: string // FIXME: "string" | "boolean" | "date" | "number" | "array" | "object"
) => {
  switch (datatype) {
    case "object":
      return "field group";
    case "dict":
      return "dictionary";
    case "string":
      return "text";
    case "boolean":
      return "checkbox";
    case "enum":
      return "value list";
    // case "array":
    //   return "list";
    default:
      return datatype;
  }
};

/**
 * datatypeOf returns the type of a datatype
 * @todo use schema to resolve recursively
 */
export const datatypeOf = (ty: TypeDefinition) => {
  if ("base" in ty) {
    return ty.base;
  }
  if ("array" in ty) {
    return "array";
  }
  if ("dict" in ty) {
    return "dict";
  }
  if ("enum" in ty) {
    return "enum";
  }
  if ("name" in ty) {
    return ty.name;
  }
  return "object";
};

export const stringOfTypeDefinition = (ty: TypeDefinition) => {
  if ("name" in ty) return ty.name.toUpperCase();
  if ("array" in ty) return `${stringOfTypeDefinition(ty.array)}[]`;
  if ("dict" in ty) return `{key: ${stringOfTypeDefinition(ty.dict)}}`;
  if ("object" in ty) {
    const inner = Object.entries(ty.object)
      .map(([k, t]) => `${k}: ${stringOfTypeDefinition(t as TypeDefinition)}`)
      .join(", ");
    return `{${inner}}`;
  }
  if ("enum" in ty)
    return Array.isArray(ty.enum)
      ? ty.enum.map((x) => JSON.stringify(x)).join("|")
      : Object.keys(ty.enum).join("|");
  if ("any" in ty) return "any";
  if ("base" in ty) return ty.base;
  // FIXME: add missing type definitions
  return "type";
};

/**
 * onNewValue is a default callback that updates a schema to add a new value or type.
 * @param schema schema store
 * @param display either "types" or "values"
 * @param name
 * @param label
 * @param ty
 * @param values
 */
export const onNewValue =
  (proxy: SheetProxy, sc: TypeScheme, display: "types" | "values") =>
  async (name: string, label: string, ty: string, values?: string[]) => {
    const scValues = await sc.values.get();
    if (scValues instanceof Error) return scValues;
    const scTypes = await sc.types.get();
    if (scTypes instanceof Error) throw scTypes;
    const root = display === "types" ? scTypes : scValues;
    // do not add if a different case exists
    if (
      Object.keys(root).filter((x) => x.toLowerCase() === name.toLowerCase())
        .length > 0
    ) {
      throw new Error("field already exists");
    }
    switch (ty) {
      case "string":
      case "number":
      case "date":
      case "boolean":
        root[name] = proxy.new(() => ({ base: ty, label }));
        break;
      case "enum":
        root[name] = proxy.new(() => ({ enum: values, label }));
        break;
    }
  };

export type PathError = {
  path: (string | number)[];
  error: { message: string; from: string };
};

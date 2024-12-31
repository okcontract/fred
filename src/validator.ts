import { isAddress, isHex, isStringAddress } from "@okcontract/multichain";

import type { LabelledTypeDefinition } from "./types";

export type Validation = { message?: string };

/**
 * validate verifies for a given definition its validation rules
 * (pattern, validator, optional etc...)
 * @param definition
 * @param value
 * @todo migrate validation to DataEditorLight
 */
export const validate = async (
  definition: LabelledTypeDefinition,
  value: unknown
): Promise<Validation | null> => {
  let error: string;
  // console.log("validate", { definition, value });
  // @todo do we want to skip hidden errors?
  if ("hidden" in definition && definition?.hidden) return null;
  if (definition && "isAddress" in definition) {
    console.log("isAddress", value);
    // @todo check that all addresses are valid
    if (isAddress(value)) return null;
    if (
      typeof value !== "string" ||
      !(isStringAddress(value) || value.startsWith("tok:")) // @todo isToken is an above package...
    )
      return { message: `Invalid address: ${value}` };
  }
  if (definition && "isLoader" in definition && definition.isLoader)
    return null;
  if ("validator" in definition) {
    error = await definition.validator(value);
    if (error) return { message: error };
  }
  if (
    definition &&
    "pattern" in definition &&
    definition.pattern &&
    typeof value === "string"
  ) {
    const is_valid = value
      ? definition.pattern.test(value)
      : !!definition.optional;
    if (!is_valid) return { message: "Invalid value" };
  }
  if (
    definition &&
    "isBinary" in definition &&
    definition.isBinary &&
    !isHex(value)
  )
    return { message: "Must be an hex string" };
  if (
    definition &&
    "min" in definition &&
    (typeof value === "string" || Array.isArray(value)) &&
    // @ts-expect-error @todo remove Rational
    value?.length < definition.min
  )
    return { message: `Length should be >= ${definition.min}` };
  if (
    definition &&
    "max" in definition &&
    (typeof value === "string" || Array.isArray(value)) &&
    // @ts-expect-error @todo remove Rational
    value?.length > definition.max
  )
    return { message: `Length should be <= ${definition.max}` };
  if (
    !("optional" in definition && definition.optional) &&
    !("def" in definition && definition.def) &&
    ((value === undefined &&
      typeof value !== "boolean" &&
      typeof value !== "number") ||
      (Array.isArray(value) && value?.length === 0) ||
      ("object" in definition && !value) ||
      ("dict" in definition && value && !Object.keys(value).length))
  ) {
    return { message: "Please fill in this field" };
  }
  return null;
};

export const requiresValidation = (
  definition: LabelledTypeDefinition
): boolean =>
  definition &&
  ("validator" in definition ||
    ("pattern" in definition && definition.pattern) ||
    ("min" in definition && definition.min) ||
    "max" in definition ||
    !("optional" in definition && definition.optional)) &&
  !(
    // @todo do we want to skip hidden errors?
    (
      "hidden" in definition ||
      ("isLoader" in definition && definition.isLoader)
    )
  );

export const validateOrFail = async (
  definition: LabelledTypeDefinition,
  value: unknown
): Promise<Error | null> => {
  const val = await validate(definition, value);
  if (val?.message) {
    console.log("validateOrFail", value);
    return new Error(val.message);
  }
  return null;
};

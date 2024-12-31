// import type { SvelteComponent } from "svelte";

import type { AnyCell, CellArray } from "@okcontract/cells";
import type { Rational } from "@okcontract/lambdascript";

import type { EditorNode } from "./groups";

// @todo type variables

// import type { SearchType } from "@okcontract/coredata";
type SearchType = string;
// import type { IconName } from "@okcontract/uic";
type IconName = string;
// import type { ButtonStyle } from "@okcontract/uic";
type ButtonStyle = string;

// @todo redundant with cells
export type Key = string | number;
export type Path = Key[];
type Environment = unknown;

export type TypeDefinitionFn = (
  node?: EditorNode,
  env?: Environment,
  where?: string // for debugging
) => AnyCell<LabelledTypeDefinition>;

/**
 * MapTypeDefinitions is a map of keyed type definitions.
 * @todo type the value of self?
 */
export type MapTypeDefinitions = {
  [key: string]: TypeDefinitionFn;
};

/**
 * TypeDefinition defines a type.
 * @description values are supposedly non-null by default
 * @todo base types for link? currency?
 * @todo implement regexp for strings
 * @todo implement long for strings
 * @todo implement unique for arrays
 * @todo implement nullable?
 * @todo implement min,max for array
 * @todo implement min,max for string (length)
 */
export type TypeDefinition = (
  | TypeDefinitionAny
  | TypeDefinitionName
  | TypeDefinitionString
  | TypeDefinitionNumber
  | TypeDefinitionDate
  | TypeDefinitionBoolean
  | TypeDefinitionEnum
  | TypeDefinitionArray
  | TypeDefinitionObject
  | TypeDefinitionDict
) & {
  /**
   * default value, used for emptyValueOfTypeDefinition
   * is applied before the to/from mapping
   * @warning Def bypasses structures (i.e. default value stops applying recursive empty value)
   */
  def?: unknown;
  /** when hidden is true, the value should not be displayed */
  hidden?: boolean;
  /** when optional, the value can be reset to undefined  */
  optional?: boolean;
};

/**
 * TypeDefinitionAny specifies no constraints.
 */
export type TypeDefinitionAny = { any: true };

/**
 * TypeDefinitionName
 */
export type TypeDefinitionName = { label?: string; name: string };

export type TypeDefinitionString = {
  base: "string";
  pl?: string;
  pattern?: RegExp;
  long?: boolean;
  /** minimum length of string */
  min?: number;
  /** maximum length of string */
  max?: number;
  /** is an EVM address */
  isAddress?: boolean;
  /** is a binary */
  isBinary?: boolean;
  /** is a λs expression */
  isExpr?: boolean;
  /** is an uploadable image */
  isImg?: boolean;
  isUrl?: boolean;
  /** is a color picker */
  isColor?: boolean;
  /** is a isLoader
   * @todo still needed?
   **/
  isLoader?: boolean;
  // excludes?: string[];
  /** search type for coredata */
  search?: SearchType;
  /** one click action for address input */
  disableOneClick?: boolean;
  /** optional completion values (but still open) */
  values?: string[];
  /** compact view */
  compact?: boolean;
};

export type TypeDefinitionNumber = {
  base: "number";
  min?: Rational; // min range value
  max?: Rational; // max range value
  isBig?: boolean; // is bigint
  bits?: number; // size
  infinite?: boolean; // MAX
  /**
   * unit definition
   */
  unit?: string;
  decimals?: Rational;
  /** step from <input> */
  step?: number;
};

export type TypeDefinitionDate = {
  base: "date";
  isUnix?: boolean;
  isMs?: boolean;
};

export type TypeDefinitionBoolean = { base: "boolean" };

/**
 * TypeDefinitionEnum
 * @todo generalize renderer for all definitions?
 */
export type TypeDefinitionEnum = {
  /** enum list of options, or list of keys with displayed text */
  enum:
    | readonly string[]
    | { [key: string]: string | { label?: string; icon?: string } };
  // renderer?: (v: string) => (elt: HTMLElement) => SvelteComponent;
};

export type TypeDefinitionArray = {
  /** array element definition */
  array: TypeDefinitionFn;
  /** unique values */
  unique?: boolean;
  /** min length of array */
  min?: number;
  /** max length of array */
  max?: number;
  /** is sortable */
  sort?: boolean;
  /** additive:
   * when set to true, definitions should be merged with other
   * partial definitions and not replaced.
   *
   * Example: preconditions are added in widgets, in _addition_ to
   * possible existing definitions in abix.
   */
  add?: boolean;
  /**
   * when not null, use tabs for view and editor
   * the function returns the tab title from the array _i_ item content
   */
  showAsTabs?: (i: number, self: unknown) => string;
  /** override parent label */
  label?: string;
};

export type TypeDefinitionObject = {
  object: AnyCell<MapTypeDefinitions>;
  card?: boolean;
  inline?: boolean;
  /** group definitions */
  gs?: GroupDefinition[];
  buttonsAfter?: ButtonDefinition[];
  /** optional border label */
  border?: string;
};

export type ButtonDefinition = {
  /** initial message */
  message?: (self?: ButtonDefinition, data?: unknown) => string;
  /** icon button */
  icon?: (self?: ButtonDefinition, data?: unknown) => string;
  /** button label */
  label?: (self?: ButtonDefinition, data?: unknown) => string;
  /** button style */
  style?: (self?: ButtonDefinition, data?: unknown) => ButtonStyle;
  /** button size */
  size?: (self?: ButtonDefinition, data?: unknown) => "sm" | "md" | "lg";
  /** button wide */
  wide?: (self?: ButtonDefinition, data?: unknown) => boolean;
  /**
   * disabled function for the button
   * @param self the object holding the button
   * @param data whole editor data
   */
  disabled: (self?: ButtonDefinition, data?: unknown) => boolean;
  /**
   * button action
   * @param self the object holding the button
   * @param data whole editor data
   * @returns message as string[] to display with <Title> + valid status
   */
  asyncAction: (
    data?: unknown,
    updater?: (
      v: unknown,
      path: Path,
      definition?: LabelledTypeDefinition
    ) => void,
    path?: Path,
    definition?: LabelledTypeDefinition
  ) => Promise<{ status: "success" | "failed"; messages: string[] }>;
};

export type TypeDefinitionDict = {
  /** type definition of entries */
  dict: TypeDefinitionFn;
  /** allowed keys */
  keys?: Set<string>;
  /** when closed, no new key can be inserted in the dict */
  closed?: boolean;
  compact?: boolean;
};

/**
 * LabelledTypeDefinition defines a type with a label.
 * @todo proper types for from and to
 */
export type LabelledTypeDefinition =
  | TypeDefinitionName
  | ({
      /** label */
      label: string;
      /** hideLabel */
      hideLabel?: boolean;
      /** hint text (longer than label) */
      hint?: string;
      /** help text (longer than hint, usually displayed under field) */
      help?: string;
      /** placeholder */
      pl?: string;
      /** validator: return an error string or undefined if no errors */
      validator?: (v: unknown) => string | Promise<string>;
      /** locked values are not editable */
      locked?: boolean;
      /** group */
      gr?: string;
      /** @deprecated recompute the schema on subgraph value change */
      recomp?: boolean; // cspell:disable-line
      /** optional icon */
      icon?: IconName;
      /** optional metadata */
      options?: unknown;
      /** lenses are two-way value transformations */
      lens?: (v: AnyCell<unknown>, options?: unknown) => AnyCell<unknown>;
      /** css optional classes */
      css?: string;
      /** css for view only */
      cssView?: string;
      /** hyperlink */
      link?: string;
      /** optional rank within group */
      rank?: number;
      /** compact view (currently specified but not implemented) */
      compact?: boolean;
    } & TypeDefinition);

/**
 * TypeScheme defines a top-level type scheme and type environment.
 * @todo TypeDefinition | LabelledTypeDefinition
 */
export type TypeScheme = {
  types: AnyCell<MapTypeDefinitions>;
  values: AnyCell<LabelledTypeDefinition>;
  /** groups */
  gs?: CellArray<GroupDefinition>;
};

/**
 * GroupDefinition defines a group for displaying a value in groups or sections.
 */
export type GroupDefinition = {
  /** group id */
  id: string;
  /** label */
  l: string;
  /** collapsible */
  col?: boolean;
  /** hidden */
  hid?: boolean;
};

export const MiscGroupID = "";

export const MiscGroup: GroupDefinition = {
  id: MiscGroupID,
  l: "Miscellaneous",
  col: true
};

// Optional arguments for advance_type function
// @todo remove ABIMethod from here and add to env as @abix
export type AdvanceTypeOptions = {
  v?: unknown;
  env?: Environment;
  par?: unknown;
};

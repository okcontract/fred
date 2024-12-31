import type { ValueCell } from "@okcontract/cells";

export const NEW = "new";
export const EDIT = "edit";
export const VIEW = "view";

export type EditorMode = typeof NEW | typeof EDIT | typeof VIEW;

/**
 * EditorParameters are global options for the Edit* and *Editor components.
 */
export interface EditorParameters {
  /**
   * editor mode
   */
  mode: EditorMode;
  /**
   * showLabels is true when we want to show labels in editor.
   */
  showLabels?: boolean;
  /**
   * hintText is true when we want to display hint text.
   */
  hintText?: boolean;
  /**
   * helpText is true when we want to display help text.
   */
  helpText?: boolean;
  /**
   * modifiable is true when the schema is modifiable.
   */
  modifiable?: boolean;
  /**
   * sortable is true when the main items can be reordered by the user.
   */
  sortable?: boolean;
  /**
   * disabled is true when the values can not be modified.
   */
  disabled?: boolean;
  /**
   * evaluate is true when we want to evaluate values
   */
  evaluate?: boolean;

  /**
   * recomputer
   * @todo hack for re-evaluating env
   */
  recomputer?: ValueCell<number>;
  /**
   * @dev
   * showDefinition print debug definition
   */
  showDefinition?: boolean;
  /**
   * enable groups feature
   */
  groups?: boolean;
  /**
   * collapsed wether to collapsed the group by default
   */
  collapsed?: boolean;
  /**
   * highlight row when hovering on it
   */
  highlightOnHover?: boolean;
  /**
   * debouncer delay (in ms)
   */
  delay?: number;
  /**
   * name (for debugging)
   */
  name?: string;
}

import {
  type AnyCell,
  type Key,
  type MapCell,
  type Path,
  type SheetProxy,
  ValueCell,
  cellify,
  simplifier,
  uncellify
} from "@okcontract/cells";
import type { Environment } from "@okcontract/lambdascript";
import { type Debouncer, debouncer } from "@okcontract/multichain";

import { type EditorParameters, NEW } from "./editor";
import { emptyValueOfTypeDefinitionAux } from "./empty";
import {
  type EditorNode,
  type IndexGroups,
  type NodeObject,
  dataTree,
  groupsIndex,
  isArrayNode,
  isDictNode,
  isObjectNode,
  objectNodeGroups
} from "./groups";
import type {
  MapTypeDefinitions,
  TypeDefinitionArray,
  TypeDefinitionDict,
  TypeDefinitionObject,
  TypeScheme
} from "./types";

export class DataEditor {
  readonly _proxy: SheetProxy;
  readonly schema: TypeScheme; // , boolean, true>;
  readonly data: AnyCell<unknown>;
  readonly env: Environment | undefined;
  readonly params: EditorParameters;
  readonly root: MapCell<EditorNode & NodeObject, false>;
  readonly groupsIndex: IndexGroups;
  readonly recomputer: ValueCell<number>;
  readonly deb: Debouncer;

  constructor(
    proxy: SheetProxy,
    data: AnyCell<unknown>,
    schema: TypeScheme,
    env?: Environment | undefined,
    // @todo merge with @dataeditor/EditorOptions?
    params: EditorParameters = {
      mode: NEW,
      collapsed: true,
      highlightOnHover: true,
      delay: 300 // ms
    }
  ) {
    this._proxy = proxy;
    this.schema = schema;
    this.params = params;
    this.root = dataTree(proxy, data, schema, env);
    this.groupsIndex = groupsIndex(schema);
    this.data = data;
    this.env = env;
    this.recomputer = params?.recomputer || proxy.new(0, "recomputer");
    this.deb = debouncer(params?.delay || 100);
  }

  d = (msg: string, v: unknown) => this._proxy._sheet.debug(undefined, msg, v);

  recompute() {
    this.deb(() => {
      this.recomputer.update((v) => v + 1);
    }, null);
  }

  /**
   * follow a static path in the DataTree (not reactive).
   */
  follow = async (path: Path): Promise<EditorNode> => {
    const aux = async (v: EditorNode, path: Path) => {
      // this.d("follow", { path, v });
      if (path.length === 0) return v;
      const key = path[0];
      if ("array" in v) {
        const arr = await v.array.get();
        if (arr instanceof Error) throw arr;
        if (arr[key] === undefined) throw new Error(`key not found: ${key}`);
        return aux(arr[key].get(), path.slice(1));
      }
      if ("object" in v) {
        const obj = await v.object.get();
        if (obj instanceof Error) throw obj;
        if (obj[key] === undefined) throw new Error(`key not found: ${key}`);
        const child = await obj[key].get();
        if (child instanceof Error) throw child;
        return aux(child, path.slice(1));
      }
      if ("dict" in v) {
        const dict = await v.dict.get();
        if (dict instanceof Error) throw dict;
        if (dict[key] === undefined) throw new Error(`key not found: ${key}`);
        const child = await dict[key].get();
        if (child instanceof Error) throw child;
        return aux(child, path.slice(1));
      }
      throw new Error(`leaf reached, remaining path: ${path.join(".")}`);
    };
    // @todo .get() should throw
    const v = await this.root.get();
    if (v instanceof Error) throw v;
    return aux(v, path);
  };

  // === Array ===

  private getArray = (node: EditorNode) => {
    const arrayID = node.value;
    // this.d("node", { node });
    if (arrayID === undefined || !isArrayNode(node))
      throw new Error(`${node.id}: not an array`);
    const array = this._proxy.get(arrayID); // resolving pointers
    if (!(array instanceof ValueCell)) {
      // this.d("ValueCell", { array });
      throw new Error(
        `array cell ${array.constructor.name} is not a ValueCell`
      );
    }
    return array as ValueCell<AnyCell<unknown>[]>;
  };

  private get types() {
    return this.schema.types.get() as Promise<MapTypeDefinitions>;
  }

  addElement = async (node: EditorNode) => {
    const array = this.getArray(node);
    const def = (node.definition.value as TypeDefinitionArray).array(
      node,
      this.env
    );
    const empty = cellify(
      this._proxy,
      await emptyValueOfTypeDefinitionAux(
        this._proxy,
        await this.types,
        await def.get(),
        {
          deep: false,
          oneElementInArray: true
        }
      ),
      "empty[]"
    );
    console.log({ empty, def: await def.get() });
    // this.d("empty", { empty });
    array.update((_array) => [..._array, empty]);
    this.recompute();
  };

  removeElement = (node: EditorNode, index: number) => {
    const array = this.getArray(node);
    array.update((_array) => {
      const prev = _array[index];
      if (prev === undefined)
        throw new Error(`${node.id}: element ${index} not found`);
      this._proxy._sheet.collect(prev);
      return [..._array.slice(0, index), ..._array.slice(index + 1)];
    });
    this.recompute();
  };

  // === Dict ===

  private getDict = (node: EditorNode) => {
    const dictID = node.value;
    // this.d("node", { node });
    if (dictID === undefined || !isDictNode(node))
      throw new Error(`${node.id}: not a dict`);
    const dict = this._proxy.get(dictID); // resolving pointers
    if (!(dict instanceof ValueCell)) {
      // this.d("ValueCell", { array });
      throw new Error(`dict cell ${dict.constructor.name} is not a ValueCell`);
    }
    return dict as ValueCell<Record<Key, AnyCell<unknown>>>;
  };

  addNewDictValue = async (node: EditorNode, key: Key) => {
    const dict = this.getDict(node);
    const def = node.definition;
    if (def instanceof Error) throw def;
    const td = (def.value as TypeDefinitionDict).dict(node, this.env);
    const empty = cellify(
      this._proxy,
      await emptyValueOfTypeDefinitionAux(
        this._proxy,
        await this.types,
        await td.get(),
        {
          deep: false,
          oneElementInArray: true
        }
      ),
      `empty:${key}`
    );
    dict.update((_dict) => ({ ..._dict, [key]: empty }));
    this.recompute();
  };

  // === Object ===

  private getObject = (
    node: EditorNode
  ): ValueCell<Record<string, unknown>> => {
    const objID = node.value;
    // this.d("node", { node });
    if (objID === undefined || !isObjectNode(node))
      throw new Error(`node ${node.id}: not an object`);
    const obj = this._proxy.get(objID); // resolving pointers
    console.log(simplifier({ OBJ: obj }));
    if (!(obj instanceof ValueCell)) {
      // this.d("ValueCell", { array });
      throw new Error(`object cell ${obj.constructor.name} is not a ValueCell`);
    }
    return obj as ValueCell<Record<string, unknown>>;
  };

  groups = (node: EditorNode & NodeObject) => {
    return objectNodeGroups(
      this._proxy,
      this.groupsIndex,
      node,
      this.params?.name
    );
  };

  /**
   * addNewProperty works both for Dict and Object values.
   */
  addNewProperty = async (node: EditorNode, key: Key) => {
    console.log("addNewProperty", simplifier({ node, key }));
    if (isDictNode(node)) return this.addNewDictValue(node, key);
    const obj = this.getObject(node);

    const def = await (
      node.definition.value as TypeDefinitionObject
    )?.object?.get();
    if (def === undefined)
      throw new Error("addNewProperty: definitions are missing");
    if (def instanceof Error) throw def;
    if (def[key] === undefined)
      throw new Error(`addNewProperty: key ${key} not found`);

    // const fieldDef = await def[key].get();
    // if (fieldDef instanceof Error) throw fieldDef;
    const empty = cellify(
      this._proxy,
      await emptyValueOfTypeDefinitionAux(
        this._proxy,
        await this.types,
        await def[key](node, this.env).get(),
        {
          deep: false,
          oneElementInArray: true
        }
      ),
      `empty.${key}`
    );
    obj.update((_obj: Record<Key, unknown>) => ({
      ..._obj,
      [key]: empty
    }));
    this.recompute();
  };

  removeProperty = (node: EditorNode, key: Key) => {
    console.log("removeProperty", { id: node.id, key });
    const obj = isDictNode(node) ? this.getDict(node) : this.getObject(node);
    obj.update((_obj: Record<Key, AnyCell<unknown>>) => {
      if (!(key in _obj)) throw new Error(`${node.id}: unknown key ${key}`);
      const { [key]: removed, ...copy } = _obj;
      // console.log({ removed });
      // @todo workaround around Svelte reactivity delay after cells
      setTimeout(() => this._proxy._sheet.collect(removed), 20);
      return copy;
    });
    this.recompute();
  };

  update = (node: EditorNode, data: unknown) => {
    const cell = this._proxy.get(node.value);
    if (!(cell instanceof ValueCell))
      throw new Error(`not a ValueCell: ${cell?.id}`);
    cell.set(data);
    this.recompute();
  };

  isValid = async () => {
    try {
      await uncellify(this.root, {
        getter: (cell) => cell.value
      });
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };
}

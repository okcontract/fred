import { writeFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  type AnyCell,
  Debugger,
  Sheet,
  SheetProxy,
  uncellify
} from "@okcontract/cells";
import { isEqual } from "@okcontract/lambdascript";

import { DataEditor } from "./dataeditor";
import { emptyValueOfTypeDefinitionAux } from "./empty";
import type { EditorNode, NodeObject } from "./groups";
import { newSchema, objectDefinition } from "./helpers";
import type { LabelledTypeDefinition, MapTypeDefinitions } from "./types";

describe("array updates", () => {
  test("array addElement low-level", async () => {
    const sheet = new Sheet(isEqual);
    const proxy = new SheetProxy(sheet);

    const foo = proxy.new("foo", "foo");
    const bar = proxy.new("bar", "bar");
    const test = proxy.new([foo, bar], "test");
    const data = proxy.new({ test }, "data");
    const values: AnyCell<LabelledTypeDefinition> = objectDefinition(proxy, {
      test: {
        label: "Test",
        array: () =>
          proxy.new({
            label: "Test Item",
            base: "string"
          }),
        gr: "main"
      }
    });
    const schema = newSchema(proxy, values);
    const edit = new DataEditor(proxy, data, schema);

    // follow the array node
    const arrNode = await edit.follow(["test"]);
    expect(arrNode.id).toEqual("node:6");
    expect(proxy.get(arrNode.value).id).toEqual(test.id);

    const empty = emptyValueOfTypeDefinitionAux(
      proxy,
      schema.types.value as MapTypeDefinitions,
      arrNode.definition.value, // @todo check that the right definition
      {
        oneElementInArray: true,
        deep: false
      }
    );
    await expect(empty).resolves.toEqual([""]);

    // automatically add element
    await edit.addElement(arrNode);
    await proxy.working.wait();

    if (!("array" in arrNode)) throw new Error("no array");
    const arr = await arrNode.array.get();
    if (arr instanceof Error) throw arr;
    expect(arr.length).toBe(3);
    const itemNode = await arr[2].get();
    if (itemNode instanceof Error) throw itemNode;

    const item = proxy.get(itemNode.value);
    expect(item.id).toBe(33);
    expect(item.value).toBe("");
  });

  test("array from scratch", async () => {
    const sheet = new Sheet(isEqual);
    const proxy = new SheetProxy(sheet);

    const data = proxy.new({}, "data");
    const values: AnyCell<LabelledTypeDefinition> = objectDefinition(proxy, {
      test: {
        label: "Test",
        array: () =>
          proxy.new({
            label: "Test Item",
            base: "string"
            // min: 1
          }),
        gr: "main"
      }
    });
    const schema = newSchema(proxy, values);
    const edit = new DataEditor(proxy, data, schema);
    const root = (await edit.root.get()) as EditorNode & NodeObject;
    const groups = edit.groups(root);

    await edit.addNewProperty(root, "test");
    await expect(uncellify(data)).resolves.toEqual({ test: [""] });

    await expect(uncellify(edit.root)).resolves.toEqual({
      definition: {
        label: "root",
        object: {
          test: expect.any(Function)
        }
      },
      id: "node:3",
      object: {
        test: {
          array: [
            {
              definition: {
                base: "string",
                label: "Test Item"
                // min: 1
              },
              group: "main",
              id: "node:5",
              key: 0,
              parent: 21,
              path: ["test", 0],
              value: 20,
              original: 20,
              valid: null
            }
          ],
          definition: {
            array: expect.any(Function),
            gr: "main",
            label: "Test"
          },
          group: "main",
          id: "node:6",
          key: "test",
          path: ["test"],
          valid: null,
          value: 21,
          original: 21,
          parent: 0
        }
      },
      parent: null,
      path: [],
      value: 0,
      original: 0,
      valid: null
    });

    await expect(uncellify(groups)).resolves.toEqual([
      [
        {
          id: "main",
          l: "Main"
        },

        [
          {
            array: [
              {
                definition: {
                  base: "string",
                  label: "Test Item"
                },
                group: "main",
                id: "node:5",
                key: 0,
                parent: 21,
                path: ["test", 0],
                value: 20,
                original: 20,
                valid: null
              }
            ],
            definition: {
              array: expect.any(Function),
              gr: "main",
              label: "Test"
            },
            group: "main",
            id: "node:6",
            key: "test",
            path: ["test"],
            value: 21,
            original: 21,
            parent: 0,
            valid: null
          }
        ],
        []
      ]
    ]);
  });

  test("array addElement twice", async () => {
    Error.stackTraceLimit = 100;
    const sheet = new Sheet(isEqual);
    const proxy = new SheetProxy(sheet);
    // const debug = new Debugger(sheet);
    const test = proxy.new([], "test");
    const data = proxy.new({ test }, "data");
    const values: AnyCell<LabelledTypeDefinition> = proxy.new(
      {
        label: "root",
        object: proxy.new(
          {
            test: () =>
              proxy.new(
                {
                  label: "Test",
                  array: () =>
                    proxy.new({
                      label: "Test Item",
                      base: "string"
                    }),
                  gr: "main"
                },
                "def:test"
              )
          },
          "root"
        )
      },
      "values"
    );
    const schema = newSchema(proxy, values);

    const edit = new DataEditor(proxy, data, schema);

    // follow the array node
    const arrNode = await edit.follow(["test"]);
    expect(arrNode.id).toEqual("node:4");
    expect(proxy.get(arrNode.value).id).toEqual(test.id);

    expect(sheet.stats).toEqual({ count: 19, size: 19 });

    // add a first element
    await edit.addElement(arrNode);
    await proxy.working.wait();
    expect(sheet.stats).toEqual({ count: 26, size: 26 });

    // add another element
    await edit.addElement(arrNode);
    await proxy.working.wait();
    expect(sheet.stats).toEqual({ count: 33, size: 33 });

    // we can remove the first element
    edit.removeElement(arrNode, 0);

    await proxy.working.wait();
    expect(sheet.stats).toEqual({ count: 33, size: 30 });

    // it shifts elements in array
    expect(() => edit.removeElement(arrNode, 1)).toThrowError(
      "node:4: element 1 not found"
    );

    // writeFileSync(
    //   "dataeditor-array-twice.dot",
    //   debug.dot("dataeditor after first removal")
    // );

    edit.removeElement(arrNode, 0);
    await proxy.working.wait();
  });
});

describe("object updates", () => {
  test("object removeElement", async () => {
    const sheet = new Sheet(isEqual);
    const proxy = new SheetProxy(sheet);
    const debug = new Debugger(sheet);
    const data = proxy.new({} as unknown, "data");

    const values = objectDefinition(proxy, {
      foo: {
        label: "foo",
        base: "string",
        gr: "main",
        optional: true
      },
      bar: {
        label: "bar",
        base: "string",
        gr: "main",
        optional: true
      }
    });
    const schema = newSchema(proxy, values);

    const edit = new DataEditor(proxy, data, schema);
    const root = (await edit.root.get()) as EditorNode & NodeObject;
    const groups = edit.groups(root);
    expect(root).not.toBeInstanceOf(Error);

    // add a first prop
    await edit.addNewProperty(root, "foo");
    // not needed
    // await proxy.working.wait();
    await expect(uncellify(data)).resolves.toEqual({ foo: "" });

    // add another prop
    await edit.addNewProperty(root, "bar");
    // await proxy.working.wait();
    await expect(uncellify(data)).resolves.toEqual({ foo: "", bar: "" });

    writeFileSync(
      "dataeditor-object.dot",
      debug.dot("dataeditor object after first insert")
    );

    // remove is sync
    edit.removeProperty(root as EditorNode, "foo");
    await proxy.working.wait();

    await expect(uncellify(data)).resolves.toEqual({ bar: "" });
  });
});

describe("dict updates", () => {
  test("dict removeElement", async () => {
    const sheet = new Sheet(isEqual);
    const proxy = new SheetProxy(sheet);
    const debug = new Debugger(sheet);
    const data = proxy.new({} as unknown, "data");
    const values: AnyCell<LabelledTypeDefinition> = proxy.new(
      {
        label: "Words",
        dict: () =>
          proxy.new({
            label: "Word",
            base: "string"
          })
        // gr: "main",
        // opt: true
      },
      "def:words"
    );

    const schema = {
      types: proxy.new({} as MapTypeDefinitions, "types"),
      values,
      gs: proxy.new([proxy.new({ id: "main", l: "Main" }, "gs.main")], "gs")
    };
    const edit = new DataEditor(proxy, data, schema);
    const root = (await edit.root.get()) as EditorNode & NodeObject;

    // add a first prop
    await edit.addNewProperty(root, "foo");
    await expect(uncellify(data)).resolves.toEqual({ foo: "" });

    // add another prop
    await edit.addNewProperty(root, "bar");
    await expect(uncellify(data)).resolves.toEqual({ foo: "", bar: "" });

    writeFileSync(
      "dataeditor-dict.dot",
      debug.dot("dataeditor dict after second insert")
    );

    // remove is sync
    edit.removeProperty(root as EditorNode, "foo");

    await expect(uncellify(data)).resolves.toEqual({ bar: "" });
  });
});

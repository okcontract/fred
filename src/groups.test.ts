import { writeFileSync } from "node:fs";
import { expect, test } from "vitest";

import {
  type AnyCell,
  Debugger,
  Sheet,
  SheetProxy,
  type ValueCell,
  cellify,
  uncellify
} from "@okcontract/cells";
import { isEqual } from "@okcontract/lambdascript";

import { dataTree, groupsIndex, objectNodeGroups } from "./groups";
import { mapTypeDefinitions, newSchema, objectDefinition } from "./helpers";
import type {
  LabelledTypeDefinition,
  MapTypeDefinitions,
  TypeScheme
} from "./types";

test("dataTree validation errors", async () => {
  const sheet = new Sheet(isEqual);
  const proxy = new SheetProxy(sheet);
  const schema = newSchema(
    proxy,
    objectDefinition(proxy, {
      foo: {
        label: "foo",
        base: "string"
      }
    })
  );
  const data = proxy.new({});
  dataTree(proxy, data, schema);
  await proxy.working.wait();
  // @todo we should collect errors from proxy
  expect(proxy.errors.get()).toEqual(new Map());
});

test("dataTree object with named type", async () => {
  const sheet = new Sheet(isEqual);
  const proxy = new SheetProxy(sheet);
  const debug = new Debugger(sheet);
  const foo = proxy.new("foo", "foo");
  const data = proxy.new<Record<string, unknown>>({ foo }, "data");
  const types = mapTypeDefinitions(
    proxy,
    {
      def: {
        label: "def",
        base: "string",
        gr: "main"
      }
    },
    "types"
  );
  const definitions = objectDefinition(proxy, {
    foo: {
      label: "foo",
      name: "def",
      // base: "string",
      gr: "main" // @todo gr should not be needed
    },
    bar: {
      // @todo label should be optional because of name, update type
      label: "bar",
      gr: "main",
      name: "def"
    }
  });
  const schema: TypeScheme = newSchema(proxy, definitions, types);

  const tree = dataTree(proxy, data, schema);
  const idx = groupsIndex(schema as TypeScheme);
  const groups = tree.map((root) => objectNodeGroups(proxy, idx, root));

  await proxy.working.wait();
  writeFileSync(
    "groups-basic-before.dot",
    debug.dot("dataTree basic before update")
  );

  expect(sheet.stats).toEqual({ count: 26, size: 26 });

  // await sleep(1000);

  await expect(uncellify(tree)).resolves.toMatchObject({
    id: expect.any(String),
    definition: {
      label: "root",
      object: { foo: expect.any(Function), bar: expect.any(Function) }
    },
    object: {
      bar: {
        definition: {
          base: "string",
          gr: "main",
          label: "bar"
        },
        group: "main",
        id: "node:3",
        key: "bar",
        path: ["bar"],
        parent: 1,
        undefined: true
      },
      foo: {
        definition: {
          base: "string",
          gr: "main",
          label: "foo"
        },
        group: "main",
        id: "node:2",
        key: "foo",
        path: ["foo"],
        value: 0,
        parent: 1,
        valid: null
      }
    },
    parent: null,
    path: [],
    value: 1,
    valid: null
  });
  await expect(uncellify(groups)).resolves.toMatchObject([
    [
      {
        id: "main",
        l: "Main"
      },
      [
        {
          definition: {
            base: "string",
            gr: "main",
            label: "foo"
          },
          group: "main",
          id: "node:2",
          key: "foo",
          path: ["foo"],
          value: 0,
          valid: null,
          parent: 1
        }
      ],
      [
        {
          definition: {
            base: "string",
            gr: "main",
            label: "bar"
          },
          group: "main",
          id: "node:3",
          key: "bar",
          path: ["bar"],
          undefined: true
        }
      ]
    ]
  ]);

  console.log("-----Updating...");

  const bar = proxy.new("bar", "bar");
  data.update((obj) => ({ ...obj, bar }));
  await proxy.working.wait();

  writeFileSync(
    "groups-basic-after.dot",
    debug.dot("dataTree basic after update")
  );

  const expectedTree2 = {
    id: expect.any(String),
    definition: {
      label: "root",
      object: { foo: expect.any(Function), bar: expect.any(Function) }
    },
    object: {
      bar: {
        definition: {
          base: "string",
          gr: "main",
          label: "bar"
        },
        group: "main",
        id: "node:5", // CHANGED
        key: "bar",
        path: ["bar"],
        value: 26, // CHANGED
        valid: null
      },
      foo: {
        definition: {
          base: "string",
          gr: "main",
          label: "foo"
        },
        group: "main",
        id: "node:2",
        key: "foo",
        path: ["foo"],
        value: 0,
        parent: 1,
        valid: null
      }
    },
    // collapsed: false,
    path: [],
    value: 1,
    valid: null
  };

  await expect(uncellify(tree)).resolves.toMatchObject(expectedTree2);
  await expect(uncellify(groups)).resolves.toMatchObject([
    [
      {
        id: "main",
        l: "Main"
      },
      [
        {
          definition: {
            base: "string",
            gr: "main",
            label: "foo"
          },
          group: "main",
          id: "node:2",
          key: "foo",
          path: ["foo"],
          value: 0,
          valid: null
        },
        {
          definition: {
            base: "string",
            gr: "main",
            label: "bar"
          },
          group: "main",
          id: "node:5",
          key: "bar",
          path: ["bar"],
          value: 26,
          parent: 1,
          valid: null
        }
      ],
      []
    ]
  ]);
  expect(sheet.stats).toEqual({ count: 34, size: 32 });

  console.log("-----Updating bar...");
  bar.set("test");

  await proxy.working.wait();
  // @todo fix new node
  await expect(uncellify(tree)).resolves.toMatchObject(expectedTree2);
  // no new cell created
  expect(sheet.stats).toEqual({ count: 34, size: 32 });

  console.log("-----Deleting foo...");
  data.update((obj) => {
    const { foo: _removed, ...copy } = obj;
    return copy;
  });
  await proxy.working.wait();
  expect(sheet.stats).toEqual({ count: 40, size: 34 });
  // new cells
  expect([
    sheet.get(34).name,
    sheet.get(35).name,
    sheet.get(36).name,
    sheet.get(37).name,
    sheet.get(38).name,
    sheet.get(39).name
  ]).toEqual([
    "root.object.foo",
    "dual.null[foo]",
    "resolveType:node:6",
    "types.def",
    "resolve:def",
    "_sorted::" // new reduce inner cell, collected
  ]);
  await expect(uncellify(groups)).resolves.toMatchObject([
    [
      {
        id: "main",
        l: "Main"
      },
      [
        {
          definition: {
            base: "string",
            gr: "main",
            label: "bar"
          },
          group: "main",
          id: "node:5",
          key: "bar",
          path: ["bar"]
        }
      ],
      [
        {
          definition: {
            base: "string",
            gr: "main",
            label: "foo"
          },
          group: "main",
          id: "node:6", // new node
          key: "foo",
          path: ["foo"],
          undefined: true
        }
      ]
    ]
  ]);
});

// @todo bring more features from @okcontract/sdk/src/schema.ts:256
// @todo test lock
// @todo locked should be a Cell.
const lens = (
  proxy: SheetProxy,
  gr: string,
  locked: boolean
): LabelledTypeDefinition => ({
  label: "lens",
  gr,
  locked,
  lens: (v: ValueCell<string>) => {
    const org: ValueCell<string> = proxy.new(undefined, "lens:org");
    const name: ValueCell<string> = proxy.new(undefined, "lens:name");
    v.subscribe((_v) => {
      console.log({ _v });
      const l = _v.split("/");
      if (l.length !== 2) throw new Error("input must be: org/name");
      org.set(l[0]);
      name.set(l[1]);
    });
    const obj = proxy.map(
      [org, name],
      (_org, _name) => ({ org, name }),
      "lens:obj"
    );
    // works only with isEqual, otherwise this would create a loop
    obj.subscribe(async (_obj) => {
      if (_obj instanceof Error) throw new Error(`lens failed: ${_obj}`);
      const nv = `${_obj.org.value}/${_obj.name.value}`;
      console.log({ lens: v.id, set: nv, prev: v.value });
      v.set(nv);
    });
    return obj;
  },
  object: mapTypeDefinitions(
    proxy,
    {
      org: {
        label: "Organization",
        base: "string"
      },
      name: {
        label: "Unique ID",
        base: "string"
      }
    },
    "lens"
  )
});

test("dataTree object with lens", async () => {
  const sheet = new Sheet(isEqual);
  const proxy = new SheetProxy(sheet);
  const debug = new Debugger(sheet);
  const foo = proxy.new("foo/bar", "foo");
  const data = proxy.new({ foo }, "data");
  const definitions: AnyCell<MapTypeDefinitions> = proxy.new(
    {
      foo: () => proxy.new(lens(proxy, "main", false), "def:foo")
    },
    "definitions"
  );
  const values = objectDefinition(proxy, definitions);
  const schema = newSchema(proxy, values);

  const tree = dataTree(proxy, data, schema);
  await proxy.working.wait();

  const expectedTree = {
    id: expect.any(String),
    definition: {
      label: "root",
      object: { foo: expect.any(Function) }
    },
    object: {
      foo: {
        definition: {
          gr: "main",
          label: "lens",
          lens: expect.any(Function),
          locked: false,
          object: {
            name: expect.any(Function),
            org: expect.any(Function)
          }
        },
        group: "main",
        id: "node:6",
        key: "foo",
        object: {
          name: {
            definition: {
              base: "string",
              label: "Unique ID"
            },
            group: "",
            id: "node:5",
            key: "name",
            path: ["foo", "name"],
            value: 18,
            original: 18,
            parent: 19,
            valid: null
          },
          org: {
            definition: {
              base: "string",
              label: "Organization"
            },
            group: "",
            id: "node:4",
            key: "org",
            path: ["foo", "org"],
            value: 17,
            original: 17,
            parent: 19,
            valid: null
          }
        },
        parent: 1,
        path: ["foo"],
        value: 19,
        original: 0,
        valid: null
      }
    },
    path: [],
    parent: null,
    value: 1,
    original: 1,
    valid: null
  };
  expect(sheet.stats).toEqual({ count: 34, size: 34 });
  await expect(uncellify(tree)).resolves.toMatchObject(expectedTree);
  await expect(uncellify(data)).resolves.toEqual({ foo: "foo/bar" });

  console.log("-----Updating lensed name...");
  (sheet.get(18) as ValueCell<string>).set("baz");
  await proxy.working.wait();
  writeFileSync(
    "groups-lens.dot",
    debug.dot(`dataTree with lens (${new Date()})`)
  );
  // no new cell
  expect(sheet.stats).toEqual({ count: 34, size: 34 });
  await expect(uncellify(tree)).resolves.toMatchObject(expectedTree);
  await expect(uncellify(data)).resolves.toEqual({ foo: "foo/baz" });

  console.log("-----Updating original foo...");
  foo.set("foo/bad");
  await proxy.working.wait();
  // no new cell
  expect(sheet.stats).toEqual({ count: 34, size: 34 });
  await expect(uncellify(tree)).resolves.toMatchObject(expectedTree);
  await expect(uncellify(data)).resolves.toEqual({ foo: "foo/bad" });
});

test("dataTree array", async () => {
  Error.stackTraceLimit = 1000;
  const sheet = new Sheet(isEqual);
  const proxy = new SheetProxy(sheet);
  const debug = new Debugger(sheet);
  const foo = proxy.new("foo", "foo");
  const bar = proxy.new("bar", "bar");
  const test = proxy.new([foo, bar], "test");
  const data = proxy.new({ test }, "data");

  const values = objectDefinition(proxy, {
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

  const tree = dataTree(proxy, data, schema);
  await proxy.working.wait();
  writeFileSync(
    "groups-array-before.dot",
    debug.dot("dataTree array before update")
  );

  // console.log(
  //   "tree",
  //   simplifier(tree, 1, { maxRank: 10, resolvePointers: 10 })
  // );

  const expectedTree = {
    id: expect.any(String),
    definition: { label: "root", object: { test: expect.any(Function) } },
    object: {
      test: {
        id: "node:6",
        parent: 3,
        value: 2,
        valid: null,
        definition: {
          label: "Test",
          array: expect.any(Function),
          gr: "main"
        },
        path: ["test"],
        group: "main",
        array: [
          {
            id: "node:4",
            key: 0,
            parent: 2,
            value: 0,
            original: 0,
            valid: null,
            definition: {
              label: "Test Item",
              base: "string"
            },
            group: "main",
            path: ["test", 0]
          },
          {
            id: "node:5",
            key: 1,
            parent: 2,
            value: 1,
            original: 1,
            valid: null,
            definition: {
              label: "Test Item",
              base: "string"
            },
            group: "main",
            path: ["test", 1]
          }
        ]
      }
    },
    // collapsed: false,
    path: [],
    value: expect.any(Number)
  };

  await expect(uncellify(tree)).resolves.toMatchObject(expectedTree);
  await expect(uncellify(sheet.get(2))).resolves.toMatchObject(["foo", "bar"]);
  await expect(uncellify(sheet.get(1))).resolves.toMatchObject("bar");

  console.log("-----Updating...");
  const baz = proxy.new("baz", "baz");
  test.update((arr) => [...arr, baz]);
  await proxy.working.wait();
  writeFileSync(
    "groups-array-after.dot",
    debug.dot("dataTree array after update")
  );

  const expectedTree2 = {
    id: expect.any(String),
    definition: { label: "root", object: { test: expect.any(Function) } },
    object: {
      test: {
        id: "node:6",
        parent: 3,
        value: 2,
        original: 2,
        valid: null,
        definition: {
          label: "Test",
          array: expect.any(Function),
          gr: "main"
        },
        path: ["test"],
        group: "main",
        array: [
          {
            id: "node:4",
            key: 0,
            parent: 2,
            value: 0,
            original: 0,
            valid: null,
            definition: {
              label: "Test Item",
              base: "string"
            },
            group: "main",
            path: ["test", 0]
          },
          {
            id: "node:5",
            key: 1,
            parent: 2,
            value: 1,
            original: 1,
            valid: null,
            definition: {
              label: "Test Item",
              base: "string"
            },
            group: "main",
            path: ["test", 1]
          },
          {
            id: "node:7",
            key: 2,
            parent: 2,
            value: 30, // NEW
            original: 30,
            valid: null,
            definition: {
              label: "Test Item",
              base: "string"
            },
            group: "main",
            path: ["test", 2]
          }
        ]
      }
    },
    // collapsed: false,
    path: [],
    valid: null,
    value: expect.any(Number)
  };
  const t = await uncellify(tree);
  expect(t).toMatchObject(expectedTree2);
});

test("dataTree object array", async () => {
  const sheet = new Sheet(isEqual);
  const proxy = new SheetProxy(sheet);
  const data = cellify(proxy, { test: [{ name: "Foo", age: 30 }] });
  const values = objectDefinition(proxy, {
    test: {
      label: "Test",
      array: () =>
        objectDefinition(
          proxy,
          {
            name: { label: "Name", base: "string" },
            age: { label: "Age", base: "number" }
          },
          "Person"
        ),
      gr: "main"
    }
  });
  const schema = newSchema(proxy, values);

  const tree = dataTree(proxy, data, schema);
  await proxy.working.wait();

  await expect(uncellify(tree)).resolves.toMatchObject({
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
              label: "Person",
              object: {
                age: expect.any(Function),
                name: expect.any(Function)
              }
            },
            group: "main",
            id: "node:8",
            object: {
              age: {
                definition: {
                  base: "number",
                  label: "Age"
                },
                group: "",
                id: "node:7",
                key: "age",
                parent: 2,
                path: ["test", 0, "age"],
                valid: null,
                value: 1
              },
              name: {
                definition: {
                  base: "string",
                  label: "Name"
                },
                group: "",
                id: "node:6",
                key: "name",
                parent: 2,
                path: ["test", 0, "name"],
                valid: null,
                value: 0
              }
            },
            parent: 3,
            path: ["test", 0],
            key: 0,
            valid: null,
            value: 2
          }
        ],
        definition: {
          array: expect.any(Function),
          gr: "main",
          label: "Test"
        },
        group: "main",
        id: "node:5",
        value: 3,
        parent: 4,
        valid: null,
        path: ["test"],
        key: "test"
      }
    },
    parent: null,
    path: [],
    valid: null,
    value: 4
  });
  await expect(uncellify(sheet.get(2))).resolves.toMatchObject({
    name: "Foo",
    age: 30
  });
  await expect(uncellify(sheet.get(3))).resolves.toMatchObject([
    { name: "Foo", age: 30 }
  ]);
});

test("dataTree dict", async () => {
  const sheet = new Sheet(isEqual);
  const proxy = new SheetProxy(sheet);
  const debug = new Debugger(sheet);
  const foo = proxy.new("foo", "foo");
  const bar = proxy.new("bar", "bar");
  const test = proxy.new({ foo, bar }, "test");
  const data = proxy.new({ test }, "data");

  const values = objectDefinition(proxy, {
    test: {
      label: "Test",
      dict: () =>
        proxy.new({
          label: "Value",
          base: "string"
        }),
      gr: "main"
    }
  });
  const schema = newSchema(proxy, values);

  const tree = dataTree(proxy, data, schema);
  await proxy.working.wait();
  expect(sheet.stats).toEqual({ count: 30, size: 30 });
  writeFileSync(
    "groups-array-before.dot",
    debug.dot("dataTree array before update")
  );

  const expectedTree = {
    id: expect.any(String),
    definition: { label: "root", object: { test: expect.any(Function) } },
    object: {
      test: {
        definition: {
          dict: expect.any(Function),
          gr: "main",
          label: "Test"
        },
        dict: {
          bar: {
            definition: {
              base: "string",
              label: "Test"
            },
            group: "main",
            id: "node:5",
            key: "bar",
            parent: 2,
            path: ["test", "bar"],
            value: 1,
            valid: null
          },
          foo: {
            definition: {
              base: "string",
              label: "Test"
            },
            group: "main",
            id: "node:4",
            key: "foo",
            parent: 2,
            path: ["test", "foo"],
            value: 0,
            valid: null
          }
        },
        group: "main",
        id: "node:6",
        path: ["test"],
        value: 2,
        parent: 3,
        valid: null
      }
    },
    // collapsed: false,
    path: [],
    value: expect.any(Number)
  };
  await expect(uncellify(tree)).resolves.toMatchObject(expectedTree);

  console.log("-----Updating...");

  const baz = proxy.new("baz", "baz");
  test.update((arr) => ({ ...arr, baz }));
  await proxy.working.wait();
  expect(sheet.stats).toEqual({ count: 36, size: 36 });
  // new cells
  expect([
    sheet.get(30).name,
    sheet.get(31).name,
    sheet.get(32).name,
    sheet.get(33).name,
    sheet.get(34).name,
    sheet.get(35).name
  ]).toEqual([
    "baz",
    "[baz]µ",
    "32", // @todo
    "resolveType:node:7",
    "resolve:node:7",
    "valid.test.baz"
  ]);
  writeFileSync(
    "groups-array-after.dot",
    debug.dot("dataTree array after update")
  );

  await expect(uncellify(tree)).resolves.toMatchObject(expectedTree);
});

test("dataTree object", async () => {
  const sheet = new Sheet(isEqual);
  const proxy = new SheetProxy(sheet);
  const debug = new Debugger(sheet);
  const foo = proxy.new(1, "foo");
  const test = proxy.new({ foo }, "test");
  const data = proxy.new({ test }, "data");

  const testDefinition = objectDefinition(
    proxy,
    {
      foo: {
        label: "foo",
        base: "number"
      },
      bar: {
        label: "bar",
        base: "string",
        optional: true
      }
    },
    "Test",
    { gr: "main" }
  );
  const values = objectDefinition(proxy, { test: testDefinition });
  const schema = newSchema(proxy, values);

  const tree = dataTree(proxy, data, schema);
  await proxy.working.wait();

  // console.log(
  //   "tree",
  //   simplifier(tree, 1, { maxRank: 10, resolvePointers: 10 })
  // );

  await expect(uncellify(tree)).resolves.toMatchObject({
    id: expect.any(String),
    definition: { label: "root", object: { test: expect.any(Function) } },
    object: {
      test: {
        id: "node:6",
        key: "test",
        group: "main",
        path: ["test"],
        definition: {
          object: {
            foo: expect.any(Function),
            bar: expect.any(Function)
          },
          gr: "main",
          label: "Test"
        },
        object: {
          foo: {
            id: "node:4",
            key: "foo",
            value: 0,
            parent: 1,
            valid: null,
            definition: {
              label: "foo",
              base: "number"
            },
            group: "",
            path: ["test", "foo"]
          },
          bar: {
            id: "node:5",
            key: "bar",
            parent: 1,
            definition: {
              label: "bar",
              base: "string",
              optional: true
            },
            group: "",
            path: ["test", "bar"],
            undefined: true
          }
        },
        value: 1,
        parent: 2,
        valid: null
      }
    },
    path: [],
    // collapsed: false,
    value: 2,
    parent: null,
    valid: null
  });

  writeFileSync(
    "groups-object-before.dot",
    debug.dot("dataTree object before update")
  );

  console.log("-----Updating...");

  (await data.get()).test.update((obj) => ({
    ...obj,
    bar: proxy.new("bar", "bar")
  }));

  await proxy.working.wait();
  writeFileSync(
    "groups-object-after.dot",
    debug.dot("dataTree object after update")
  );

  // await sleep(100);

  await expect(uncellify(tree)).resolves.toMatchObject({
    id: expect.any(String),
    definition: { label: "root", object: { test: expect.any(Function) } },
    object: {
      test: {
        id: "node:6",
        group: "main",
        key: "test",
        path: ["test"],
        definition: {
          object: {
            foo: expect.any(Function),
            bar: expect.any(Function)
          },
          gr: "main",
          label: "Test"
        },
        object: {
          foo: {
            id: "node:4",
            key: "foo",
            value: 0,
            parent: 1,
            valid: null,
            definition: {
              label: "foo",
              base: "number"
            },
            group: "",
            path: ["test", "foo"]
          },
          bar: {
            id: "node:7",
            key: "bar",
            value: 32, // NEW
            parent: 1,
            valid: undefined, // validation is not required
            definition: {
              label: "bar",
              base: "string",
              optional: true
            },
            group: "",
            path: ["test", "bar"]
          }
        },
        value: 1,
        parent: 2,
        valid: null
      }
    },
    path: [],
    value: 2,
    parent: null,
    valid: null
  });
});

// test("dataTree OKWidget", async () => {
//   const sheet = new Sheet(isEqual);
//   const proxy = new SheetProxy(sheet);
//   const debug = new Debugger(sheet);
//   const data = cellify(
//     proxy,
//     {
//       OKWidget: {
//         id: "test",
//         st: [
//           {
//             sty: "call"
//           }
//         ]
//       }
//     },
//     "data"
//   );

//   const definitions: AnyCell<MapTypeDefinitions> = proxy.new(
//     {
//       OKWidget: proxy.new(() => ({
//         label: "OKContract widget",
//         object: proxy.new(
//           {
//             id: proxy.new(
//               () => ({
//                 label: "Unique ID",
//                 base: "string",
//                 gr: "main"
//               }),
//               "OKWidget.id"
//             ),
//             st: proxy.new(
//               () => ({
//                 label: "Transaction Steps", // "List of transactions"
//                 array: {
//                   min: 1,
//                   label: "Step",
//                   object: proxy.new({
//                     sty: proxy.new(() => ({ label: "type", base: "string" }))
//                   })
//                 },
//                 gr: "steps"
//               }),
//               "OKWidget.st"
//             ),
//             h: proxy.new(
//               () => ({
//                 label: "H",
//                 base: "string",
//                 gr: "main",
//                 opt: true
//               }),
//               "OKWidget.h"
//             )
//           },
//           "OKWidget.object"
//         )
//       }))
//     },
//     "definitions"
//   );

//   const schema: AnyCell<TypeScheme> = proxy.new(
//     {
//       values: definitions.map(
//         () => ({ label: "root", object: definitions }) as LabelledTypeDefinition
//       ),
//       types: definitions,
//       gs: proxy.new(
//         [
//           proxy.new({ id: "main", l: "Main" }, "gs.main"),
//           proxy.new({ id: "steps", l: "Transactions" }, "gs.steps")
//         ],
//         "gs"
//       )
//     },
//     "schema"
//   );

//   const tree = dataTree(proxy, data, schema);
//   const idx = groupsIndex(schema.value as TypeScheme);
//   // @todo change groups for "OKWidget" not root
//   const root = (await tree.get()) as EditorNode & NodeObject;
//   const okw = (await (
//     (await root.object.get()) as Record<string, AnyCell<EditorNode>>
//   ).OKWidget.get()) as EditorNode & NodeObject;
//   const groups = objectNodeGroups(proxy, idx, okw);

//   const expectedDataTree = {
//     id: expect.any(String),
//     value: expect.any(Number),
//     definition: { label: "root", object: { OKWidget: expect.any(Function) } },
//     object: {
//       OKWidget: {
//         definition: {
//           label: "OKContract widget",
//           object: {
//             h: expect.any(Function),
//             id: expect.any(Function),
//             st: expect.any(Function)
//           }
//         },
//         group: "",
//         id: "node:4",
//         object: {
//           h: {
//             definition: {
//               base: "string",
//               gr: "main",
//               label: "H"
//             },
//             group: "main",
//             id: "node:7",
//             key: "h",
//             path: ["OKWidget", "h"]
//             // NO VALUE
//           },
//           id: {
//             definition: {
//               base: "string",
//               gr: "main",
//               label: "Unique ID"
//             },
//             group: "main",
//             id: "node:5",
//             key: "id",
//             path: ["OKWidget", "id"],
//             value: 0
//           },
//           st: {
//             array: [
//               {
//                 definition: {
//                   label: "Step",
//                   min: 1,
//                   object: {
//                     sty: expect.any(Function)
//                   }
//                 },
//                 group: "steps",
//                 id: "node:10",
//                 object: {
//                   sty: {
//                     definition: {
//                       base: "string",
//                       label: "type"
//                     },
//                     group: "",
//                     id: "node:11",
//                     key: "sty",
//                     path: ["OKWidget", "st", 0, "sty"],
//                     value: 1
//                   }
//                 },
//                 parent: 3,
//                 path: ["OKWidget", "st", 0],
//                 value: 2
//               }
//             ],
//             definition: {
//               array: {
//                 label: "Step",
//                 min: 1,
//                 object: {
//                   sty: expect.any(Function)
//                 }
//               },
//               gr: "steps",
//               label: "Transaction Steps"
//             },
//             group: "steps",
//             id: "node:8",
//             parent: null,
//             path: ["OKWidget", "st"],
//             value: 3
//           }
//         },
//         parent: null,
//         path: ["OKWidget"],
//         value: 4
//       }
//     }
//   };

//   // await proxy.working.wait();
//   await expect(uncellify(tree)).resolves.toMatchObject(expectedDataTree);
//   const initialGroups = [
//     [
//       {
//         id: "main",
//         l: "Main"
//       },
//       [
//         {
//           definition: {
//             base: "string",
//             gr: "main",
//             label: "Unique ID"
//           },
//           group: "main",
//           id: "node:5",
//           key: "id",
//           path: ["OKWidget", "id"],
//           value: 0
//         }
//       ],
//       [
//         {
//           definition: {
//             base: "string",
//             gr: "main",
//             label: "H",
//             opt: true
//           },
//           group: "main",
//           id: "node:7",
//           key: "h",
//           path: ["OKWidget", "h"],
//           undefined: true
//         }
//       ]
//     ],
//     [
//       {
//         id: "steps",
//         l: "Transactions"
//       },
//       [
//         {
//           array: [
//             {
//               definition: {
//                 label: "Step",
//                 min: 1,
//                 object: {
//                   sty: expect.any(Function)
//                 }
//               },
//               group: "steps",
//               id: "node:10",
//               object: {
//                 sty: {
//                   definition: {
//                     base: "string",
//                     label: "type"
//                   },
//                   group: "",
//                   id: "node:11",
//                   key: "sty",
//                   path: ["OKWidget", "st", 0, "sty"],
//                   value: 1,
//                   valid:null
//                 }
//               },
//               parent: 3,
//               path: ["OKWidget", "st", 0],
//               value: 2,
//               valid:null
//             }
//           ],
//           definition: {
//             array: {
//               label: "Step",
//               min: 1,
//               object: {
//                 sty: expect.any(Function)
//               }
//             },
//             gr: "steps",
//             label: "Transaction Steps"
//           },
//           group: "steps",
//           id: "node:8",
//           parent: null,
//           path: ["OKWidget", "st"],
//           value: 3,
//           valid:null
//         }
//       ],
//       []
//     ]
//   ];
//   await expect(uncellify(groups)).resolves.toMatchObject(initialGroups);
//   expect(sheet.stats).toEqual({ size: 38, count: 38 });
//   writeFileSync("groups1.dot", debug.dot("dataTree before update"));

//   console.log("-----Updating...");

//   (await data.get()).OKWidget.update((obj) => ({
//     ...obj,
//     h: proxy.new("hello", "hello")
//   }));
//   await proxy.working.wait();
//   await sleep(100);
//   writeFileSync("groups2.dot", debug.dot("dataTree after update"));

//   const updatedGroups = produce(initialGroups, (gr) => {
//     gr[0][1] = [...gr[0][1], ...gr[0][2]];
//     gr[0][1][1].id = "node:12";
//     gr[0][1][1].value = 38;
//     // biome-ignore lint/performance/noDelete: must match
//     delete gr[0][1][1].undefined;
//     gr[0][2] = [];
//   });
//   console.log(updatedGroups);
//   await expect(uncellify(groups)).resolves.toMatchObject(updatedGroups);
//   expect(sheet.stats).toEqual({ size: 40, count: 42 });
// });

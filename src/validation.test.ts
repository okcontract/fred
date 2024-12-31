import { expect, test } from "vitest";

import { Sheet, SheetProxy, cellify, uncellify } from "@okcontract/cells";
import { isEqual } from "@okcontract/lambdascript";

import { dataTree } from "./groups";
import { newSchema, objectDefinition } from "./helpers";
import { extractValidCells } from "./validation";

test("collect validation errors", async () => {
  const sheet = new Sheet(isEqual);
  const proxy = new SheetProxy(sheet);
  const schema = newSchema(
    proxy,
    objectDefinition(proxy, {
      foo: {
        label: "foo",
        base: "string",
        pattern: /a/
      },
      bar: {
        label: "bar",
        array: () => proxy.new({ label: "barElt", base: "string", min: 1 })
      }
    })
  );
  const data = cellify(proxy, { foo: "", bar: ["b"] });
  const tree = dataTree(proxy, data, schema);
  const valid = extractValidCells(proxy, tree);
  await proxy.working.wait();
  // @todo we should collect errors from proxy
  await expect(
    uncellify(valid, {
      getter: (cell) => cell.consolidatedValue,
      errorsAsValues: true
    })
  ).resolves.toEqual([null, expect.any(Error), null, null]);
});

import { expect, test } from "vitest";

import {
  type AnyCell,
  type MapCell,
  Sheet,
  SheetProxy,
  cellify,
  uncellify
} from "@okcontract/cells";
import { isEqual } from "@okcontract/lambdascript";

import { map2Objects } from "./map";

test("map2Objects", async () => {
  const sheet = new Sheet(isEqual);
  const proxy = new SheetProxy(sheet);

  const obj1 = cellify(proxy, { a: 1, b: "foo", c: "bar" }, "obj1");
  const obj2 = cellify(proxy, { a: 2, b: "test", h: 1 }, "obj2");
  expect(sheet.stats).toEqual({ count: 8, size: 8 });

  const m = map2Objects(
    proxy,
    obj1,
    obj2,
    (
      k: string,
      v1: AnyCell<unknown>,
      v2: AnyCell<unknown>
    ): MapCell<number, false> =>
      proxy.map(
        [v1, v2],
        (_v1, _v2) =>
          (typeof _v1 === "string" ? _v1.length : (_v1 as number)) +
          (typeof _v2 === "string" ? _v2.length : (_v2 as number)),
        `m:${k}`
      ),
    {
      name: "m",
      skipAUndefined: true,
      skipBUndefined: true
      // reducer: (l) => Object.fromEntries(l.map(([k, _a, _b, v]) => [k, v]))
    }
  );

  // initial value
  await expect(uncellify(m)).resolves.toEqual({ a: 3, b: 7 });
  expect(sheet.stats).toEqual({ count: 11, size: 11 });

  // update a field
  (await (await obj1.get()).a).set(4);
  await expect(uncellify(m)).resolves.toEqual({ a: 6, b: 7 });
  expect(sheet.stats).toEqual({ count: 11, size: 11 });

  // add a field
  obj1.update((rec) => ({ ...rec, h: proxy.new("hello", "hello") }));
  await expect(uncellify(obj1)).resolves.toEqual({
    a: 4,
    b: "foo",
    c: "bar",
    h: "hello"
  });
  console.log(await uncellify(m));
  await expect(uncellify(m)).resolves.toEqual({ a: 6, b: 7, h: 6 });
  expect(sheet.get(11).name).toBe("hello");
  expect(sheet.get(12).name).toBe("m:h");
  expect(sheet.stats).toEqual({ count: 13, size: 13 });

  // delete a field
  obj1.update((rec) => {
    const copy = { ...rec };
    // biome-ignore lint/performance/noDelete: we don't want an undefined field
    delete copy.a;
    return copy;
  });
  await expect(uncellify(m)).resolves.toEqual({ b: 7, h: 6 });
  expect(sheet.stats).toEqual({ count: 13, size: 12 }); // gc works
});

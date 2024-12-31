import { describe, expect, test } from "vitest";

import { Sheet, SheetProxy } from "@okcontract/cells";
import { isEqual } from "@okcontract/lambdascript";

import { emptyValueOfTypeDefinition } from "./empty";
import { sampleSchema } from "./sample.test";
import type { MapTypeDefinitions, TypeDefinitionObject } from "./types";

// @todo add more granular tests
describe("emptyValueOfTypeDefinition", () => {
  test("with an array definition - should return empty array", async () => {
    const proxy = new SheetProxy(new Sheet(isEqual));
    const ev = emptyValueOfTypeDefinition(
      proxy,
      proxy.new(null),
      proxy.new({
        label: "MyList",
        array: () => proxy.new({ label: "", base: "string" }),
        optional: true
      })
    );
    expect(ev.get()).resolves.toEqual([]);
    proxy.destroy();
  });

  test("with an string definition - should return an empty string", async () => {
    const proxy = new SheetProxy(new Sheet(isEqual));
    const ev = emptyValueOfTypeDefinition(
      proxy,
      proxy.new(null),
      proxy.new({
        label: "MyList",
        base: "string",
        optional: true
      })
    );
    expect(ev.get()).resolves.toEqual("");
    proxy.destroy();
  });

  test("with an object definition - should return object with empty string", async () => {
    const proxy = new SheetProxy(new Sheet(isEqual));
    const ev = emptyValueOfTypeDefinition(
      proxy,
      proxy.new(null),
      proxy.new({
        label: "MyList",
        optional: true,
        object: proxy.new({
          test: () =>
            proxy.new({
              label: "test",
              base: "string"
            })
        })
      })
    );
    expect(ev.get()).resolves.toEqual({ test: "" });
    proxy.destroy();
  });

  test("with sampleSchema schema and skipping optional value - should return empty default values for all", async () => {
    const proxy = new SheetProxy(new Sheet(isEqual));
    const sc = sampleSchema(proxy);
    const values = sc.values.value as unknown as TypeDefinitionObject;
    const object = values.object.value as MapTypeDefinitions;
    const testdeep = object.testdeep();

    const ev = emptyValueOfTypeDefinition(proxy, sc.types, testdeep);
    expect(ev.get()).resolves.toEqual({
      first: {
        full: {
          allergies: false,
          first: "",
          last: ""
        }
      },
      second: {
        hello: ""
      },
      last: ""
    });
    proxy.destroy();
  });
});

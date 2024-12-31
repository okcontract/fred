import { test } from "vitest";

import type { SheetProxy } from "@okcontract/cells";

import {
  type TypeScheme,
  defaultTypes,
  mapTypeDefinitions,
  objectDefinition
} from "./index";

export const sampleSchema = (proxy: SheetProxy): TypeScheme => {
  const localTypes = mapTypeDefinitions(proxy, {
    age: { base: "number", label: "Child Age" },
    fullname: () =>
      objectDefinition(
        proxy,
        {
          first: { base: "string", label: "First Name" },
          last: { base: "string", label: "Last Name" },
          allergies: {
            base: "boolean",
            label: "Does your child have allergies?"
          }
        },
        "Child Full Name"
      ),
    testdeep: () =>
      objectDefinition(
        proxy,
        {
          first: () =>
            objectDefinition(
              proxy,
              { full: { label: "Full", name: "fullname" } },
              "First"
            ),
          second: objectDefinition(
            proxy,
            {
              hello: {
                label: "Hello",
                base: "string"
              },
              world: {
                label: "world",
                base: "string",
                optional: true
              }
            },
            "Second"
          ),
          test: {
            label: "Test",
            name: "fullname",
            optional: true
          },
          last: { base: "string", label: "Last" },
          dictTest: {
            label: "TEST dict",
            optional: true,
            dict: () =>
              proxy.new({
                label: "dict name",
                name: "fullname"
              })
          }
        },
        "Test deep"
      ),

    "*": {
      label: "FallBack *",
      base: "string"
    }
  });
  const types = proxy.map([defaultTypes(proxy), localTypes], (t1, t2) => ({
    ...t1,
    ...t2
  }));

  const values = objectDefinition(
    proxy,
    {
      Correspondant: {
        name: "user",
        label: "Your main correspondant"
      },
      Others: {
        array: () => proxy.new({ name: "user" }),
        label: "List your other correspondants"
      },
      StartDate: {
        base: "date",
        label: "Camp Start Date"
      },
      ChildName: { name: "fullname", label: "Child Name" },
      ChildAge: { base: "number", label: "Child Age" },
      ChildSex: { enum: ["Girl", "Boy"], label: "Sex" },
      ParentName: { base: "string", label: "Your Name" },
      CanLeaveWith: {
        array: () => proxy.new({ name: "fullname" }),
        label: "Persons authorized to pick up your child"
      },
      DaysOfWeek: {
        array: () =>
          proxy.new({
            enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            label: "Day"
          }),
        unique: true, // FIXME: also sort?
        label: "Days of the week"
      },
      Friends: {
        array: () => proxy.new({ label: "Kid", base: "string" }),
        label: "Best Friends"
      },
      ok: {
        base: "boolean",
        label: "I agree with conditions"
      },
      testdeep: { name: "testdeep", label: "test deep" }
    },
    "values"
  );

  return {
    types,
    values,
    gs: proxy.new([])
  };
};

test(() => {});

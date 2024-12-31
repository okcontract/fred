import type { SheetProxy, ValueCell } from "@okcontract/cells";

import { mapTypeDefinitions, objectDefinition } from "./helpers";
import { defaultPatterns } from "./pattern";
import type { MapTypeDefinitions } from "./types";

/**
 * defaultTypes are sample type definitions.
 * @todo object fields should be optional by default and required only if used in template.
 * @todo special label "-" to inherit from parent?
 * @todo types should contain UI hints for optimal input? (text length, tight display for currency...)
 */
export const defaultTypes = (
  proxy: SheetProxy
): ValueCell<MapTypeDefinitions> =>
  mapTypeDefinitions(proxy, {
    user: {
      base: "string",
      label: "user email",
      pattern: defaultPatterns.email
    }, // user within account
    userset: {
      array: () =>
        proxy.new({
          label: "User",
          array: () => proxy.new({ name: "user" }),
          unique: true
        }),
      label: "set of users"
    },
    SimpleUserSet: {
      array: () => proxy.new({ label: "User", name: "user" }),
      label: "set of users",
      unique: true
    },
    SimpleNonEmptyUserSet: {
      // @todo reuse
      array: () => proxy.new({ label: "User", name: "user" }),
      min: 1,
      label: "set of users (must not be empty)",
      unique: true
    },
    currency: {
      enum: ["USD", "EUR", "GBP", "CHF"],
      label: "currency unit"
    },
    amount: () =>
      objectDefinition(
        proxy,
        {
          value: { base: "number", label: "amount value" }, // label will be input description
          currency: { name: "currency", label: "-" } // label skipped in input (unless hover)
        },
        "monetary amount in given currency"
      ),
    person: () =>
      objectDefinition(
        proxy,
        {
          firstname: { base: "string", label: "first name" },
          lastname: { base: "string", label: "last name" },
          birthdate: { base: "date", label: "date of birth" }
        },
        "named person"
      )
  });

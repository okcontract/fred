# fred, a functional reactive editor

[![CI](https://github.com/okcontract/fred/actions/workflows/main.yml/badge.svg)](https://github.com/okcontract/fred/actions?query=branch%3Amain++)
[![Coverage Status](https://coveralls.io/repos/github/okcontract/fred/badge.svg?branch=main)](https://coveralls.io/github/okcontract/fred?branch=main)
[![size](https://deno.bundlejs.com/badge?q=@okcontract/fred)](https://bundlephobia.com/package/@okcontract/fred)

`fred` is a functional reactive editor designed for dynamic and structured
data manipulation using [cells](https://github.com/okcontract/cells) as a
runtime. `fred` leverages functional reactivity to track and manage updates in
data structures like arrays, objects, and dictionaries.

## Core concepts

### Data Schema

Define a schema using `LabelledTypeDefinition` to specify structure,
validation rules, and properties of the data.

### Editor Nodes

`fred` models data as a graph of nodes that can represent objects, arrays, or
dictionaries. Each node tracks its state reactively.

### Functional Operations

`fred` provides operations like adding/removing elements, modifying
properties, and updating dictionaries in a reactive manner.

## Walkthrough

Let's see an example that includes both an object and an array.

```ts
import { Sheet, SheetProxy } from "@okcontract/cells";
import { DataEditor, newSchema, objectDefinition } from "@okcontract/fred";

const sheet = new Sheet();
const proxy = new SheetProxy(sheet);

// Initialize reactive data
const testArray = proxy.new([], "test");
const data = proxy.new({ test: testArray }, "data");

// Define schema using helpers
const values = objectDefinition(proxy, {
  test: {
    label: "Test",
    array: () =>
      proxy.new({
        label: "Test Item",
        base: "string",
      }),
  },
});
const schema = newSchema(proxy, values);

const editor = new DataEditor(proxy, data, schema);

// Add an element to the array
const arrNode = await editor.follow(["test"]);
await editor.addElement(arrNode);
await proxy.working.wait();

// Verify the new state
console.log(await proxy.get(arrNode.value)); // [{}, "", ...]
```

# Design & Philosophy

We aim for ease of use, correction and security, so chasing down any bug is
our top priority.

A non-goal is high-performance.

# About

`fred` is built at [OKcontract](https://okcontract.com) and is released under
the Apache license.

Contributors are welcome, feel free to submit PRs directly for small changes.
You can also reach out on [Twitter](https://x.com/okcontract) in advance for
larger contributions.

This work is supported in part by a RFG grant from
[Optimism](https://optimism.io).

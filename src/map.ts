import type {
  AnyCell,
  CellArray,
  CellObject,
  MapCell,
  SheetProxy
} from "@okcontract/cells";
import { isEqual } from "@okcontract/lambdascript";

export type MapOptions<M, NF extends boolean = false> = {
  name?: string;
  nf?: NF;
  skipAUndefined?: boolean;
  skipBUndefined?: boolean;
  onRemove?: (v: M) => void;
};

/**
 * map2Objects applies a function to two CellObjects.
 * default R: Record<string, AnyCell<M>
 */
export const map2Objects = <A, B, M, NF extends boolean = false>(
  proxy: SheetProxy,
  obj1: CellObject<A>,
  obj2: CellObject<B>,
  fn: (
    key: string,
    value1Cell: AnyCell<A>,
    value2Cell: AnyCell<B>
  ) => MapCell<M, false> | Promise<MapCell<M, false>>, // @todo NF
  options?: MapOptions<M, NF>
): MapCell<Record<string, MapCell<M, NF>>, NF> =>
  proxy.map(
    [obj1, obj2],
    (cells1, cells2, prev) => {
      const keys = [
        ...new Set([...Object.keys(cells1 || {}), ...Object.keys(cells2 || {})])
      ];
      const set = new Set(Object.keys(prev || {}));
      const res = keys
        .map((k) => {
          const v1 = cells1?.[k];
          const v2 = cells2?.[k];
          if (v1 === undefined && v2 === undefined)
            throw new Error(keys.join(","));
          // skip undefined values as an option
          // note: `v1` and `v2` can't both be `undefined`
          if (
            (options?.skipAUndefined && v1 === undefined) ||
            (options?.skipBUndefined && v2 === undefined)
          )
            return;
          // we reuse a previous cell if mapped from same dependencies
          const prevDeps = prev?.[k]?.dependencies || [];
          const reuse = isEqual(
            prevDeps,
            [v1?.id, v2?.id].filter((v) => v !== undefined)
          );
          // const reuse = prev?.[k] !== undefined;
          // console.log(`NODE= ${options?.name || ""} reuse=${reuse}: ${k}`);
          // proxy._sheet.debug(undefined, "map2Objects", { v1, v2, reuse });
          if (reuse) set.delete(k);
          return [k, reuse ? prev[k] : fn(k, v1 || null, v2 || null)] as [
            string,
            MapCell<M, NF>
          ];
        })
        .filter((v) => v !== undefined); // strip the skipped keys
      // collect unused previously mapped cells
      if (options?.onRemove)
        for (const k of [...set]) options.onRemove(prev[k]?.value as M);
      proxy._sheet.collect(...[...set].map((k) => prev[k]));

      return Object.fromEntries(res);
    },
    options?.name || "map2Objects",
    options?.nf || false
  );

/**
 * map2Objects applies a function to two CellObjects.
 * default R: Record<string, AnyCell<M>
 */
export const map2ObjectsMixed = <A, B, M, NF extends boolean = false>(
  proxy: SheetProxy,
  obj1: AnyCell<Record<string, A>>,
  obj2: CellObject<B>,
  fn: (
    key: string,
    value1Cell: A,
    value2Cell: AnyCell<B>
  ) => MapCell<M, false> | Promise<MapCell<M, false>>, // @todo NF
  options?: MapOptions<M, NF>
): MapCell<Record<string, MapCell<M, NF>>, NF> =>
  proxy.map(
    [obj1, obj2],
    (cells1, cells2, prev) => {
      const keys = [
        ...new Set([...Object.keys(cells1 || {}), ...Object.keys(cells2 || {})])
      ];
      const set = new Set(Object.keys(prev || {}));
      const res = keys
        .map((k) => {
          const v1 = cells1?.[k];
          const v2 = cells2?.[k];
          if (v1 === undefined && v2 === undefined)
            throw new Error(`dual undefined: ${k}`);
          // skip undefined values as an option
          // note: `v1` and `v2` can't both be `undefined`
          if (
            (options?.skipAUndefined && v1 === undefined) ||
            (options?.skipBUndefined && v2 === undefined)
          )
            return;
          // we reuse a previous cell if mapped from same dependencies
          // const prevDeps = prev?.[k]?.dependencies || [];
          // const reuse = isEqual(
          //   prevDeps,
          //   [
          //     // v1?.id,
          //     v2?.id
          //   ].filter((v) => v !== undefined)
          // );
          const reuse = v2 && prev?.[k]?.dependencies?.[0] === v2?.id;
          // const reuse = prev?.[k] !== undefined;
          // console.log(`NODE= ${options?.name || ""} reuse=${reuse}: ${k}`);
          // proxy._sheet.debug(undefined, "map2Objects", { v1, v2, reuse });
          if (reuse) set.delete(k);
          return [k, reuse ? prev[k] : fn(k, v1 || null, v2 || null)] as [
            string,
            MapCell<M, NF>
          ];
        })
        .filter((v) => v !== undefined); // strip the skipped keys
      // collect unused previously mapped cells
      if (options?.onRemove)
        for (const k of [...set]) options.onRemove(prev[k]?.value as M);
      proxy._sheet.collect(...[...set].map((k) => prev[k]));

      return Object.fromEntries(res);
    },
    options?.name || "map2ObjectsMixed",
    options?.nf || false
  );

/**
 * mapArray implements .map() for a cellified array.
 *
 * @param proxy
 * @param arr canonical form cell array
 * @param fn to map each element cell
 * @returns mapped array cell
 *
 * @description This function reuses existing mapped cells.
 * @todo Delete unused mapped cells
 */
export const mapArray = <T, U, NF extends boolean = false>(
  proxy: SheetProxy,
  arr: CellArray<T>,
  fn: (
    v: T,
    index?: number,
    cell?: AnyCell<T>
  ) => U | Promise<U | AnyCell<U>> | AnyCell<U>,
  options?: MapOptions<U, NF>
): MapCell<MapCell<U, false>[], false> =>
  proxy.map(
    [arr],
    (cells, prev) => {
      if (!Array.isArray(cells))
        throw new Error(`not an array: ${typeof cells}`);
      if (!cells) return [];
      const set = new Set((prev || []).map((cell) => cell.id));
      const res = cells.map((cell, index) => {
        // reuse previously mapped cell
        const reuse = prev?.find((_c) => _c.dependencies?.[0] === cell.id);
        if (reuse !== undefined) set.delete(reuse.id);
        return (
          reuse ||
          // create new map
          (proxy.map(
            [cell],
            (_cell, _prev) => _prev || fn(_cell, index, cell),
            `${cell.id}:[${index}]`
          ) as MapCell<U, false>)
        );
      });
      // collect unused previously mapped cells
      if (options?.onRemove)
        for (const id of [...set])
          options.onRemove(proxy._sheet.get(id).value as U);
      proxy._sheet.collect(...[...set]);
      return res;
    },
    options?.name || "mapArray"
  );

/**
 * mapObject applies a function to a CellObject.
 */
export const mapObject = <T, U, NF extends boolean = false>(
  proxy: SheetProxy,
  obj: CellObject<T>,
  // @todo return type
  fn: (
    key: string,
    value: T,
    valueCell: AnyCell<T>
  ) => U | Promise<U | AnyCell<U>> | AnyCell<U>,
  options?: MapOptions<U, NF>
): MapCell<Record<string, AnyCell<U>>, NF> =>
  proxy.map(
    [obj],
    (cells, prev) => {
      const set = new Set(Object.keys(prev || {}));
      const res = Object.fromEntries(
        Object.entries(cells).map(([k, v]) => {
          // we reuse a previous cell if the key is the same and still maps to same v
          const reuse =
            (prev?.[k] && prev[k].dependencies?.[0] === v.id) || false;
          if (reuse) set.delete(k);
          // console.log({ k, reuse, prev: prev?.[k]?.id });
          return [
            k,
            reuse
              ? prev[k]
              : (proxy.map(
                  [v],
                  (_v, _prev) => _prev || fn(k, _v, v),
                  `[${k}]µ`
                ) as MapCell<U, false>)
          ];
        })
      );
      // collect unused previously mapped cells
      if (options?.onRemove)
        for (const k of [...set]) options.onRemove(prev[k]?.value as U);
      proxy._sheet.collect(...[...set].map((k) => prev[k]));
      return res;
    },
    options?.name || "mapObject",
    options?.nf
  );

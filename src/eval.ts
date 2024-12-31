import type { AnyCell, SheetProxy } from "@okcontract/cells";
import type { Environment } from "@okcontract/lambdascript";

import type {
  LabelledTypeDefinition,
  MapTypeDefinitions,
  TypeScheme
} from "./types";

// Optional arguments for evalType function
export type EvalTypeOptions = {
  level?: number;
  env?: Environment;
  par?: unknown;
};

/**
 * evalType evaluates a type.
 * @param schema
 * @param ty
 * @param value
 * @param deep
 * @param
 * @returns LabelledTypeDefinition cell
 */
export const evalType = (
  proxy: SheetProxy,
  sc: TypeScheme,
  ty: AnyCell<LabelledTypeDefinition>,
  value: AnyCell<unknown>,
  deep = true,
  opts?: EvalTypeOptions // { level = 0, env, par }
) =>
  proxy.map([sc.types, sc.values, ty, value], (_types, _values, _ty, _value) =>
    evalTypeAux(proxy, _types, _ty, _value, deep, opts)
  );

export const evalTypeAux = async (
  proxy: SheetProxy,
  types: MapTypeDefinitions,
  ty: LabelledTypeDefinition,
  value: unknown,
  deep = true,
  opts?: EvalTypeOptions // { level = 0, env, par }
): Promise<LabelledTypeDefinition> => {
  // console.log("evalTypeAux", { types, ty, value });
  const { env, par } = opts || {};
  const level = opts?.level || 0;
  if (!ty) return;
  if ("name" in ty) {
    const tyName = types[ty?.name];
    // console.log("evalTypeAux", { tyName, ty });
    if (tyName instanceof Error) throw tyName;
    const st = await tyName()?.get();
    // console.log("evalTypeAux", { tyName, st });
    return {
      ...ty,
      ...st,
      label: ty?.label,
      // @todo check semantics
      optional: ("optional" in ty && ty.optional) || undefined
    };
  }
  if (!deep && level > 0) return ty;
  if ("array" in ty) {
    const arrayTy = ty.array;
    const newTy = await arrayTy().get();
    const ltd = await evalTypeAux(
      proxy,
      types,
      { label: ty.label, ...newTy },
      value,
      deep,
      {
        level: level + 1,
        env,
        par
      }
    );
    return {
      ...ty,
      // FIXME: support local label for given array element
      array: () => proxy.new(ltd)
    };
  }

  if ("object" in ty) {
    const object = await ty.object.get();
    if (object instanceof Error) throw object;
    return {
      ...ty,
      object: proxy.new(
        Object.fromEntries(
          await Promise.all(
            Object.entries(object).map(async ([k, fn]) => {
              // @todo should pass node
              const fnTypeDef = await fn()?.get();
              if (fnTypeDef instanceof Error) throw fnTypeDef;

              return [
                k,
                () =>
                  proxy.new(
                    evalTypeAux(proxy, types, fnTypeDef, value, deep, {
                      level: level + 1,
                      env,
                      par
                    })
                  )
              ];
            })
          )
        ),
        "schema.evalTypeAux"
      )
    };
  }
  if ("dict" in ty) {
    return {
      ...ty,
      dict: () =>
        proxy.new(async () =>
          evalTypeAux(
            proxy,
            types,
            { label: ty.label, ...(await ty.dict().get()) },
            value,
            deep,
            {
              level: level + 1,
              env,
              par
            }
          )
        )
    };
  }
  return ty;
};

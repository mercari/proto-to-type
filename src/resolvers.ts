import protobuf from 'protobufjs';
import type { GeneratorContext } from './context';
import type { SerializableReflection } from './serialize';

const methodChildrenKey = ['resolvedResponseType', 'resolvedRequestType'] as const;

/**
 * resolves reflection object's name recursively depending on the type of parent reflection
 * note that reflection objects themselves in the initial queue are not resolved, but children are.
 */
export const resolveReflections = (ctx: GeneratorContext, queue: (protobuf.ReflectionObject | null)[]) => {
  while (queue.length) {
    const ref = queue.shift();
    if (!ref) continue;

    if (ref instanceof protobuf.Field) {
      tryResolve(ctx, ref);
      const { resolvedType } = ref;
      if (resolvedType) {
        resolveName(ctx, resolvedType, ref.parent);
        queue.push(resolvedType);
      }
      // there is `map` type in the specification of `protobuf`,
      // but actual keys are converted into strings, so we can skip resolving the key.
      // ref: https://developers.google.com/protocol-buffers/docs/proto3#json
      // if (ref instanceof protobuf.MapField) {}
    } else if (ref instanceof protobuf.Method) {
      tryResolve(ctx, ref);
      methodChildrenKey.forEach((key) => {
        const resolvedType = ref[key];
        if (resolvedType) {
          resolveName(ctx, resolvedType, ref);
          queue.push(resolvedType);
        }
      });
    } else if (ref instanceof protobuf.Service) {
      ref.methodsArray.forEach((method) => {
        resolveName(ctx, method, ref);
        queue.push(method);
      });
    } else if (ref instanceof protobuf.Type) {
      ref.oneofsArray.forEach((oneof) => resolveName(ctx, oneof, ref));
      queue.push(...ref.oneofsArray);
      queue.push(...ref.fieldsArray);
    } else if (ref instanceof protobuf.OneOf) {
      queue.push(...ref.fieldsArray);
    }
    // enum has no children so nothing to do
    // if (ref instanceof protobuf.Enum) {}
  }
};

/**
 * resolve reflection object's name to be referenced correctly
 */
export const resolveName = (
  ctx: GeneratorContext,
  ref: SerializableReflection,
  referer: protobuf.ReflectionObject | null,
) => {
  if (ctx.resolvedNames.has(ref)) return;

  // `oneof` doesn't matter whether it is in main package or not
  if (ref instanceof protobuf.OneOf) {
    if (!ctx.resolvedNames.has(ref.parent as SerializableReflection)) return;
    const prefix = ctx.resolvedNames.get(ref.parent as SerializableReflection);
    ctx.resolvedNames.set(ref, `${prefix}.${ref.name}`);
  }

  if (referer instanceof protobuf.Method && ctx.resolvedNames.has(referer)) {
    const prefix = ctx.resolvedNames.get(referer)!;
    if (ref === referer.resolvedRequestType) {
      ctx.resolvedNames.set(ref, `${prefix}.Request`);
      return;
    } else if (ref === referer.resolvedResponseType) {
      ctx.resolvedNames.set(ref, `${prefix}.Response`);
      return;
    }
  }

  if (ref.fullName.startsWith(ctx.mainPackage)) {
    if (ref instanceof protobuf.Enum) ctx.resolvedNames.set(ref, `Enums.${ref.name}`);
    else if (ref instanceof protobuf.Type) ctx.resolvedNames.set(ref, `Messages.${ref.name}`);
    // services under the main package should come the top level of the root namespace
    else if (ref instanceof protobuf.Service) ctx.resolvedNames.set(ref, ref.name);
    else if (ref instanceof protobuf.Method) {
      if (ref.parent) {
        // The parent is under main package too.
        ctx.resolvedNames.set(ref, `${ref.parent.name}.${ref.name}`);
      } else {
        ctx.resolvedNames.set(ref, `Methods.${ref.name}`);
      }
    }
  } else {
    // emit under "Externals" to avoid name conflicts
    ctx.resolvedNames.set(ref, `Externals${ref.fullName}`);
  }
};

/**
 * resolve reflection object if it's needed
 */
export const tryResolve = (ctx: GeneratorContext, ref: protobuf.ReflectionObject) => {
  try {
    if (ref.resolved) return;
    if (ref instanceof protobuf.Field) {
      // skip if the type is predefined
      if (ref.type in ctx.predefinedTypes) return;
    }
    ref.resolve();
  } catch (e) {
    // don't care about deep resolving if shallow resolving succeeded
    if (ref.resolved) return;
    // eslint-disable-next-line no-console
    console.log(e);
  }
};

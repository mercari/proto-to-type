import protobuf from 'protobufjs';
import { nestSerializer, Layer } from './utils/nest';
import type { GeneratorContext } from './context';

export type SerializableReflection =
  | protobuf.Enum
  | protobuf.Type
  | protobuf.Service
  | protobuf.Method
  | protobuf.OneOf;

export interface SerializerOptions extends FormatOptions {
  transformWrapper?: (wrapper: Layer) => Layer;
  format?: (content: string) => string;
}

interface FormatOptions {
  /**
   * @default 'str'
   */
  enumFormat?: 'str' | 'num' | 'mixed';
  strictOneof?: boolean | 'hybrid';
}

const defaultFormatOptions: Required<FormatOptions> = {
  enumFormat: 'str',
  strictOneof: false,
};

const through = <T>(value: T) => value;

/**
 * serialize context
 */
export const serialize = (ctx: GeneratorContext, wrapper: Layer, options: SerializerOptions) => {
  const { format = getDefaultFormatter(), transformWrapper = through } = options;
  const raw = nestSerializer(
    ctx.resolvedNames,
    transformWrapper(wrapper),
    (name) => [`namespace ${name} {`, '}'],
    (ref) => serializeReflection(ctx, ref, options),
  );

  return format(raw);
};

export const getDefaultFormatter = () => {
  try {
    require.resolve('prettier');
    const prettier = require('prettier') as typeof import('prettier');
    return (content: string) => prettier.format(content, { parser: 'typescript' });
  } catch (e) {
    return through;
  }
};

/**
 * serialize reflection to [header content, footer content]
 */
export const serializeReflection = (
  ctx: GeneratorContext,
  ref: SerializableReflection,
  options: FormatOptions,
): [string, string] => {
  const names = getSerializedName(ctx, ref).split('.');
  const name = names[names.length - 1];
  options = { ...defaultFormatOptions, ...options };

  if (ref instanceof protobuf.Enum) {
    const values = Object.entries(ref.values);
    const { enumFormat: format } = options;
    const isMixed = format === 'mixed';
    return [
      `
      type ${name} = ${values.map(([n]) => `${name}.${n}`).join('|')};
      namespace ${name} {${
        (isMixed || '') &&
        `
        type _num = Extract<${name}, number>;
        type _str = Extract<${name}, string>;`
      }
        ${values.reduce((acc, [n, v]) => {
          const str = `'${n}'`;
          const num = `${v}`;
          const mixed = isMixed ? `${str}|${num}` : '';
          const type = `type ${n} = ${{ str, num, mixed }[format!] || 'unknown'}`;
          const line = `${type}\nnamespace ${n} { const str: ${str}; const num: ${num} }`;
          return acc ? `${acc}\n${line}` : line;
        }, '')}
      `,
      '}',
    ];
  }

  if (ref instanceof protobuf.Type) {
    const { strictOneof } = options;
    const excludes = (strictOneof ? ref.oneofsArray : []).reduce<string[]>((acc, { oneof }) => {
      acc.push(...oneof);
      return acc;
    }, []);

    const properties = Object.entries(ref.fields).reduce((acc, [fieldName, field]) => {
      // excludes if needed because `protobufjs` parses oneofs as fields too
      if (excludes.includes(fieldName)) return acc;
      const Q = field.optional ? '?' : '';
      const R = field.repeated ? '[]' : '';
      const type = getSerializedName(ctx, field.resolvedType || field.type);
      const mapType = field instanceof protobuf.MapField ? `Record<string, ${type}>` : '';
      const line = `${fieldName}${Q}: ${mapType || type}${R}`;
      return acc ? `${acc}\n${line}` : line;
    }, '');

    if (!strictOneof || !ref.oneofsArray.length) {
      return [`interface ${name} {\n${properties}\n}\nnamespace ${name} {`, '}'];
    }

    const oneofs = ref.oneofsArray.map((oneof) => getSerializedName(ctx, oneof));
    const hybrid = strictOneof === 'hybrid';
    const i = `interface ${hybrid ? name : '_base'} {\n${properties}\n}`;
    const t = `type ${hybrid ? '_strict' : name} = ${name}${hybrid ? '' : '._base'} & ${oneofs.join('&')};`;

    if (strictOneof === 'hybrid') {
      return [`${i}\nnamespace ${name} {\n${t}`, '}'];
    } else {
      return [`${t}\nnamespace ${name} {\n${i}`, '}'];
    }
  }

  if (ref instanceof protobuf.Method) {
    const [endpoint, url] = Object.entries(ref.options || {})[0];
    return [
      `
      namespace ${name} {
        const Endpoint: '${endpoint}';
        const Url: '${url}';
      `.trim(),
      '}',
    ];
  }

  if (ref instanceof protobuf.OneOf) {
    // empty string means the type whose properties are all `never`
    const contents = [...ref.oneof, ''].map((key) => {
      const fields = ref.fieldsArray.reduce((acc, field) => {
        const isSelf = key === field.name;
        const type = isSelf ? getSerializedName(ctx, field.resolvedType || field.type) : 'never';
        const Q = isSelf ? '' : '?';
        const line = `${field.name}${Q}: ${type};`;
        return acc ? `${acc}\n${line}` : line;
      }, '');
      return `{${fields}}`;
    });
    return [`type ${name} = ${contents.join('|')};`, ''];
  }

  return [`namespace ${name} {`, '}'];
};

export const getSerializedName = (ctx: GeneratorContext, ref: SerializableReflection | string) => {
  if (typeof ref === 'string') {
    if (ref in ctx.predefinedTypes) {
      return ctx.predefinedTypes[ref];
    } else {
      // count unresolved types
      ctx.unresolvedTypes[ref] = (ctx.unresolvedTypes[ref] || 0) + 1;
      return ref;
    }
  } else if (ctx.resolvedNames.has(ref)) {
    return ctx.resolvedNames.get(ref)!;
  } else {
    const name = `Externals${ref.fullName}`;
    // eslint-disable-next-line no-console
    console.warn(`'proto-to-type' treats '${ref.fullName}' as external because it is not resolved.`);
    return name;
  }
};

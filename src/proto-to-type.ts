import protobuf from 'protobufjs';
import { fetchProtoAll, FetcherOptions } from './fetch-proto';
import { createContext, GeneratorContextOptions } from './context';
import { resolveReflections } from './resolvers';
import { serialize, SerializerOptions } from './serialize';

export interface GeneratorOptions extends FetcherOptions, SerializerOptions, GeneratorContextOptions {}

export const ProtoToType = (options: GeneratorOptions) => {
  const generate = async (rootName: string, location: string, entrypoints: string[]) => {
    // step 1: fetch all related proto and accumulate reflections to the root
    const root = new protobuf.Root();
    const mainPackage = await fetchProtoAll(root, location, options);

    // step 2: prepare context
    const ctx = createContext(root, mainPackage, options);

    // step 3: look up entrypoints' reflection objects
    const entryReflections = entrypoints.map((entrypoint) => {
      const name = `${mainPackage}.${entrypoint}`;
      const ref = ctx.root.lookup(name);
      // eslint-disable-next-line no-console
      if (!ref) console.warn(`no resolved reflection found for ${name}`);
      return ref;
    });

    // step 4: resolve reflection objects recursively
    resolveReflections(ctx, entryReflections);

    // step 5: serialize context
    const content = serialize(ctx, [`declare namespace ${rootName} {`, '}'], options);

    Object.entries(ctx.unresolvedTypes).forEach(([name, count]) => {
      // eslint-disable-next-line no-console
      console.log(`'${name}' was not resolved correctly ${count} times.`);
    });

    return content;
  };

  return generate;
};

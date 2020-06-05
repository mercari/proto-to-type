import protobuf from 'protobufjs';

export type ImportResolver = (target: string, weak: boolean) => ProtoRequest | null;
export interface FetcherOptions {
  /**
   * filter and transform import target string
   */
  resolveImport: ImportResolver;
  /**
   * fetch proto content with resolved location
   */
  fetchers?: Record<string, ProtoFetcher>;
}

export type ProtoFetcher = (...args: string[]) => Promise<string> | string;
type ExtarctRequests<T extends Record<string, ProtoFetcher>> =
  | [string, ...string[]]
  | {
      [K in keyof T]: ((type: K, ...args: Parameters<T[K]>) => 0) extends (...args: infer U) => 0 ? U : never;
    }[keyof T];
export type ProtoRequest = ExtarctRequests<typeof defaultFetchers>;

export const defaultFetchers = {
  'github-contents': (repo: string, path: string, commit: string) => {
    const { execSync } = require('child_process') as typeof import('child_process');
    const response = execSync(`hub api '/repos/${repo}/contents/${path}?ref=${commit}'`);
    return Buffer.from(JSON.parse(response.toString('utf-8')).content, 'base64').toString();
  },
  'read-file': (file: string) => {
    const { readFileSync } = require('fs') as typeof import('fs');
    return readFileSync(file).toString();
  },
};

const routeFetcher = ([type, ...args]: ProtoRequest, custom: Partial<Record<string, ProtoFetcher>>) => {
  const fetch = custom[type] ?? (defaultFetchers as typeof custom)[type];
  if (fetch) {
    return fetch(...args);
  } else {
    // eslint-disable-next-line no-console
    console.warn(`Unknown fetcher type ${type}: set custom fetcher`);
    return null;
  }
};

/**
 * fetch and assign proto file
 * It retuns loaded package name and its dependencies.
 * If no fetch option is assigned, it uses `hub` command.
 */
export const fetchProtoOnce = async (root: protobuf.Root, request: ProtoRequest, options: FetcherOptions) => {
  const { resolveImport } = options;
  try {
    const proto = await routeFetcher(request, options.fetchers || {});
    if (!proto) return [[]] as const;

    const meta = protobuf.parse(proto, root);

    const dependencies: (ProtoRequest | null)[] = [
      ...(meta.imports ?? []).map((target) => resolveImport(target, false)),
      ...(meta.weakImports ?? []).map((target) => resolveImport(target, true)),
    ];

    // incert '.' to align name format to parser.ReflectionObject.fullname
    const packageName = meta.package && `.${meta.package}`;

    return [dependencies.filter<ProtoRequest>(Boolean as any), packageName] as const;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e.stack);
    process.exit(1);
  }
};

/**
 * fetch needed proto files recursively
 */
export const fetchProtoAll = async (root: protobuf.Root, location: string, options: FetcherOptions) => {
  const mainLocation = options.resolveImport(location, false);
  if (!mainLocation) {
    // eslint-disable-next-line no-console
    console.log('Failed to resolve main location.');
    process.exit(1);
  }

  const [dependencies, mainPackage] = await fetchProtoOnce(root, mainLocation, options);
  if (!mainPackage) {
    // eslint-disable-next-line no-console
    console.log('No main package name found.');
    process.exit(1);
  }

  const queue = [...dependencies];
  const fetched = new Set<string>([location]);
  while (queue.length) {
    const dependency = queue.shift()!;
    const id = dependency.join('');
    if (fetched.has(id)) continue;

    const [next] = await fetchProtoOnce(root, dependency, options);
    fetched.add(id);
    queue.push(...next);
  }
  return mainPackage;
};

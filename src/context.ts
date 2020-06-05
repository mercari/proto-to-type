import type { SerializableReflection } from './serialize';

export interface GeneratorContext {
  /**
   * all resolved proto files' contents are populated to it
   */
  readonly root: protobuf.Root;
  /**
   * package name of entrypoint
   */
  readonly mainPackage: string;
  readonly resolvedNames: Map<SerializableReflection, string>;
  readonly predefinedTypes: Record<string, string>;
  readonly unresolvedTypes: Record<string, number>;
}

export interface GeneratorContextOptions {
  /**
   * define manually primitive types and external types not loaded
   */
  predefinedTypes: Record<string, string>;
}

export const createContext = (
  root: protobuf.Root,
  mainPackage: string,
  options: GeneratorContextOptions,
): GeneratorContext => ({
  root,
  mainPackage,
  resolvedNames: new Map<SerializableReflection, string>(),
  predefinedTypes: Object.assign(Object.create(null), options.predefinedTypes),
  unresolvedTypes: Object.create(null),
});

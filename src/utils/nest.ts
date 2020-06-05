import { flatten } from 'array-flatten';

export interface Nest {
  [key: string]: Nest;
}
export type NestHandler = (nest: Nest, name: string, depth: number) => void;

export const digNest = (root: Nest, names: string[], callback?: NestHandler): Nest => {
  let curr = root;
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (!(name in curr)) curr[name] = digNest.createNest();
    curr = curr[name];
    callback?.(curr, name, i);
  }
  return curr;
};
digNest.createNest = (): Nest => Object.create(null);

export type Layer = readonly [string, string]; // [header, footer]
export type LayerWithChildren = [string, LayerWithChildren[], string];
export type MidSerializer = (name: string, index: number) => Layer;
export type EndSerializer<T> = (entry: T, name: string, index: number, current: Layer) => Layer;

const createLayer = ([h, f]: Layer = ['', '']): LayerWithChildren => [h, [], f];

/**
 * Serialize entries with nest structure based on names split by dots.
 * @example
 * 'Japan.Tokyo.Minato' becomes like:
 * namespace Japan {
 *   namespace Tokyo {
 *     namespace Minato {
 *       // definitions
 *     }
 *   }
 * }
 * @param entries map contains entry and name
 * @param wrapper top level layer
 * @param midSerializer serializer for intermediate layer
 * @param endSerializer serializer for entry
 */
export const nestSerializer = <T>(
  entries: Map<T, string>,
  wrapper: Layer,
  midSerializer: MidSerializer,
  endSerializer: EndSerializer<T>,
) => {
  const rootNest = digNest.createNest();
  const rootLayer = createLayer(wrapper);
  const layers = new Map<Nest, LayerWithChildren>();
  layers.set(rootNest, rootLayer);

  // TODO: consider about name conflict
  // not only same names, 'Japan.Tokyo.Chiyoda' and 'Japan.Tokyo' also conflict
  entries.forEach((fullName, entry) => {
    const names = fullName.split('.').filter(Boolean);
    let parent = rootLayer;
    // `digNest` helps resolving fastly nest structure from names.
    // It ensures correct nest structure, so we can focus on construction in each layer and its parent.
    digNest(rootNest, names, (nest, name, index) => {
      if (layers.has(nest)) {
        parent = layers.get(nest)!;
      } else {
        const layer = createLayer(midSerializer(name, index));
        layers.set(nest, layer);
        parent[1].push(layer);
        parent = layer;
      }
    });
    const lastDepth = names.length - 1;
    const lastName = names[lastDepth];
    [parent[0], parent[2]] = endSerializer(entry, lastName, lastDepth, [parent[0], parent[2]]);
  });

  return flatten(rootLayer).join('');
};

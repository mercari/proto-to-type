import protobuf from 'protobufjs';
import { createContext, GeneratorContextOptions } from '../context';

describe('createContext', () => {
  it('works correctly', () => {
    const root = new protobuf.Root();
    const mainPackage = '.main.package';
    const options: GeneratorContextOptions = {
      predefinedTypes: {
        string: 'string',
        number: 'number',
        bool: 'boolean',
      },
    };

    const result = createContext(root, mainPackage, options);

    expect(result.root).toBe(root);
    expect(result.mainPackage).toBe(mainPackage);
    expect(result.resolvedNames.size).toBe(0);
    expect(result.resolvedNames).toBeInstanceOf(Map);

    expect(result.predefinedTypes).not.toBe(options.predefinedTypes);
    expect(result.predefinedTypes).toEqual(options.predefinedTypes);
    expect(result.predefinedTypes).not.toHaveProperty('hasOwnProperty');
    expect(result.predefinedTypes).not.toHaveProperty('constructor');
    expect(result.predefinedTypes).not.toHaveProperty('__proto__');

    expect(result.unresolvedTypes).not.toHaveProperty('hasOwnProperty');
    expect(result.unresolvedTypes).not.toHaveProperty('constructor');
    expect(result.unresolvedTypes).not.toHaveProperty('__proto__');
  });
});

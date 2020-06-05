import { ProtoToType, GeneratorOptions } from '../proto-to-type';
import { importResolverForTesting as resolveImport } from '../../jest/importResolver';
import wrap from 'jest-snapshot-serializer-raw';

const consoleLog = jest.spyOn(console, 'log');
const consoleWarn = jest.spyOn(console, 'warn');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProtoToType', () => {
  it('generates type definition correctly', async () => {
    const generate = ProtoToType({
      resolveImport,
      predefinedTypes: { 'predefined.type': '100', string: 'string', int32: 'number', int64: 'number' },
    });
    const result = await generate('Sample', 'sample.proto', ['SampleService']);

    expect(consoleLog.mock.calls.length).toBe(0);
    expect(consoleWarn.mock.calls.length).toBe(0);
    expect(wrap(result)).toMatchSnapshot();
  });

  it('other formats', async () => {
    const args: Parameters<typeof generate> = ['Sample', 'sample.proto', ['SampleService']];
    const common: GeneratorOptions = {
      resolveImport,
      predefinedTypes: { 'predefined.type': '100', string: 'string', int32: 'number', int64: 'number' },
    };

    let generate = ProtoToType({ ...common, enumFormat: 'num' });
    expect(wrap(await generate(...args))).toMatchSnapshot('enumFormat: num');

    generate = ProtoToType({ ...common, enumFormat: 'mixed' });
    expect(wrap(await generate(...args))).toMatchSnapshot('enumFormat: mixed');

    generate = ProtoToType({ ...common, strictOneof: true });
    expect(wrap(await generate(...args))).toMatchSnapshot('strictOneof: true');

    generate = ProtoToType({ ...common, strictOneof: 'hybrid' });
    expect(wrap(await generate(...args))).toMatchSnapshot('strictOneof: hybrid');
  });

  it('warns if entrypoint wrongs', async () => {
    const generate = ProtoToType({
      resolveImport,
      predefinedTypes: { 'predefined.type': '100', string: 'string', int32: 'number', int64: 'number' },
    });
    const result = await generate('Sample', 'sample.proto', ['NeverService']);

    expect(consoleLog.mock.calls.length).toBe(0);
    expect(consoleWarn.mock.calls.length).toBe(1);
    expect(wrap(result)).toMatchSnapshot();
  });

  it('logs if unresolved type found', async () => {
    const generate = ProtoToType({
      resolveImport,
      predefinedTypes: { 'predefined.type': '100' },
    });
    const result = await generate('Sample', 'sample.proto', ['SampleService']);

    expect(consoleLog.mock.calls.length).toBe(3);
    expect(consoleWarn.mock.calls.length).toBe(0);
    expect(wrap(result)).toMatchSnapshot();
  });
});

import protobuf from 'protobufjs';
import { wrap } from 'jest-snapshot-serializer-raw';
import { fetchProtoOnce, fetchProtoAll, defaultFetchers } from '../fetch-proto';
import { importResolverForTesting as resolveImport, protoFiles } from '../../jest/importResolver';

const exitSymbol = Symbol();

const spyExit = jest.spyOn(process, 'exit');
spyExit.mockImplementation(() => {
  throw exitSymbol;
});

const { METRIC, LABEL, LAUNCH_STAGE, DURATION } = protoFiles;

describe('fetchProtoOnce', () => {
  const resolvedRequest = resolveImport(METRIC, false)!;
  it('correctly parses proto file', async () => {
    const root = new protobuf.Root();
    const [dependencies, packageName] = await fetchProtoOnce(root, resolvedRequest, { resolveImport });

    const expected = [LABEL, LAUNCH_STAGE, DURATION].map((target) => resolveImport(target, false));

    expect(packageName).toBe('.google.api');
    expect(dependencies).toEqual(expected);
    expect(wrap(JSON.stringify(root, null, '  '))).toMatchSnapshot();
  });

  it('supports custom fetcher', async () => {
    const root = new protobuf.Root();
    const customized = jest.fn(defaultFetchers['github-contents']);
    await fetchProtoOnce(root, resolvedRequest, {
      resolveImport,
      fetchers: { 'github-contents': customized },
    });
    expect(customized.mock.calls.length).toBe(1);
  });

  it('exits if something wrong happens', () => {
    const root = new protobuf.Root();
    const promise = fetchProtoOnce(root, resolvedRequest, {
      resolveImport,
      fetchers: {
        'github-contents': () => {
          throw new Error('Error for testing');
        },
      },
    });
    expect(promise).rejects.toBe(exitSymbol);
  });
});

describe('fetchProtoAll', () => {
  it('correctly parses proto files recursively', async () => {
    const root = new protobuf.Root();
    const mainPackage = await fetchProtoAll(root, METRIC, { resolveImport });

    expect(mainPackage).toBe('.google.api');
    expect(wrap(JSON.stringify(root, null, '  '))).toMatchSnapshot();
  });

  it('exits if main location resolving failed', () => {
    const root = new protobuf.Root();
    const promise = fetchProtoAll(root, '', { resolveImport });
    expect(promise).rejects.toBe(exitSymbol);
  });

  it('exits if main package name is missing', () => {
    const root = new protobuf.Root();
    const promise = fetchProtoAll(root, 'no-package.proto', { resolveImport });
    expect(promise).rejects.toBe(exitSymbol);
  });
});

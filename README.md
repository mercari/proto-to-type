# proto-to-type

`proto-to-type` is almost pure Node.js library that generates type definition for TypeScript from Protocol Buffer file(`.proto`).

This library uses some packages from npm registry, [`protobufjs`](https://www.npmjs.com/package/protobufjs) is used as `.proto` file parser, [`array-flatten`](https://www.npmjs.com/package/array-flatten) helps serialization and [`prettier`](https://www.npmjs.com/package/prettier) is used as default formatter.

It also uses [`hub`](https://github.com/github/hub) command to fetch `.proto` files from GitHub.

## Installation

```sh
$ npm i -D proto-to-type
$ npm i -D prettier # You can skip if you use custom formatter.
```
### `hub` command
You can follow [this page](https://github.com/github/hub#installation) to install it. (You can skip if you have already had the command.)

## Usage

### Sample Code
```ts
import ProtoToType, { ImportResolver } from 'proto-to-type';
import { writeFileSync } from 'fs';

const locals = ['entrypoint.proto', 'path/to/another.proto'];

const resolveImport: ImportResolver = (target) => {
  if (locals.includes(target)) {
    return ['read-file', 'path/to/proto/directory/' + target];
  } else if (target.startsWith('google/api/')) {
    return ['github-contents', 'googleapis/googleapis', target, 'master'];
  } else if (target.startsWith('google/protobuf/')) {
    return ['github-contents', 'protocolbuffers/protobuf', `src/${target}`, '176f7db1...'/* full of commit id */];
  }

  return null;
};

const generate = ProtoToType({
  resolveImport,
  predefinedTypes: { string: 'string', int32: 'number', 'other.custom.types': 'CustomTypeYouWant' },
});

generate('CustomNamespace', 'entrypoint.proto', ['Entrypoint']).then((result) => {
  writeFileSync('path/to/out.d.ts', result);
});
```
### `ProtoToType`
It initializes the generator. You can set options, some are required.

#### All Generator Options
| name | type | description |
|:---- |:---- |:---------- |
| `resolveImport`   | function  | **required** |
| `predefinedTypes` | object    | **required** |
| `fetchers`        | object    | custom fetchers |
| `transformWrapper`| function  | use to inject custom lines |
| `format`          | function  | custom formatter (use `prettier` if omitted) |
| `enumFormat`      | `'str'`(default), `'num'`, `'mixed'`  | how to define enums |
| `strictOneof`     | `false`(default), `true`, `'hybrid'`  | whether apply `oneof` strictly |

#### generator
The generator requires three arguments.
| index | type | description |
|:----- |:---- |:----------- |
| 0 | string   | name of top namespace that stores output declarations |
| 1 | string   | file target of entry `.proto` file (Note that set it as a non-resolved target, see the `importResolver` section below)
| 2 | string[] | entry items in the `.proto` file, such as services and messages |

### `importResolver`
You need to implement `importResolver` and tell fetcher about location information of `.proto` files. 

`importResolver` must return `ProtoRequest` or `null`. `ProtoRequest` is a string array type and requires one string at least. First string specifies fetcher type(described later) and the rest items are passed as arguments to picked fetcher function.

If the resolver returns `null`, the target is skipped to load.

```ts
type ImportResolver = (target: string, weak: boolean) => ProtoRequest | null;
type ProtoRequest = [string /* fetcher type */, ...string[] /* arguments for fetcher */];
```

### fetcher
`proto-to-type` supports two fetchers `read-file` and `github-contents` by default.

#### `read-file`
It uses `fs.readFileSync`, accepts only one argument(from the rest items) as the file path of `.proto` file.

#### `github-contents`
It uses `hub` command via child process. You may need set `hub` command up to access private repositories.

| index | description |
|:----- |:----------- |
| 0     | repository name (ex: `'protocolbuffers/protobuf'`)|
| 1     | path to `.proto` file |
| 2     | commit, branch, tag id (ex: `'master'`) |

### `fetchers` (Custom Fetcher)
You can add your custom fetcher.

Note that you can overwrite the existing two fetchers if you use the same key.
```ts
const resolveImport: ImportResolver = (target) => {
  return ['custom-fetcher-name', target, 'other', 'arguments', 'you', 'need'];
};

const generate = ProtoToType({
  resolveImport,
  fetchers: {
    // you can skip arguments type declaration
    'custom-fetcher-name': (target, other, arguments, I, want) => {
      /* ...implementation */
      return ''; // return `.proto` file content as a string
    },
  },
  /* ...other options */
});
```

### `predefinedTypes`
Please don't forget filling `predefinedTypes`. By default, a primitive type (`int32`, `string`, `bool`) is serialized as it is.

If you skip loading some `.proto` file in `resolveImport`, types may not be resolved by the parser and be serialized as written in `.proto` file.
```ts
const generate = ProtoToType({
  resolveImport,
  predefinedTypes: { string: 'string', int32: 'number', 'other.custom.types': 'CustomTypeYouWant' },
});
```

### `transformWrapper`
Set `transformWrapper` in generator options if you want to insert custom lines, such as a comment to show that the file is generated one. It receives a tuple `[string, string]` and you should return in the same format, the first is the top content and the second is the bottom.

Note that thay are not empty strings, you can replace the content but it may break results.
```ts
const generate = ProtoToType({
  resolveImport,
  predefinedTypes: {},
  transformWrapper: ([header, footer]) => [`// DO NOT EDIT - GENERATED FILE\n${header}`, footer],
});
```

### `enumFormat`

https://developers.google.com/protocol-buffers/docs/proto3#json_options
>	The name of the enum value as specified in proto is used. Parsers accept both enum names and integer values.

Enum is returned as a string by default, but you can send a request with numeric enum value too. And backend API you use may return enums as a number. So `proto-to-type` supports both cases. See the examples below. You can use `'str'`, `'num'` and `'mixed'`.

#### input `.proto` file
```protobuf
enum Sample {
  UNKNOWN = 0;
  ACTIVE = 1;
  INACTIVE = 2;
  NOT_FOUND = 404;
}
```
#### output `.d.ts` files
`enumFormat`: `'str'`(default)
```ts
type Sample =
  | Sample.UNKNOWN
  | Sample.ACTIVE
  | Sample.INACTIVE
  | Sample.NOT_FOUND;
namespace Sample {
  type UNKNOWN = "UNKNOWN";
  namespace UNKNOWN {
    const str: "UNKNOWN";
    const num: 0;
  }
  type ACTIVE = "ACTIVE";
  namespace ACTIVE {
    const str: "ACTIVE";
    const num: 1;
  }
  type INACTIVE = "INACTIVE";
  namespace INACTIVE {
    const str: "INACTIVE";
    const num: 2;
  }
  type NOT_FOUND = "NOT_FOUND";
  namespace NOT_FOUND {
    const str: "NOT_FOUND";
    const num: 404;
  }
}
```
`enumFormat`: `'num'`
```ts
type Sample =
  | Sample.UNKNOWN
  | Sample.ACTIVE
  | Sample.INACTIVE
  | Sample.NOT_FOUND;
namespace Sample {
  type UNKNOWN = 0;
  namespace UNKNOWN {
    const str: "UNKNOWN";
    const num: 0;
  }
  type ACTIVE = 1;
  namespace ACTIVE {
    const str: "ACTIVE";
    const num: 1;
  }
  type INACTIVE = 2;
  namespace INACTIVE {
    const str: "INACTIVE";
    const num: 2;
  }
  type NOT_FOUND = 404;
  namespace NOT_FOUND {
    const str: "NOT_FOUND";
    const num: 404;
  }
}
```
`enumFormat`: `'mixed'`
```ts
type Sample =
  | Sample.UNKNOWN
  | Sample.ACTIVE
  | Sample.INACTIVE
  | Sample.NOT_FOUND;
namespace Sample {
  type UNKNOWN = "UNKNOWN" | 0;
  namespace UNKNOWN {
    const str: "UNKNOWN";
    const num: 0;
  }
  type ACTIVE = "ACTIVE" | 1;
  namespace ACTIVE {
    const str: "ACTIVE";
    const num: 1;
  }
  type INACTIVE = "INACTIVE" | 2;
  namespace INACTIVE {
    const str: "INACTIVE";
    const num: 2;
  }
  type NOT_FOUND = "NOT_FOUND" | 404;
  namespace NOT_FOUND {
    const str: "NOT_FOUND";
    const num: 404;
  }
}
```

### `strictOneof`
`proto-to-type` supports protobuf's `oneof` type strictly, but the output may be complex for you, so `proto-to-type` generate non-strict `oneof` by default. You can make it srtict as you need.

## Package Release Flow

We use [semantic-release](https://github.com/semantic-release/semantic-release) to automate package release workflow.

- Note that new version will be published every time when anything is merged into master.
- Merge to `next` branch first if you don't want to set the version as default. Users can install the version by `npm i @mercari/proto-to-type@next`.
- Create branches such as `1.x.x` or `1.1.x` if you want to maintain old major releases.

Take a look [this doc](https://github.com/semantic-release/semantic-release/blob/master/docs/usage/workflow-configuration.md#branch-types) about more detail.

## Committers

 * Shota Hatada ([@whatasoda](https://github.com/whatasoda))

## Contribution

Please read the CLA carefully before submitting your contribution to Mercari.
Under any circumstances, by submitting your contribution, you are deemed to accept and agree to be bound by the terms and conditions of the CLA.

https://www.mercari.com/cla/

## License

Copyright 2020 Mercari, Inc.

Licensed under the MIT License.

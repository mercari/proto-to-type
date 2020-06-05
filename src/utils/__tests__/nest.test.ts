import { digNest, nestSerializer } from '../nest';
import prettier from 'prettier';

describe('digNest', () => {
  it('create nest structure by names', () => {
    const expected = {
      Japan: {
        Tokyo: {
          Minato: {},
          Chiyoda: {},
        },
        Osaka: {
          Umeda: {},
        },
      },
    };

    const root = digNest.createNest();
    digNest(root, ['Japan', 'Tokyo', 'Minato']);
    digNest(root, ['Japan', 'Tokyo', 'Chiyoda']);
    digNest(root, ['Japan', 'Osaka', 'Umeda']);

    expect(root).toEqual(expected);
  });

  it('calls callback in each level of the nest', () => {
    const root = digNest.createNest();
    digNest(root, ['Japan', 'Tokyo', 'Minato']);
    digNest(root, ['Japan', 'Tokyo', 'Chiyoda']);
    digNest(root, ['Japan', 'Osaka', 'Umeda']);

    const fn = jest.fn();

    digNest(root, ['Japan', 'Osaka', 'Umeda'], fn);
    expect(fn.mock.calls.length).toBe(3);

    expect(fn.mock.calls[0][0]).toBe(root.Japan);
    expect(fn.mock.calls[0][1]).toBe('Japan');
    expect(fn.mock.calls[0][2]).toBe(0);

    expect(fn.mock.calls[1][0]).toBe(root.Japan.Osaka);
    expect(fn.mock.calls[1][1]).toBe('Osaka');
    expect(fn.mock.calls[1][2]).toBe(1);

    expect(fn.mock.calls[2][0]).toBe(root.Japan.Osaka.Umeda);
    expect(fn.mock.calls[2][1]).toBe('Umeda');
    expect(fn.mock.calls[2][2]).toBe(2);
  });
});

describe('digNest.createNest', () => {
  it('returns empty object', () => {
    const nest = digNest.createNest();
    expect(nest).not.toHaveProperty('hasOwnProperty');
    expect(nest).not.toHaveProperty('constructor');
    expect(nest).not.toHaveProperty('__proto__');
  });
});

describe('nestSerializer', () => {
  it('works correctly', () => {
    const entries = new Map<readonly [boolean, boolean], string>();

    const Minato = [true, false] as const;
    const Chiyoda = [true, true] as const;
    const Umeda = [false, true] as const;
    entries.set(Minato, 'Japan.Tokyo.Minato');
    entries.set(Chiyoda, 'Japan.Tokyo.Chiyoda');
    entries.set(Umeda, 'Japan.Osaka.Umeda');

    const result = nestSerializer(
      entries,
      ['namespace Address {', '}'],
      (name) => [`namespace ${name} {`, '}'],
      ([inTokyo, endWithA], name) => [`type ${name} = { inTokyo: ${inTokyo}; endWithA: ${endWithA} `, '};'],
    );

    const formatted = prettier.format(result, { parser: 'typescript' });
    expect(result).toMatchSnapshot();
    expect(formatted).toMatchSnapshot();
  });
});

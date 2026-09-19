import { describe, expect, it } from 'vitest';
import { parseModelJson, stripCodeFence } from './parse-model-json.js';

interface Thing {
  name: string;
}

function isThing(value: unknown): value is Thing {
  return typeof value === 'object' && value !== null && typeof (value as Thing).name === 'string';
}

describe('stripCodeFence', () => {
  it('leaves plain JSON untouched', () => {
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
  });

  it('strips a ```json fence', () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips a plain ``` fence with no language tag', () => {
    expect(stripCodeFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('trims surrounding whitespace', () => {
    expect(stripCodeFence('  \n{"a":1}\n  ')).toBe('{"a":1}');
  });
});

describe('parseModelJson', () => {
  it('parses and returns valid JSON matching the validator', () => {
    const result = parseModelJson('{"name":"widget"}', isThing);
    expect(result).toEqual({ name: 'widget' });
  });

  it('parses JSON wrapped in a markdown code fence', () => {
    const result = parseModelJson('```json\n{"name":"widget"}\n```', isThing);
    expect(result).toEqual({ name: 'widget' });
  });

  it('throws a "could not parse" error on invalid JSON', () => {
    expect(() => parseModelJson('not json at all', isThing)).toThrow('could not parse');
  });

  it('recovers JSON prefaced with prose commentary', () => {
    const result = parseModelJson('Sure, here you go:\n{"name":"widget"}', isThing);
    expect(result).toEqual({ name: 'widget' });
  });

  it('recovers JSON followed by trailing prose commentary', () => {
    const result = parseModelJson('{"name":"widget"}\n\nLet me know if you need changes!', isThing);
    expect(result).toEqual({ name: 'widget' });
  });

  it('recovers a string value containing a literal, unescaped newline', () => {
    const raw = '{"name":"line one\nline two"}';
    const result = parseModelJson(raw, isThing);
    expect(result).toEqual({ name: 'line one\nline two' });
  });

  it('recovers literal newlines across multiple string fields without corrupting structure', () => {
    interface Scripty {
      script: string;
      scenes: { title: string }[];
    }
    const isScripty = (v: unknown): v is Scripty =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Scripty).script === 'string' &&
      Array.isArray((v as Scripty).scenes);
    const raw =
      '{"script": "Scene 1: Intro.\nScene 2: Dance.\nScene 3: Outro.", "scenes": [{"title": "Intro"}, {"title": "Dance"}]}';
    const result = parseModelJson(raw, isScripty);
    expect(result.script).toBe('Scene 1: Intro.\nScene 2: Dance.\nScene 3: Outro.');
    expect(result.scenes).toEqual([{ title: 'Intro' }, { title: 'Dance' }]);
  });

  it('leaves structural whitespace between JSON tokens untouched', () => {
    const raw = '{\n  "name": "widget"\n}';
    const result = parseModelJson(raw, isThing);
    expect(result).toEqual({ name: 'widget' });
  });

  it('recovers a JSON array wrapped in prose on both sides', () => {
    const result = parseModelJson('Here are the items: [{"name":"a"},{"name":"b"}] hope that helps', (
      v,
    ): v is Thing[] => Array.isArray(v) && v.every(isThing));
    expect(result).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('throws an "unexpected response" error when parsed JSON fails the validator', () => {
    expect(() => parseModelJson('{"wrong":"shape"}', isThing)).toThrow('unexpected response');
  });

  it('throws an "unexpected response" error for valid JSON that is the wrong type entirely', () => {
    expect(() => parseModelJson('42', isThing)).toThrow('unexpected response');
    expect(() => parseModelJson('null', isThing)).toThrow('unexpected response');
    expect(() => parseModelJson('[]', (v): v is Thing[] => Array.isArray(v) && v.length > 0)).toThrow(
      'unexpected response',
    );
  });
});

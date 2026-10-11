import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { check } from '../src/dil/check.ts'

const example = readFileSync(new URL('../src/dil/example.dil', import.meta.url), 'utf8')

test('the example has no problems', () => {
  assert.deepEqual(check(example), [])
})

test('what is left open is named with its line', () => {
  assert.deepEqual(check('<card>\n<box>\n<text>hi</text>\n</card>'), [
    '</card> (line 4) does not close <box> (line 2)',
    '<card> (line 1) is never closed',
  ])
  assert.deepEqual(check('{#if on}\n<text>hi</text>'), ['{#if} (line 1) is never closed'])
  assert.deepEqual(check('<text>hi</text>\n{/each}'), ['{/each} (line 2) closes nothing'])
})

test('an unfinished tail is a problem once the source is finished', () => {
  assert.deepEqual(check(example.slice(0, example.indexOf('max={500}'))), [
    '<slider> (line 14) is unfinished',
    '<card> (line 13) is never closed',
  ])
})

test('code that does not parse is quoted, and never run', () => {
  assert.deepEqual(check('{@body globalThis.ran = true}\n{@body const a = }\n<stat value={1 +* 2}/>'), [
    '{@body const a = }: Unexpected token \'}\'',
    '{1 +* 2}: Unexpected token \'*\'',
  ])
  assert.equal('ran' in globalThis, false)
})

test('code embedded in a quoted attribute is checked too', () => {
  assert.deepEqual(check('<stat label="After {years +} years"/>'), ['{`After ${years +} years`}: Unexpected token \'}\''])
})

test('only the vocabulary is allowed', () => {
  assert.deepEqual(check('<card><div>hi</div></card>'), ['<div> is not an element'])
})

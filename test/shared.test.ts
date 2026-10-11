import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readArgs } from '../src/shared.ts'

/** 一份完整的参数 JSON，包含需要转义的引号、换行和非 ASCII 字符。 */
const full = JSON.stringify({ title: 'Loan', source: 'line "one"\nline ¥2' })

test('reads complete arguments', () => {
  assert.deepEqual(readArgs(full), { title: 'Loan', source: 'line "one"\nline ¥2' })
})

test('every streamed prefix reads as a prefix of the final value', () => {
  const final = readArgs(full)
  for (let length = 0; length <= full.length; length++) {
    const { title, source } = readArgs(full.slice(0, length))
    assert.ok(final.title.startsWith(title) && final.source.startsWith(source), `at ${length}`)
  }
})

test('waits for a unicode escape to complete', () => {
  assert.equal(readArgs('{"title":"a\\u00').title, 'a')
  assert.equal(readArgs('{"title":"a\\u00a5').title, 'a¥')
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { axis } from '../src/client/axis.ts'

test('marks are round and cover the range', () => {
  assert.deepEqual(axis(0, 100), [0, 50, 100])
  assert.deepEqual(axis(0, 4490), [0, 2000, 4000, 6000])
  assert.deepEqual(axis(-30, 55), [-50, 0, 50, 100])
  assert.deepEqual(axis(61.2, 68.9), [60, 62, 64, 66, 68, 70])
  assert.deepEqual(axis(0.12, 0.31).map(mark => Math.round(mark * 100)), [10, 15, 20, 25, 30, 35])
})

test('a range of one value still has two marks', () => {
  assert.deepEqual(axis(5, 5), [5, 6])
  assert.deepEqual(axis(0, 0), [0, 1])
})

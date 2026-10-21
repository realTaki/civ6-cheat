'use strict';

const assert = require('assert');
const civ6 = require('../index.js');
const marker = civ6.MARKERS.ACTOR_DATA.PLAYER_NAME;

function addString(value) {
  const chunks = [];
  civ6.addChunk(chunks, {chunk: Buffer.alloc(0)}, marker,
      civ6.DATA_TYPES.STRING, value);
  return chunks[0];
}

describe('String write byte compatibility', function() {
  it('keeps the empty string header and null terminator', () => {
    const chunk = addString('');
    const expected = Buffer.concat([marker,
      Buffer.from([5, 0, 0, 0, 1, 0, 0, 0x21, 1, 0, 0, 0, 0])]);
    assert.deepStrictEqual(chunk, expected);
  });

  it('keeps ASCII bytes and the length including the terminator', () => {
    const chunk = addString('ASCII');
    assert.strictEqual(chunk.readUInt16LE(8), 6);
    assert.deepStrictEqual(chunk.slice(16), Buffer.from('ASCII\0'));
    assert.strictEqual(chunk.length, 22);
  });

  it('keeps diacritic removal before ASCII encoding', () => {
    const chunk = addString('Crème Brûlée');
    assert.strictEqual(chunk.readUInt16LE(8), 13);
    assert.deepStrictEqual(chunk.slice(16), Buffer.from('Creme Brulee\0'));
  });

  it('keeps replacement bytes for unsupported characters', () => {
    const chunk = addString('雪');
    assert.strictEqual(chunk.readUInt16LE(8), 2);
    assert.deepStrictEqual(chunk.slice(16), Buffer.from([0x3F, 0]));
  });

  it('preserves embedded null bytes without changing the writer format', () => {
    const chunk = addString('A\0B');
    assert.strictEqual(chunk.readUInt16LE(8), 4);
    assert.deepStrictEqual(chunk.slice(16), Buffer.from([65, 0, 66, 0]));
  });

  it('writes the largest payload supported by the 16-bit length', () => {
    const chunk = addString('A'.repeat(65534));
    assert.strictEqual(chunk.readUInt16LE(8), 65535);
    assert.strictEqual(chunk.length, 65551);
    assert.deepStrictEqual(chunk.slice(16, -1), Buffer.alloc(65534, 65));
    assert.strictEqual(chunk[chunk.length - 1], 0);
  });

  it('keeps rejecting a payload beyond the existing length limit', () => {
    assert.throws(() => addString('A'.repeat(65535)), RangeError);
  });

  it('uses the same bytes when modifying an existing string chunk', () => {
    const original = Buffer.alloc(0);
    const chunks = [original];
    const entry = {chunk: original, marker, type: civ6.DATA_TYPES.STRING};
    civ6.modifyChunk(chunks, entry, 'replacement');
    assert.strictEqual(entry.chunk, chunks[0]);
    assert.deepStrictEqual(chunks[0], addString('replacement'));
  });
});

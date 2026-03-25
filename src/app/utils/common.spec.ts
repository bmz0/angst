import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFrequency, safeDisconnect } from './common.js';

describe('getFrequency', function() {
  it('should return 440 Hz for A4', function() {
    expect(getFrequency('A4')).toBe(440);
  });

  it('should return correct frequency for C4 (middle C)', function() {
    expect(getFrequency('C4')).toBeCloseTo(261.63, 2);
  });

  it('should handle sharp notes', function() {
    expect(getFrequency('C#4')).toBeCloseTo(277.18, 2);
  });

  it('should handle flat notes', function() {
    expect(getFrequency('Bb4')).toBeCloseTo(466.16, 2);
  });

  it('should handle different octaves', function() {
    expect(getFrequency('A3')).toBeCloseTo(220, 2);
    expect(getFrequency('A5')).toBeCloseTo(880, 2);
  });

  it('should handle lower octaves', function() {
    expect(getFrequency('C0')).toBeCloseTo(16.35, 2);
  });

  it('should handle higher octaves', function() {
    expect(getFrequency('C8')).toBeCloseTo(4186.01, 2);
  });

  it('should throw error for invalid note format', function() {
    expect(function() { getFrequency('X4'); }).toThrow('Invalid note format');
    expect(function() { getFrequency('A'); }).toThrow('Invalid note format');
    expect(function() { getFrequency('4A'); }).toThrow('Invalid note format');
    expect(function() { getFrequency('A#b4'); }).toThrow('Invalid note format');
    expect(function() { getFrequency('A12'); }).toThrow('Invalid note format');
  });
});

describe('safeDisconnect', () => {
  let node: { disconnect: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    node = { disconnect: vi.fn() };
  });

  it('should call disconnect with a destination when provided', () => {
    const destination = {} as AudioNode;
    safeDisconnect(node as unknown as AudioNode, destination);

    expect(node.disconnect).toHaveBeenCalledWith(destination);
  });

  it('should call disconnect without arguments when no destination provided', () => {
    safeDisconnect(node as unknown as AudioNode);

    expect(node.disconnect).toHaveBeenCalledWith();
  });

  it('should not throw when disconnect succeeds', () => {
    expect(() => safeDisconnect(node as unknown as AudioNode)).not.toThrow();
  });

  it('should silently ignore an InvalidAccessError', () => {
    const error = new DOMException('not connected', 'InvalidAccessError');
    node.disconnect.mockImplementation(() => { throw error; });

    expect(() => safeDisconnect(node as unknown as AudioNode)).not.toThrow();
  });

  it('should silently ignore an InvalidAccessError when disconnecting from a destination', () => {
    const error = new DOMException('not connected', 'InvalidAccessError');
    node.disconnect.mockImplementation(() => { throw error; });
    const destination = {} as AudioNode;

    expect(() => safeDisconnect(node as unknown as AudioNode, destination)).not.toThrow();
  });

  it('should rethrow errors that are not InvalidAccessError DOMExceptions', () => {
    node.disconnect.mockImplementation(() => { throw new TypeError('unexpected'); });

    expect(() => safeDisconnect(node as unknown as AudioNode)).toThrow(TypeError);
  });

  it('should rethrow a DOMException with a different name', () => {
    const error = new DOMException('bad state', 'InvalidStateError');
    node.disconnect.mockImplementation(() => { throw error; });

    expect(() => safeDisconnect(node as unknown as AudioNode)).toThrow(error);
  });
});
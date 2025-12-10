import { getFrequency } from './common.js';

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
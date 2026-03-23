import { describe, it, expect } from 'vitest';
import { DEFAULT_PATCH, synthPatchFromJson, synthPatchToJson } from './synth-patch.js';

describe('synthPatchToJson', () => {
  it('serializes a patch to a non-empty string', () => {
    const json = synthPatchToJson(DEFAULT_PATCH);
    expect(typeof json).toBe('string');
    expect(json.length).toBeGreaterThan(0);
  });

  it('produces valid JSON', () => {
    const json = synthPatchToJson(DEFAULT_PATCH);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('round-trips DEFAULT_PATCH through toJson then fromJson', () => {
    const recovered = synthPatchFromJson(synthPatchToJson(DEFAULT_PATCH));
    expect(recovered).toEqual(DEFAULT_PATCH);
  });

  it('round-trips a custom patch correctly', () => {
    const custom = {
      ...DEFAULT_PATCH,
      oscillator1Type: 'sawtooth' as const,
      filterEnabled: true,
      filterFrequency: 2500,
      overdriveType: 'fold' as const,
      arpeggiatorPattern: '0357',
    };
    expect(synthPatchFromJson(synthPatchToJson(custom))).toEqual(custom);
  });
});

describe('synthPatchFromJson', () => {
  it('loads DEFAULT_PATCH values from its JSON representation', () => {
    const patch = synthPatchFromJson(JSON.stringify(DEFAULT_PATCH));
    expect(patch).toEqual(DEFAULT_PATCH);
  });

  it('throws on invalid JSON string', () => {
    expect(() => synthPatchFromJson('not json {')).toThrow('Invalid JSON');
  });

  it('throws when JSON is an array', () => {
    expect(() => synthPatchFromJson('[]')).toThrow('Invalid patch');
  });

  it('throws when JSON is null', () => {
    expect(() => synthPatchFromJson('null')).toThrow('Invalid patch');
  });

  it('throws when JSON is a plain string', () => {
    expect(() => synthPatchFromJson('"hello"')).toThrow('Invalid patch');
  });

  it('throws when a required enum-string field is missing', () => {
    const { oscillator1Type: _omit, ...rest } = DEFAULT_PATCH;
    expect(() => synthPatchFromJson(JSON.stringify(rest))).toThrow('"oscillator1Type"');
  });

  it('throws when a required number field is missing', () => {
    const { filterFrequency: _omit, ...rest } = DEFAULT_PATCH;
    expect(() => synthPatchFromJson(JSON.stringify(rest))).toThrow('"filterFrequency"');
  });

  it('throws when a required boolean field is missing', () => {
    const { filterEnabled: _omit, ...rest } = DEFAULT_PATCH;
    expect(() => synthPatchFromJson(JSON.stringify(rest))).toThrow('"filterEnabled"');
  });

  it('throws when a required plain-string field is missing', () => {
    const { arpeggiatorPattern: _omit, ...rest } = DEFAULT_PATCH;
    expect(() => synthPatchFromJson(JSON.stringify(rest))).toThrow('"arpeggiatorPattern"');
  });

  it('throws when oscillator1Type has an invalid enum value', () => {
    const bad = { ...DEFAULT_PATCH, oscillator1Type: 'trumpet' };
    expect(() => synthPatchFromJson(JSON.stringify(bad))).toThrow('"oscillator1Type"');
  });

  it('throws when oscillator2Type has an invalid enum value', () => {
    const bad = { ...DEFAULT_PATCH, oscillator2Type: 'noise' };
    expect(() => synthPatchFromJson(JSON.stringify(bad))).toThrow('"oscillator2Type"');
  });

  it('throws when filterType has an invalid enum value', () => {
    const bad = { ...DEFAULT_PATCH, filterType: 'notch' };
    expect(() => synthPatchFromJson(JSON.stringify(bad))).toThrow('"filterType"');
  });

  it('throws when overdriveType has an invalid enum value', () => {
    const bad = { ...DEFAULT_PATCH, overdriveType: 'fuzzy' };
    expect(() => synthPatchFromJson(JSON.stringify(bad))).toThrow('"overdriveType"');
  });

  it('throws when a number field has a null value (e.g. from serialized NaN)', () => {
    // JSON.stringify converts NaN/Infinity to null; null must be rejected
    const json = JSON.stringify({ ...DEFAULT_PATCH, filterFrequency: 1000 }).replace(
      '"filterFrequency":1000',
      '"filterFrequency":null',
    );
    expect(() => synthPatchFromJson(json)).toThrow('"filterFrequency"');
  });

  it('throws when a number field is a string', () => {
    const bad = { ...DEFAULT_PATCH, glideTime: 'fast' };
    expect(() => synthPatchFromJson(JSON.stringify(bad))).toThrow('"glideTime"');
  });

  it('throws when a boolean field is a string', () => {
    const bad = { ...DEFAULT_PATCH, filterEnabled: 'true' };
    expect(() => synthPatchFromJson(JSON.stringify(bad))).toThrow('"filterEnabled"');
  });

  it('throws when a boolean field is a number', () => {
    const bad = { ...DEFAULT_PATCH, overdriveEnabled: 1 };
    expect(() => synthPatchFromJson(JSON.stringify(bad))).toThrow('"overdriveEnabled"');
  });

  it('does not throw when the JSON contains unknown extra fields', () => {
    const withExtra = { ...DEFAULT_PATCH, unknownFutureProp: 42, anotherProp: 'x' };
    expect(() => synthPatchFromJson(JSON.stringify(withExtra))).not.toThrow();
  });

  it('preserves all individual field values correctly', () => {
    const patch = synthPatchFromJson(JSON.stringify(DEFAULT_PATCH));
    expect(patch.oscillator1Type).toBe(DEFAULT_PATCH.oscillator1Type);
    expect(patch.oscillator2Type).toBe(DEFAULT_PATCH.oscillator2Type);
    expect(patch.oscillator1Amount).toBe(DEFAULT_PATCH.oscillator1Amount);
    expect(patch.oscillator2Amount).toBe(DEFAULT_PATCH.oscillator2Amount);
    expect(patch.oscillator2SubOctave).toBe(DEFAULT_PATCH.oscillator2SubOctave);
    expect(patch.oscillator2Invert).toBe(DEFAULT_PATCH.oscillator2Invert);
    expect(patch.glideTime).toBe(DEFAULT_PATCH.glideTime);
    expect(patch.filterEnabled).toBe(DEFAULT_PATCH.filterEnabled);
    expect(patch.filterType).toBe(DEFAULT_PATCH.filterType);
    expect(patch.filterFrequency).toBe(DEFAULT_PATCH.filterFrequency);
    expect(patch.filterQ).toBe(DEFAULT_PATCH.filterQ);
    expect(patch.filterKeyboardTracking).toBe(DEFAULT_PATCH.filterKeyboardTracking);
    expect(patch.filterPostGain).toBe(DEFAULT_PATCH.filterPostGain);
    expect(patch.envelopeAttack).toBe(DEFAULT_PATCH.envelopeAttack);
    expect(patch.envelopeDecay).toBe(DEFAULT_PATCH.envelopeDecay);
    expect(patch.envelopeSustain).toBe(DEFAULT_PATCH.envelopeSustain);
    expect(patch.envelopeRelease).toBe(DEFAULT_PATCH.envelopeRelease);
    expect(patch.overdriveEnabled).toBe(DEFAULT_PATCH.overdriveEnabled);
    expect(patch.overdriveType).toBe(DEFAULT_PATCH.overdriveType);
    expect(patch.overdriveAmount).toBe(DEFAULT_PATCH.overdriveAmount);
    expect(patch.delayEnabled).toBe(DEFAULT_PATCH.delayEnabled);
    expect(patch.delayTime).toBe(DEFAULT_PATCH.delayTime);
    expect(patch.delayFeedback).toBe(DEFAULT_PATCH.delayFeedback);
    expect(patch.delayMix).toBe(DEFAULT_PATCH.delayMix);
    expect(patch.arpeggiatorEnabled).toBe(DEFAULT_PATCH.arpeggiatorEnabled);
    expect(patch.arpeggiatorTempo).toBe(DEFAULT_PATCH.arpeggiatorTempo);
    expect(patch.arpeggiatorPattern).toBe(DEFAULT_PATCH.arpeggiatorPattern);
  });
});

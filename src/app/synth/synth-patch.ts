import type { OscillatorType } from '../utils/oscillator.js';
import type { SupportedFilterType } from '../utils/filter.js';
import type { DistortionType } from '../utils/distortion.js';
import type { SynthEngineConfig, SynthEngineParameters } from './synthEngine.js';

export interface SynthPatch {
  // Oscillators
  oscillator1Type: OscillatorType;
  oscillator2Type: OscillatorType;
  oscillator1Amount: number;
  oscillator2Amount: number;
  oscillator2SubOctave: boolean;
  oscillator2Invert: boolean;
  glideTime: number;

  // Filter
  filterEnabled: boolean;
  filterType: SupportedFilterType;
  filterFrequency: number;
  filterQ: number;
  filterKeyboardTracking: number;
  filterPostGain: number;

  // Envelope (ADSR)
  envelopeAttack: number;
  envelopeDecay: number;
  envelopeSustain: number;
  envelopeRelease: number;

  // Distortion
  distortionEnabled: boolean;
  distortionType: DistortionType;
  distortionAmount: number;

  // Delay
  delayEnabled: boolean;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;

  // Arpeggiator
  arpeggiatorEnabled: boolean;
  arpeggiatorTempo: number;
  arpeggiatorPattern: string;
}

export const DEFAULT_PATCH: Readonly<SynthPatch> = {
  oscillator1Type: 'square',
  oscillator2Type: 'sawtooth',
  oscillator1Amount: 0.6,
  oscillator2Amount: 0.4,
  oscillator2SubOctave: true,
  oscillator2Invert: true,
  glideTime: 0.04,

  filterEnabled: true,
  filterType: 'lowpass',
  filterFrequency: 2429,
  filterQ: 16,
  filterKeyboardTracking: 0.38,
  filterPostGain: 1,

  envelopeAttack: 0.233,
  envelopeDecay: 0.316,
  envelopeSustain: 0.7,
  envelopeRelease: 0.62,

  distortionEnabled: true,
  distortionType: 'fold',
  distortionAmount: 75,

  delayEnabled: true,
  delayTime: 0.3,
  delayFeedback: 0.3,
  delayMix: 0.3,

  arpeggiatorEnabled: false,
  arpeggiatorTempo: 300,
  arpeggiatorPattern: '037',
};

// ---------------------------------------------------------------------------
// JSON serialization
// ---------------------------------------------------------------------------

export function synthPatchToJson(patch: SynthPatch): string {
  return JSON.stringify(patch);
}

const OSCILLATOR_TYPES = new Set<string>(['sine', 'square', 'sawtooth', 'triangle']);
const FILTER_TYPES = new Set<string>(['lowpass', 'highpass', 'bandpass']);
const DISTORTION_TYPES = new Set<string>(['soft', 'fold']);

export function synthPatchFromJson(json: string): SynthPatch {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: could not parse patch string');
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid patch: expected a JSON object');
  }

  const p = raw as Record<string, unknown>;

  const requireString = (key: string): string => {
    if (typeof p[key] !== 'string') {
      throw new Error(`Invalid patch: "${key}" must be a string`);
    }
    return p[key] as string;
  };

  const requireNumber = (key: string): number => {
    if (typeof p[key] !== 'number' || !isFinite(p[key] as number)) {
      throw new Error(`Invalid patch: "${key}" must be a finite number`);
    }
    return p[key] as number;
  };

  const requireBoolean = (key: string): boolean => {
    if (typeof p[key] !== 'boolean') {
      throw new Error(`Invalid patch: "${key}" must be a boolean`);
    }
    return p[key] as boolean;
  };

  const requireEnum = (key: string, allowed: ReadonlySet<string>): string => {
    const value = requireString(key);
    if (!allowed.has(value)) {
      throw new Error(
        `Invalid patch: "${key}" must be one of ${[...allowed].join(', ')}`,
      );
    }
    return value;
  };

  return {
    oscillator1Type: requireEnum('oscillator1Type', OSCILLATOR_TYPES) as OscillatorType,
    oscillator2Type: requireEnum('oscillator2Type', OSCILLATOR_TYPES) as OscillatorType,
    oscillator1Amount: requireNumber('oscillator1Amount'),
    oscillator2Amount: requireNumber('oscillator2Amount'),
    oscillator2SubOctave: requireBoolean('oscillator2SubOctave'),
    oscillator2Invert: requireBoolean('oscillator2Invert'),
    glideTime: requireNumber('glideTime'),

    filterEnabled: requireBoolean('filterEnabled'),
    filterType: requireEnum('filterType', FILTER_TYPES) as SupportedFilterType,
    filterFrequency: requireNumber('filterFrequency'),
    filterQ: requireNumber('filterQ'),
    filterKeyboardTracking: requireNumber('filterKeyboardTracking'),
    filterPostGain: requireNumber('filterPostGain'),

    envelopeAttack: requireNumber('envelopeAttack'),
    envelopeDecay: requireNumber('envelopeDecay'),
    envelopeSustain: requireNumber('envelopeSustain'),
    envelopeRelease: requireNumber('envelopeRelease'),

    distortionEnabled: requireBoolean('distortionEnabled'),
    distortionType: requireEnum('distortionType', DISTORTION_TYPES) as DistortionType,
    distortionAmount: requireNumber('distortionAmount'),

    delayEnabled: requireBoolean('delayEnabled'),
    delayTime: requireNumber('delayTime'),
    delayFeedback: requireNumber('delayFeedback'),
    delayMix: requireNumber('delayMix'),

    arpeggiatorEnabled: requireBoolean('arpeggiatorEnabled'),
    arpeggiatorTempo: requireNumber('arpeggiatorTempo'),
    arpeggiatorPattern: requireString('arpeggiatorPattern'),
  };
}

// ---------------------------------------------------------------------------
// Converters to engine types
// ---------------------------------------------------------------------------

/**
 * Converts a SynthPatch to the config shape accepted by SynthEngineService.initialize().
 * The arpeggiator fields are intentionally excluded — they are managed separately
 * by ArpeggiatorPanel and not part of SynthEngine.
 */
export function synthPatchToEngineConfig(
  patch: SynthPatch,
): Omit<SynthEngineConfig, 'audioContext' | 'destination'> {
  return {
    oscillator1Type: patch.oscillator1Type,
    oscillator2Type: patch.oscillator2Type,
    oscillator1Amount: patch.oscillator1Amount,
    oscillator2Amount: patch.oscillator2Amount,
    oscillator2SubOctave: patch.oscillator2SubOctave,
    oscillator2Invert: patch.oscillator2Invert,
    glideTime: patch.glideTime,

    filterEnabled: patch.filterEnabled,
    filterType: patch.filterType,
    filterFrequency: patch.filterFrequency,
    filterQ: patch.filterQ,
    filterKeyboardTracking: patch.filterKeyboardTracking,
    filterPostGain: patch.filterPostGain,

    envelopeAttack: patch.envelopeAttack,
    envelopeDecay: patch.envelopeDecay,
    envelopeSustain: patch.envelopeSustain,
    envelopeRelease: patch.envelopeRelease,

    distortionEnabled: patch.distortionEnabled,
    distortionFold: patch.distortionType === 'fold',
    distortionAmount: patch.distortionAmount,

    delayEnabled: patch.delayEnabled,
    delayTime: patch.delayTime,
    delayFeedback: patch.delayFeedback,
    delayMix: patch.delayMix,
  };
}

/**
 * Converts a SynthPatch to SynthEngineParameters for applying to a running engine
 * via SynthEngineService.setParameters().
 */
export function synthPatchToEngineParameters(patch: SynthPatch): SynthEngineParameters {
  return {
    oscillator1Type: patch.oscillator1Type,
    oscillator2Type: patch.oscillator2Type,
    oscillator1Amount: patch.oscillator1Amount,
    oscillator2Amount: patch.oscillator2Amount,
    oscillator2SubOctave: patch.oscillator2SubOctave,
    oscillator2Invert: patch.oscillator2Invert,
    glideTime: patch.glideTime,

    filter: {
      enabled: patch.filterEnabled,
      type: patch.filterType,
      frequency: patch.filterFrequency,
      Q: patch.filterQ,
      keyboardTracking: patch.filterKeyboardTracking,
      postGain: patch.filterPostGain,
    },

    envelope: {
      attack: patch.envelopeAttack,
      decay: patch.envelopeDecay,
      sustain: patch.envelopeSustain,
      release: patch.envelopeRelease,
    },

    distortion: {
      enabled: patch.distortionEnabled,
      type: patch.distortionType,
      amount: patch.distortionAmount,
    },

    delay: {
      enabled: patch.delayEnabled,
      delayTime: patch.delayTime,
      feedback: patch.delayFeedback,
      mix: patch.delayMix,
    },
  };
}

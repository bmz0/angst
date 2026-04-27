import type { OscillatorType } from '../utils/oscillator.js';
import type { SupportedFilterType } from '../utils/filter.js';
import type { OverdriveType } from '../utils/overdrive.js';
import type { RectifierMode } from '../utils/rectifier.js';
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
  filterEnvelopeEnabled: boolean;
  filterEnvelopeAttack: number;
  filterEnvelopeSustain: number;
  filterEnvelopeRelease: number;
  filterEnvelopeBaseLevel: number;

  // Amp Envelope
  envelopeEnabled: boolean;
  envelopeAttack: number;
  envelopeDecay: number;
  envelopeSustain: number;
  envelopeRelease: number;

  // Overdrive
  overdriveEnabled: boolean;
  overdriveType: OverdriveType;
  overdriveAmount: number;

  // Rectifier
  rectifierEnabled: boolean;
  rectifierMode: RectifierMode;
  rectifierBias: number;

  // Delay
  delayEnabled: boolean;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  delayPingPong: boolean;
  delayPan: number;

  // Reverb
  reverbEnabled: boolean;
  reverbRoomSize: number;
  reverbDecay: number;
  reverbMix: number;
  reverbColor: number;
  reverbPreDelay: number;
  reverbHpFrequency: number;

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
  filterEnvelopeEnabled: false,
  filterEnvelopeAttack: 0.005,
  filterEnvelopeSustain: 1.0,
  filterEnvelopeRelease: 0.5,
  filterEnvelopeBaseLevel: 0,

  envelopeEnabled: true,
  envelopeAttack: 0.233,
  envelopeDecay: 0.316,
  envelopeSustain: 0.7,
  envelopeRelease: 0.62,

  overdriveEnabled: true,
  overdriveType: 'fold',
  overdriveAmount: 75,

  rectifierEnabled: false,
  rectifierMode: 'half',
  rectifierBias: 0,

  delayEnabled: true,
  delayTime: 0.3,
  delayFeedback: 0.3,
  delayMix: 0.3,
  delayPingPong: true,
  delayPan: 0.3,

  reverbEnabled: false,
  reverbRoomSize: 4.0,
  reverbDecay: 14.5,
  reverbMix: 0.13,
  reverbColor: 0.6,
  reverbPreDelay: 0.024,
  reverbHpFrequency: 120,

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
const RECTIFIER_MODES = new Set<string>(['half', 'full']);

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
    filterEnvelopeEnabled: requireBoolean('filterEnvelopeEnabled'),
    filterEnvelopeAttack: requireNumber('filterEnvelopeAttack'),
    filterEnvelopeSustain: requireNumber('filterEnvelopeSustain'),
    filterEnvelopeRelease: requireNumber('filterEnvelopeRelease'),
    filterEnvelopeBaseLevel: requireNumber('filterEnvelopeBaseLevel'),

    envelopeEnabled: requireBoolean('envelopeEnabled'),
    envelopeAttack: requireNumber('envelopeAttack'),
    envelopeDecay: requireNumber('envelopeDecay'),
    envelopeSustain: requireNumber('envelopeSustain'),
    envelopeRelease: requireNumber('envelopeRelease'),

    overdriveEnabled: requireBoolean('overdriveEnabled'),
    overdriveType: requireEnum('overdriveType', DISTORTION_TYPES) as OverdriveType,
    overdriveAmount: requireNumber('overdriveAmount'),

    rectifierEnabled: requireBoolean('rectifierEnabled'),
    rectifierMode: requireEnum('rectifierMode', RECTIFIER_MODES) as RectifierMode,
    rectifierBias: requireNumber('rectifierBias'),

    delayEnabled: requireBoolean('delayEnabled'),
    delayTime: requireNumber('delayTime'),
    delayFeedback: requireNumber('delayFeedback'),
    delayMix: requireNumber('delayMix'),
    delayPingPong: requireBoolean('delayPingPong'),
    delayPan: requireNumber('delayPan'),

    reverbEnabled: requireBoolean('reverbEnabled'),
    reverbRoomSize: requireNumber('reverbRoomSize'),
    reverbDecay: requireNumber('reverbDecay'),
    reverbMix: requireNumber('reverbMix'),
    reverbColor: requireNumber('reverbColor'),
    reverbPreDelay: requireNumber('reverbPreDelay'),
    reverbHpFrequency: requireNumber('reverbHpFrequency'),

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
    filterEnvelopeEnabled: patch.filterEnvelopeEnabled,
    filterEnvelopeAttack: patch.filterEnvelopeAttack,
    filterEnvelopeSustain: patch.filterEnvelopeSustain,
    filterEnvelopeRelease: patch.filterEnvelopeRelease,
    filterEnvelopeBaseLevel: patch.filterEnvelopeBaseLevel,

    envelopeEnabled: patch.envelopeEnabled,
    envelopeAttack: patch.envelopeAttack,
    envelopeDecay: patch.envelopeDecay,
    envelopeSustain: patch.envelopeSustain,
    envelopeRelease: patch.envelopeRelease,

    overdriveEnabled: patch.overdriveEnabled,
    overdriveFold: patch.overdriveType === 'fold',
    overdriveAmount: patch.overdriveAmount,

    rectifierEnabled: patch.rectifierEnabled,
    rectifierMode: patch.rectifierMode,
    rectifierBias: patch.rectifierBias,

    delayEnabled: patch.delayEnabled,
    delayTime: patch.delayTime,
    delayFeedback: patch.delayFeedback,
    delayMix: patch.delayMix,
    delayPingPong: patch.delayPingPong,
    delayPan: patch.delayPan,

    reverbEnabled: patch.reverbEnabled,
    reverbRoomSize: patch.reverbRoomSize,
    reverbDecay: patch.reverbDecay,
    reverbMix: patch.reverbMix,
    reverbColor: patch.reverbColor,
    reverbPreDelay: patch.reverbPreDelay,
    reverbHpFrequency: patch.reverbHpFrequency,
  };
}

/**
 * Returns a new SynthPatch with every engine-param field present in `params`
 * merged in. Arpeggiator fields are excluded — they are not part of
 * SynthEngineParameters and must be updated separately.
 * Safe to call on every knob turn.
 */
export function mergePatchWithParams(patch: SynthPatch, params: SynthEngineParameters): SynthPatch {
  const p: Partial<SynthPatch> = {};

  if (params.oscillator1Type !== undefined) p.oscillator1Type = params.oscillator1Type;
  if (params.oscillator2Type !== undefined) p.oscillator2Type = params.oscillator2Type;
  if (params.oscillator1Amount !== undefined) p.oscillator1Amount = params.oscillator1Amount;
  if (params.oscillator2Amount !== undefined) p.oscillator2Amount = params.oscillator2Amount;
  if (params.oscillator2SubOctave !== undefined) p.oscillator2SubOctave = params.oscillator2SubOctave;
  if (params.oscillator2Invert !== undefined) p.oscillator2Invert = params.oscillator2Invert;
  if (params.glideTime !== undefined) p.glideTime = params.glideTime;

  if (params.filter?.enabled !== undefined) p.filterEnabled = params.filter.enabled;
  if (params.filter?.type !== undefined) p.filterType = params.filter.type;
  if (params.filter?.frequency !== undefined) p.filterFrequency = params.filter.frequency;
  if (params.filter?.Q !== undefined) p.filterQ = params.filter.Q;
  if (params.filter?.keyboardTracking !== undefined) p.filterKeyboardTracking = params.filter.keyboardTracking;
  if (params.filter?.postGain !== undefined) p.filterPostGain = params.filter.postGain;
  if (params.filter?.envelopeEnabled !== undefined) p.filterEnvelopeEnabled = params.filter.envelopeEnabled;
  if (params.filter?.envelopeAttack !== undefined) p.filterEnvelopeAttack = params.filter.envelopeAttack;
  if (params.filter?.envelopeSustain !== undefined) p.filterEnvelopeSustain = params.filter.envelopeSustain;
  if (params.filter?.envelopeRelease !== undefined) p.filterEnvelopeRelease = params.filter.envelopeRelease;
  if (params.filter?.envelopeBaseLevel !== undefined) p.filterEnvelopeBaseLevel = params.filter.envelopeBaseLevel;

  if (params.envelope?.enabled !== undefined) p.envelopeEnabled = params.envelope.enabled;
  if (params.envelope?.attack !== undefined) p.envelopeAttack = params.envelope.attack;
  if (params.envelope?.decay !== undefined) p.envelopeDecay = params.envelope.decay;
  if (params.envelope?.sustain !== undefined) p.envelopeSustain = params.envelope.sustain;
  if (params.envelope?.release !== undefined) p.envelopeRelease = params.envelope.release;

  if (params.rectifier?.enabled !== undefined) p.rectifierEnabled = params.rectifier.enabled;
  if (params.rectifier?.mode !== undefined) p.rectifierMode = params.rectifier.mode;
  if (params.rectifier?.bias !== undefined) p.rectifierBias = params.rectifier.bias;

  if (params.overdrive?.enabled !== undefined) p.overdriveEnabled = params.overdrive.enabled;
  if (params.overdrive?.type !== undefined) p.overdriveType = params.overdrive.type;
  if (params.overdrive?.amount !== undefined) p.overdriveAmount = params.overdrive.amount;

  if (params.delay?.enabled !== undefined) p.delayEnabled = params.delay.enabled;
  if (params.delay?.delayTime !== undefined) p.delayTime = params.delay.delayTime;
  if (params.delay?.feedback !== undefined) p.delayFeedback = params.delay.feedback;
  if (params.delay?.mix !== undefined) p.delayMix = params.delay.mix;
  if (params.delay?.pingPong !== undefined) p.delayPingPong = params.delay.pingPong;
  if (params.delay?.delayPan !== undefined) p.delayPan = params.delay.delayPan;

  if (params.reverb?.enabled !== undefined) p.reverbEnabled = params.reverb.enabled;
  if (params.reverb?.roomSize !== undefined) p.reverbRoomSize = params.reverb.roomSize;
  if (params.reverb?.decay !== undefined) p.reverbDecay = params.reverb.decay;
  if (params.reverb?.mix !== undefined) p.reverbMix = params.reverb.mix;
  if (params.reverb?.color !== undefined) p.reverbColor = params.reverb.color;
  if (params.reverb?.preDelay !== undefined) p.reverbPreDelay = params.reverb.preDelay;
  if (params.reverb?.hpFrequency !== undefined) p.reverbHpFrequency = params.reverb.hpFrequency;

  return { ...patch, ...p };
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
      envelopeEnabled: patch.filterEnvelopeEnabled,
      envelopeAttack: patch.filterEnvelopeAttack,
      envelopeSustain: patch.filterEnvelopeSustain,
      envelopeRelease: patch.filterEnvelopeRelease,
      envelopeBaseLevel: patch.filterEnvelopeBaseLevel,
    },

    envelope: {
      enabled: patch.envelopeEnabled,
      attack: patch.envelopeAttack,
      decay: patch.envelopeDecay,
      sustain: patch.envelopeSustain,
      release: patch.envelopeRelease,
    },

    overdrive: {
      enabled: patch.overdriveEnabled,
      type: patch.overdriveType,
      amount: patch.overdriveAmount,
    },

    rectifier: {
      enabled: patch.rectifierEnabled,
      mode: patch.rectifierMode,
      bias: patch.rectifierBias,
    },

    delay: {
      enabled: patch.delayEnabled,
      delayTime: patch.delayTime,
      feedback: patch.delayFeedback,
      mix: patch.delayMix,
      pingPong: patch.delayPingPong,
      delayPan: patch.delayPan,
    },

    reverb: {
      enabled: patch.reverbEnabled,
      roomSize: patch.reverbRoomSize,
      decay: patch.reverbDecay,
      mix: patch.reverbMix,
      color: patch.reverbColor,
      preDelay: patch.reverbPreDelay,
      hpFrequency: patch.reverbHpFrequency,
    },
  };
}

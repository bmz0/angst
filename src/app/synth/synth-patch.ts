import type { OscillatorType } from '../utils/oscillator.js';
import type { SupportedFilterType } from '../utils/filter.js';
import type { LadderFilterParameters } from '../utils/ladder-filter.js';
import type { OverdriveType } from '../utils/overdrive.js';
import type { RectifierMode } from '../utils/rectifier.js';
import type { SynthEngineConfig, SynthEngineParameters } from './synthEngine.js';
import type { PolyphonyMode } from './voice-manager.js';
import type { LfoTarget } from '../utils/lfo.js';

export interface SynthPatch {
  // Oscillators
  oscillator1Type: OscillatorType;
  oscillator2Type: OscillatorType;
  oscillator1Amount: number;
  oscillator2Amount: number;
  oscillator2SubOctave: boolean;
  oscillator2Invert: boolean;
  glideTime: number;
  polyphonyMode: PolyphonyMode;

  // Filter
  filterEnabled: boolean;
  filterType: SupportedFilterType;
  filterFrequency: number;
  filterQ: number;
  filterKeyboardTracking: number;
  filterPostGain: number;
  filterMix: number;

  // Ladder Filter
  ladderFilterEnabled: boolean;
  ladderFilterFrequency: number;
  ladderFilterResonance: number;
  ladderFilterDrive: number;
  ladderFilterKeyboardTracking: number;
  ladderFilterPostGain: number;

  // Comb Filter
  combFilterEnabled: boolean;
  combFilterDelayTime: number;
  combFilterGain: number;
  combFilterFeedback: boolean;
  combFilterPostGain: number;
  combFilterKeyboardTracking: number;

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

  // LFO 1
  lfoEnabled: boolean;
  lfoTarget: LfoTarget;
  lfoRate: number;
  lfoDepth: number;
  lfoShape: OscillatorType;
  lfoRetrigger: boolean;
  lfoFadeIn: number;

  // LFO 2
  lfo2Enabled: boolean;
  lfo2Target: LfoTarget;
  lfo2Rate: number;
  lfo2Depth: number;
  lfo2Shape: OscillatorType;
  lfo2Retrigger: boolean;
  lfo2FadeIn: number;

  // LFO 3
  lfo3Enabled: boolean;
  lfo3Target: LfoTarget;
  lfo3Rate: number;
  lfo3Depth: number;
  lfo3Shape: OscillatorType;
  lfo3Retrigger: boolean;
  lfo3FadeIn: number;

  // MIDI CC modulation targets (-1 = disabled)
  lfo1DepthCC: number;
  lfo2DepthCC: number;
  lfo3DepthCC: number;
}

export const DEFAULT_PATCH: Readonly<SynthPatch> = {
  oscillator1Type: 'square',
  oscillator2Type: 'sawtooth',
  oscillator1Amount: 0.6,
  oscillator2Amount: 0.4,
  oscillator2SubOctave: true,
  oscillator2Invert: true,
  glideTime: 0.04,
  polyphonyMode: 'mono',

  filterEnabled: true,
  filterType: 'lowpass',
  filterFrequency: 2429,
  filterQ: 16,
  filterKeyboardTracking: 0.38,
  filterPostGain: 1,
  filterMix: 1,

  ladderFilterEnabled: false,
  ladderFilterFrequency: 4000,
  ladderFilterResonance: 2.5,
  ladderFilterDrive: 4,
  ladderFilterKeyboardTracking: 0.38,
  ladderFilterPostGain: 1,

  combFilterEnabled: false,
  combFilterDelayTime: 0.001,
  combFilterGain: -0.7,
  combFilterFeedback: false,
  combFilterPostGain: 1,
  combFilterKeyboardTracking: 0,

  envelopeEnabled: true,
  envelopeAttack: 0.053,
  envelopeDecay: 0.116,
  envelopeSustain: 0.7,
  envelopeRelease: 0.12,

  overdriveEnabled: true,
  overdriveType: 'fold',
  overdriveAmount: 75,

  rectifierEnabled: false,
  rectifierMode: 'half',
  rectifierBias: 0,

  delayEnabled: false,
  delayTime: 0.3,
  delayFeedback: 0.3,
  delayMix: 0.3,
  delayPingPong: true,
  delayPan: 0.3,

  reverbEnabled: true,
  reverbRoomSize: 4.0,
  reverbDecay: 14.5,
  reverbMix: 0.13,
  reverbColor: 0.6,
  reverbPreDelay: 0.024,
  reverbHpFrequency: 120,

  arpeggiatorEnabled: false,
  arpeggiatorTempo: 300,
  arpeggiatorPattern: '037',

  lfoEnabled: false,
  lfoTarget: 'filterFrequency',
  lfoRate: 2,
  lfoDepth: 0,
  lfoShape: 'sine',
  lfoRetrigger: true,
  lfoFadeIn: 0,

  lfo2Enabled: false,
  lfo2Target: 'filterQ',
  lfo2Rate: 2,
  lfo2Depth: 0,
  lfo2Shape: 'sine',
  lfo2Retrigger: true,
  lfo2FadeIn: 0,

  lfo3Enabled: false,
  lfo3Target: 'lfo1Rate',
  lfo3Rate: 2,
  lfo3Depth: 0,
  lfo3Shape: 'sine',
  lfo3Retrigger: true,
  lfo3FadeIn: 0,

  lfo1DepthCC: -1,
  lfo2DepthCC: -1,
  lfo3DepthCC: -1,
};

// ---------------------------------------------------------------------------
// JSON serialization
// ---------------------------------------------------------------------------

export function synthPatchToJson(patch: SynthPatch): string {
  return JSON.stringify(patch);
}

const OSCILLATOR_TYPES = new Set<string>(['sine', 'square', 'sawtooth', 'triangle']);
const FILTER_TYPES = new Set<string>(['lowpass', 'highpass', 'bandpass', 'notch']);
const DISTORTION_TYPES = new Set<string>(['soft', 'fold']);
const RECTIFIER_MODES = new Set<string>(['half', 'full']);
const POLYPHONY_MODES = new Set<string>(['mono', 'duo', 'quad']);
const LFO_TARGETS = new Set<string>([
  'filterFrequency', 'filterQ', 'ladderFilterFrequency',
  'ladderFilterResonance', 'delayMix', 'reverbMix', 'oscMix',
  'oscPreGain', 'oscPostGain', 'oscPitch', 'lfo1Rate', 'lfo1Depth',
  'lfo2Rate', 'lfo2Depth',
]);

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

  // For fields added after the initial release: fall back to a default when
  // the key is absent so that older saved patches still deserialise correctly.
  const numberOr = (key: string, fallback: number): number => {
    if (p[key] === undefined) return fallback;
    return requireNumber(key);
  };

  const booleanOr = (key: string, fallback: boolean): boolean => {
    if (p[key] === undefined) return fallback;
    return requireBoolean(key);
  };

  return {
    oscillator1Type: requireEnum('oscillator1Type', OSCILLATOR_TYPES) as OscillatorType,
    oscillator2Type: requireEnum('oscillator2Type', OSCILLATOR_TYPES) as OscillatorType,
    oscillator1Amount: requireNumber('oscillator1Amount'),
    oscillator2Amount: requireNumber('oscillator2Amount'),
    oscillator2SubOctave: requireBoolean('oscillator2SubOctave'),
    oscillator2Invert: requireBoolean('oscillator2Invert'),
    glideTime: requireNumber('glideTime'),
    polyphonyMode: (p['polyphonyMode'] === undefined ? 'mono' : requireEnum('polyphonyMode', POLYPHONY_MODES)) as PolyphonyMode,

    filterEnabled: requireBoolean('filterEnabled'),
    filterType: requireEnum('filterType', FILTER_TYPES) as SupportedFilterType,
    filterFrequency: requireNumber('filterFrequency'),
    filterQ: requireNumber('filterQ'),
    filterKeyboardTracking: requireNumber('filterKeyboardTracking'),
    filterPostGain: requireNumber('filterPostGain'),
    filterMix: numberOr('filterMix', 1),

    ladderFilterEnabled: booleanOr('ladderFilterEnabled', false),
    ladderFilterFrequency: numberOr('ladderFilterFrequency', 2000),
    ladderFilterResonance: numberOr('ladderFilterResonance', 1.5),
    ladderFilterDrive: numberOr('ladderFilterDrive', 1),
    ladderFilterKeyboardTracking: numberOr('ladderFilterKeyboardTracking', 0.38),
    ladderFilterPostGain: numberOr('ladderFilterPostGain', 1),

    combFilterEnabled: booleanOr('combFilterEnabled', false),
    combFilterDelayTime: numberOr('combFilterDelayTime', 0.001),
    combFilterGain: numberOr('combFilterGain', -0.7),
    combFilterFeedback: booleanOr('combFilterFeedback', false),
    combFilterPostGain: numberOr('combFilterPostGain', 1),
    combFilterKeyboardTracking: numberOr('combFilterKeyboardTracking', 0),

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

    lfoEnabled: booleanOr('lfoEnabled', false),
    lfoTarget: (p['lfoTarget'] === undefined
      ? 'filterFrequency'
      : requireEnum('lfoTarget', LFO_TARGETS)) as LfoTarget,
    lfoRate: numberOr('lfoRate', 2),
    lfoDepth: numberOr('lfoDepth', 0),
    lfoShape: (p['lfoShape'] === undefined
      ? 'sine'
      : requireEnum('lfoShape', OSCILLATOR_TYPES)) as OscillatorType,
    lfoRetrigger: booleanOr('lfoRetrigger', true),
    lfoFadeIn: numberOr('lfoFadeIn', 0),

    lfo2Enabled: booleanOr('lfo2Enabled', false),
    lfo2Target: (p['lfo2Target'] === undefined
      ? 'filterQ'
      : requireEnum('lfo2Target', LFO_TARGETS)) as LfoTarget,
    lfo2Rate: numberOr('lfo2Rate', 2),
    lfo2Depth: numberOr('lfo2Depth', 0),
    lfo2Shape: (p['lfo2Shape'] === undefined
      ? 'sine'
      : requireEnum('lfo2Shape', OSCILLATOR_TYPES)) as OscillatorType,
    lfo2Retrigger: booleanOr('lfo2Retrigger', true),
    lfo2FadeIn: numberOr('lfo2FadeIn', 0),

    lfo3Enabled: booleanOr('lfo3Enabled', false),
    lfo3Target: (p['lfo3Target'] === undefined
      ? 'lfo1Rate'
      : requireEnum('lfo3Target', LFO_TARGETS)) as LfoTarget,
    lfo3Rate: numberOr('lfo3Rate', 2),
    lfo3Depth: numberOr('lfo3Depth', 0),
    lfo3Shape: (p['lfo3Shape'] === undefined
      ? 'sine'
      : requireEnum('lfo3Shape', OSCILLATOR_TYPES)) as OscillatorType,
    lfo3Retrigger: booleanOr('lfo3Retrigger', true),
    lfo3FadeIn: numberOr('lfo3FadeIn', 0),

    lfo1DepthCC: numberOr('lfo1DepthCC', -1),
    lfo2DepthCC: numberOr('lfo2DepthCC', -1),
    lfo3DepthCC: numberOr('lfo3DepthCC', -1),
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
    polyphonyMode: patch.polyphonyMode,

    filterEnabled: patch.filterEnabled,
    filterType: patch.filterType,
    filterFrequency: patch.filterFrequency,
    filterQ: patch.filterQ,
    filterKeyboardTracking: patch.filterKeyboardTracking,
    filterPostGain: patch.filterPostGain,
    filterMix: patch.filterMix,

    ladderFilterEnabled: patch.ladderFilterEnabled,
    ladderFilterFrequency: patch.ladderFilterFrequency,
    ladderFilterResonance: patch.ladderFilterResonance,
    ladderFilterDrive: patch.ladderFilterDrive,
    ladderFilterKeyboardTracking: patch.ladderFilterKeyboardTracking,
    ladderFilterPostGain: patch.ladderFilterPostGain,

    combFilterEnabled: patch.combFilterEnabled,
    combFilterDelayTime: patch.combFilterDelayTime,
    combFilterGain: patch.combFilterGain,
    combFilterFeedback: patch.combFilterFeedback,
    combFilterPostGain: patch.combFilterPostGain,
    combFilterKeyboardTracking: patch.combFilterKeyboardTracking,

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
  if (params.polyphonyMode !== undefined) p.polyphonyMode = params.polyphonyMode;

  if (params.filter?.enabled !== undefined) p.filterEnabled = params.filter.enabled;
  if (params.filter?.type !== undefined) p.filterType = params.filter.type;
  if (params.filter?.frequency !== undefined) p.filterFrequency = params.filter.frequency;
  if (params.filter?.Q !== undefined) p.filterQ = params.filter.Q;
  if (params.filter?.keyboardTracking !== undefined) p.filterKeyboardTracking = params.filter.keyboardTracking;
  if (params.filter?.postGain !== undefined) p.filterPostGain = params.filter.postGain;
  if (params.filter?.mix !== undefined) p.filterMix = params.filter.mix;

  if (params.ladderFilter?.enabled !== undefined) p.ladderFilterEnabled = params.ladderFilter.enabled;
  if (params.ladderFilter?.frequency !== undefined) p.ladderFilterFrequency = params.ladderFilter.frequency;
  if (params.ladderFilter?.resonance !== undefined) p.ladderFilterResonance = params.ladderFilter.resonance;
  if (params.ladderFilter?.drive !== undefined) p.ladderFilterDrive = params.ladderFilter.drive;
  if (params.ladderFilter?.keyboardTracking !== undefined) p.ladderFilterKeyboardTracking = params.ladderFilter.keyboardTracking;
  if (params.ladderFilter?.postGain !== undefined) p.ladderFilterPostGain = params.ladderFilter.postGain;

  if (params.combFilter?.enabled !== undefined) p.combFilterEnabled = params.combFilter.enabled;
  if (params.combFilter?.delayTime !== undefined) p.combFilterDelayTime = params.combFilter.delayTime;
  if (params.combFilter?.gain !== undefined) p.combFilterGain = params.combFilter.gain;
  if (params.combFilter?.feedback !== undefined) p.combFilterFeedback = params.combFilter.feedback;
  if (params.combFilter?.postGain !== undefined) p.combFilterPostGain = params.combFilter.postGain;
  if (params.combFilter?.keyboardTracking !== undefined) p.combFilterKeyboardTracking = params.combFilter.keyboardTracking;

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

  if (params.lfo1?.enabled !== undefined) p.lfoEnabled = params.lfo1.enabled;
  if (params.lfo1?.target !== undefined) p.lfoTarget = params.lfo1.target;
  if (params.lfo1?.rate !== undefined) p.lfoRate = params.lfo1.rate;
  if (params.lfo1?.depth !== undefined) p.lfoDepth = params.lfo1.depth;
  if (params.lfo1?.shape !== undefined) p.lfoShape = params.lfo1.shape;
  if (params.lfo1?.retrigger !== undefined) p.lfoRetrigger = params.lfo1.retrigger;
  if (params.lfo1?.fadeIn !== undefined) p.lfoFadeIn = params.lfo1.fadeIn;

  if (params.lfo2?.enabled !== undefined) p.lfo2Enabled = params.lfo2.enabled;
  if (params.lfo2?.target !== undefined) p.lfo2Target = params.lfo2.target;
  if (params.lfo2?.rate !== undefined) p.lfo2Rate = params.lfo2.rate;
  if (params.lfo2?.depth !== undefined) p.lfo2Depth = params.lfo2.depth;
  if (params.lfo2?.shape !== undefined) p.lfo2Shape = params.lfo2.shape;
  if (params.lfo2?.retrigger !== undefined) p.lfo2Retrigger = params.lfo2.retrigger;
  if (params.lfo2?.fadeIn !== undefined) p.lfo2FadeIn = params.lfo2.fadeIn;

  if (params.lfo3?.enabled !== undefined) p.lfo3Enabled = params.lfo3.enabled;
  if (params.lfo3?.target !== undefined) p.lfo3Target = params.lfo3.target;
  if (params.lfo3?.rate !== undefined) p.lfo3Rate = params.lfo3.rate;
  if (params.lfo3?.depth !== undefined) p.lfo3Depth = params.lfo3.depth;
  if (params.lfo3?.shape !== undefined) p.lfo3Shape = params.lfo3.shape;
  if (params.lfo3?.retrigger !== undefined) p.lfo3Retrigger = params.lfo3.retrigger;
  if (params.lfo3?.fadeIn !== undefined) p.lfo3FadeIn = params.lfo3.fadeIn;

  return { ...patch, ...p };
}

/**
 * Converts a SynthPatch to SynthEngineParameters for applying to a running engine
 * via SynthEngineService.setParameters().
 */
export function synthPatchToEngineParameters(patch: SynthPatch): SynthEngineParameters {
  return {
    polyphonyMode: patch.polyphonyMode,
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
      mix: patch.filterMix,
    },

    ladderFilter: {
      enabled: patch.ladderFilterEnabled,
      frequency: patch.ladderFilterFrequency,
      resonance: patch.ladderFilterResonance,
      drive: patch.ladderFilterDrive,
      keyboardTracking: patch.ladderFilterKeyboardTracking,
      postGain: patch.ladderFilterPostGain,
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

    lfo1: {
      enabled: patch.lfoEnabled,
      target: patch.lfoTarget,
      rate: patch.lfoRate,
      depth: patch.lfoDepth,
      shape: patch.lfoShape,
      retrigger: patch.lfoRetrigger,
      fadeIn: patch.lfoFadeIn,
    },

    lfo2: {
      enabled: patch.lfo2Enabled,
      target: patch.lfo2Target,
      rate: patch.lfo2Rate,
      depth: patch.lfo2Depth,
      shape: patch.lfo2Shape,
      retrigger: patch.lfo2Retrigger,
      fadeIn: patch.lfo2FadeIn,
    },

    lfo3: {
      enabled: patch.lfo3Enabled,
      target: patch.lfo3Target,
      rate: patch.lfo3Rate,
      depth: patch.lfo3Depth,
      shape: patch.lfo3Shape,
      retrigger: patch.lfo3Retrigger,
      fadeIn: patch.lfo3FadeIn,
    },
  };
}

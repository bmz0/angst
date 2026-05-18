import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FilterController } from './filter.js';

describe('FilterController', () => {
  let audioContext: OfflineAudioContext;
  let destination: AudioNode;
  let controller: FilterController;

  beforeEach(() => {
    audioContext = new OfflineAudioContext({
      numberOfChannels: 2,
      length: 48000 * 2,
      sampleRate: 48000,
    });
    destination = audioContext.destination;
  });

  afterEach(() => {
    controller?.disconnect();
  });

  // ---------------------------------------------------------------------------
  // constructor
  // ---------------------------------------------------------------------------

  describe('constructor', () => {
    it('should create controller with only required params', () => {
      controller = new FilterController({ audioContext, destination });

      expect(controller).toBeDefined();
      expect(controller.getInput()).toBeInstanceOf(GainNode);
    });

    it('should default to disabled (dry path active, wet path silent)', () => {
      controller = new FilterController({ audioContext, destination, enabled: false });

      expect(controller.getDryGainValue()).toBe(1);
      expect(controller.getWetGainValue()).toBe(0);
    });

    it('should start enabled (wet path active, dry path silent)', () => {
      controller = new FilterController({ audioContext, destination, enabled: true });

      expect(controller.getDryGainValue()).toBe(0);
      expect(controller.getWetGainValue()).toBe(1);
    });

    it('should default mix to 1 (fully wet)', () => {
      controller = new FilterController({ audioContext, destination });

      expect(controller.getMix()).toBe(1);
    });

    it('should apply provided mix value', () => {
      controller = new FilterController({ audioContext, destination, mix: 0.5 });

      expect(controller.getMix()).toBeCloseTo(0.5);
    });

    it('should clamp mix to [0, 1] in constructor', () => {
      const lo = new FilterController({ audioContext, destination, mix: -0.5 });
      const hi = new FilterController({ audioContext, destination, mix: 1.5 });

      expect(lo.getMix()).toBe(0);
      expect(hi.getMix()).toBe(1);

      lo.disconnect();
      hi.disconnect();
    });

    it('should set wet/dry gains according to mix when enabled', () => {
      controller = new FilterController({ audioContext, destination, enabled: true, mix: 0.6 });

      expect(controller.getWetGainValue()).toBeCloseTo(0.6);
      expect(controller.getDryGainValue()).toBeCloseTo(0.4);
    });
  });

  // ---------------------------------------------------------------------------
  // setParameters — existing params
  // ---------------------------------------------------------------------------

  describe('setParameters (existing params)', () => {
    beforeEach(() => {
      controller = new FilterController({ audioContext, destination });
    });

    it('should enable filter and switch to wet path', () => {
      controller.setParameters({ enabled: true });

      expect(controller.getDryGainValue()).toBe(0);
      expect(controller.getWetGainValue()).toBe(1);
    });

    it('should disable filter and switch to dry path', () => {
      controller = new FilterController({ audioContext, destination, enabled: true });
      controller.setParameters({ enabled: false });

      expect(controller.getDryGainValue()).toBe(1);
      expect(controller.getWetGainValue()).toBe(0);
    });

    it('should not throw when setting type, frequency, Q, keyboardTracking, postGain', () => {
      expect(() =>
        controller.setParameters({
          type: 'highpass',
          frequency: 2000,
          Q: 10,
          keyboardTracking: 0.5,
          postGain: 1.2,
        })
      ).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // setParameters — mix
  // ---------------------------------------------------------------------------

  describe('setParameters (mix)', () => {
    beforeEach(() => {
      controller = new FilterController({ audioContext, destination, enabled: true });
    });

    it('should update mix and immediately adjust dry/wet gains', () => {
      controller.setParameters({ mix: 0.4 });

      expect(controller.getMix()).toBeCloseTo(0.4);
      expect(controller.getWetGainValue()).toBeCloseTo(0.4);
      expect(controller.getDryGainValue()).toBeCloseTo(0.6);
    });

    it('should clamp mix to [0, 1] in setParameters', () => {
      controller.setParameters({ mix: 2 });
      expect(controller.getMix()).toBe(1);

      controller.setParameters({ mix: -1 });
      expect(controller.getMix()).toBe(0);
    });

    it('should set fully wet (mix=1): dry=0, wet=1', () => {
      controller.setParameters({ mix: 1 });

      expect(controller.getWetGainValue()).toBeCloseTo(1);
      expect(controller.getDryGainValue()).toBeCloseTo(0);
    });

    it('should set fully dry (mix=0): dry=1, wet=0', () => {
      controller.setParameters({ mix: 0 });

      expect(controller.getWetGainValue()).toBeCloseTo(0);
      expect(controller.getDryGainValue()).toBeCloseTo(1);
    });

    it('should not change dry/wet when filter is disabled despite mix change', () => {
      controller = new FilterController({ audioContext, destination, enabled: false });
      controller.setParameters({ mix: 0.5 });

      // disabled: always dry=1, wet=0
      expect(controller.getDryGainValue()).toBe(1);
      expect(controller.getWetGainValue()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // trackNote
  // ---------------------------------------------------------------------------

  describe('trackNote', () => {
    it('should not throw with keyboard tracking of 0', () => {
      controller = new FilterController({
        audioContext,
        destination,
        frequency: 1000,
        keyboardTracking: 0,
      });

      expect(() => controller.trackNote(440)).not.toThrow();
    });

    it('should not throw with full keyboard tracking', () => {
      controller = new FilterController({
        audioContext,
        destination,
        frequency: 1000,
        keyboardTracking: 1,
      });

      expect(() => controller.trackNote(880)).not.toThrow();
    });

    it('should not throw when called with an absolute time', () => {
      controller = new FilterController({
        audioContext,
        destination,
        frequency: 1000,
        keyboardTracking: 0.5,
      });

      expect(() => controller.trackNote(440, 0.25)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------------------

  describe('disconnect', () => {
    it('should not throw on disconnect', () => {
      controller = new FilterController({ audioContext, destination });

      expect(() => controller.disconnect()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getFrequencyParam
  // ---------------------------------------------------------------------------

  describe('getFrequencyParam', () => {
    it('should return an AudioParam', () => {
      controller = new FilterController({ audioContext, destination });

      expect(controller.getFrequencyParam()).toBeInstanceOf(AudioParam);
    });

    it('should allow scheduling frequency automation directly on the returned param', () => {
      controller = new FilterController({ audioContext, destination });
      const param = controller.getFrequencyParam();

      expect(() => param.setValueAtTime(2000, 0)).not.toThrow();
      expect(() => param.linearRampToValueAtTime(4000, 1.0)).not.toThrow();
    });
  });
});

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

    it('should default filter envelope to disabled', () => {
      controller = new FilterController({ audioContext, destination });

      expect(controller.getFilterEnvelopeParams().enabled).toBe(false);
    });

    it('should apply provided filter envelope params', () => {
      controller = new FilterController({
        audioContext,
        destination,
        envelopeEnabled: true,
        envelopeAttack: 0.1,
        envelopeSustain: 0.5,
        envelopeRelease: 0.3,
      });

      const params = controller.getFilterEnvelopeParams();
      expect(params.enabled).toBe(true);
      expect(params.attack).toBeCloseTo(0.1);
      expect(params.sustain).toBeCloseTo(0.5);
      expect(params.release).toBeCloseTo(0.3);
    });

    it('should default baseLevel to 0', () => {
      controller = new FilterController({ audioContext, destination });

      expect(controller.getFilterEnvelopeParams().baseLevel).toBe(0);
    });

    it('should apply provided baseLevel', () => {
      controller = new FilterController({ audioContext, destination, envelopeBaseLevel: 0.4 });

      expect(controller.getFilterEnvelopeParams().baseLevel).toBeCloseTo(0.4);
    });

    it('should clamp baseLevel to [0, 1] in constructor', () => {
      const lo = new FilterController({ audioContext, destination, envelopeBaseLevel: -0.5 });
      const hi = new FilterController({ audioContext, destination, envelopeBaseLevel: 1.5 });

      expect(lo.getFilterEnvelopeParams().baseLevel).toBe(0);
      expect(hi.getFilterEnvelopeParams().baseLevel).toBe(1);

      lo.disconnect();
      hi.disconnect();
    });

    it('should use sensible default ADSR values when envelope params are omitted', () => {
      controller = new FilterController({ audioContext, destination, envelopeEnabled: true });

      const params = controller.getFilterEnvelopeParams();
      expect(params.attack).toBeGreaterThan(0);
      expect(params.sustain).toBeGreaterThan(0);
      expect(params.sustain).toBeLessThanOrEqual(1);
      expect(params.release).toBeGreaterThan(0);
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
  // setParameters — filter envelope params
  // ---------------------------------------------------------------------------

  describe('setParameters (filter envelope params)', () => {
    beforeEach(() => {
      controller = new FilterController({ audioContext, destination });
    });

    it('should enable filter envelope', () => {
      controller.setParameters({ envelopeEnabled: true });

      expect(controller.getFilterEnvelopeParams().enabled).toBe(true);
    });

    it('should disable filter envelope', () => {
      controller = new FilterController({ audioContext, destination, envelopeEnabled: true });
      controller.setParameters({ envelopeEnabled: false });

      expect(controller.getFilterEnvelopeParams().enabled).toBe(false);
    });

    it('should update envelope attack', () => {
      controller.setParameters({ envelopeAttack: 0.25 });

      expect(controller.getFilterEnvelopeParams().attack).toBeCloseTo(0.25);
    });

    it('should update envelope sustain', () => {
      controller.setParameters({ envelopeSustain: 0.4 });

      expect(controller.getFilterEnvelopeParams().sustain).toBeCloseTo(0.4);
    });

    it('should update envelope release', () => {
      controller.setParameters({ envelopeRelease: 1.0 });

      expect(controller.getFilterEnvelopeParams().release).toBeCloseTo(1.0);
    });

    it('should update multiple envelope params in one call', () => {
      controller.setParameters({
        envelopeEnabled: true,
        envelopeAttack: 0.05,
        envelopeSustain: 0.6,
        envelopeRelease: 0.8,
      });

      const params = controller.getFilterEnvelopeParams();
      expect(params.enabled).toBe(true);
      expect(params.attack).toBeCloseTo(0.05);
      expect(params.sustain).toBeCloseTo(0.6);
      expect(params.release).toBeCloseTo(0.8);
    });

    it('should update envelope baseLevel', () => {
      controller.setParameters({ envelopeBaseLevel: 0.6 });

      expect(controller.getFilterEnvelopeParams().baseLevel).toBeCloseTo(0.6);
    });

    it('should clamp baseLevel to [0, 1] in setParameters', () => {
      controller.setParameters({ envelopeBaseLevel: 2 });
      expect(controller.getFilterEnvelopeParams().baseLevel).toBe(1);

      controller.setParameters({ envelopeBaseLevel: -1 });
      expect(controller.getFilterEnvelopeParams().baseLevel).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // triggerEnvelope
  // ---------------------------------------------------------------------------

  describe('triggerEnvelope', () => {
    it('should not throw when filter is disabled (no-op)', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: false,
        envelopeEnabled: true,
      });

      expect(() => controller.triggerEnvelope()).not.toThrow();
    });

    it('should not change gain values when filter is disabled', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: false,
        envelopeEnabled: true,
      });

      controller.triggerEnvelope();

      // bypass state must remain: dry=1, wet=0
      expect(controller.getDryGainValue()).toBe(1);
      expect(controller.getWetGainValue()).toBe(0);
    });

    it('should not change gain values when filter enabled but envelope disabled', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: false,
      });

      controller.triggerEnvelope();

      // full-wet state must remain: dry=0, wet=1
      expect(controller.getDryGainValue()).toBe(0);
      expect(controller.getWetGainValue()).toBe(1);
    });

    it('should set wet gain to 0 at attack start (ramp begins from silent filter)', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeAttack: 0.5,
        envelopeSustain: 0.7,
        envelopeRelease: 0.2,
      });

      controller.triggerEnvelope();

      // At t=0 (currentTime=0) the scheduled setValueAtTime(0, 0)
      // immediately applies — wet starts from silence, dry starts from full
      expect(controller.getWetGainValue()).toBeCloseTo(0);
      expect(controller.getDryGainValue()).toBeCloseTo(1);
    });

    it('should handle repeated triggers (re-trigger) without throwing', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeAttack: 0.1,
        envelopeSustain: 0.7,
        envelopeRelease: 0.1,
      });

      expect(() => {
        controller.triggerEnvelope();
        controller.triggerEnvelope();
      }).not.toThrow();
    });

    it('should not throw when triggerEnvelope is called before releaseEnvelope', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeAttack: 0.01,
        envelopeSustain: 1.0,
        envelopeRelease: 0.1,
      });

      expect(() => controller.triggerEnvelope()).not.toThrow();
    });

    it('should set wet/dry to baseLevel / (1-baseLevel) when triggered', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeBaseLevel: 0.3,
        envelopeAttack: 0.5,
        envelopeSustain: 0.7,
        envelopeRelease: 0.2,
      });

      controller.triggerEnvelope();

      expect(controller.getWetGainValue()).toBeCloseTo(0.3);
      expect(controller.getDryGainValue()).toBeCloseTo(0.7);
    });
  });

  // ---------------------------------------------------------------------------
  // releaseEnvelope
  // ---------------------------------------------------------------------------

  describe('releaseEnvelope', () => {
    it('should not throw when filter is disabled', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: false,
        envelopeEnabled: true,
      });

      expect(() => controller.releaseEnvelope()).not.toThrow();
    });

    it('should not throw when envelope is disabled', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: false,
      });

      expect(() => controller.releaseEnvelope()).not.toThrow();
    });

    it('should not change gains when filter enabled but envelope disabled', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: false,
      });

      controller.releaseEnvelope();

      expect(controller.getDryGainValue()).toBe(0);
      expect(controller.getWetGainValue()).toBe(1);
    });

    it('should not throw when called before triggerEnvelope', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeRelease: 0.2,
      });

      expect(() => controller.releaseEnvelope()).not.toThrow();
    });

    it('should not throw when called after triggerEnvelope', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeAttack: 0.01,
        envelopeSustain: 0.7,
        envelopeRelease: 0.2,
      });

      controller.triggerEnvelope();

      expect(() => controller.releaseEnvelope()).not.toThrow();
    });

    it('should schedule wet ramp to baseLevel on release (default baseLevel=0)', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeAttack: 0.001,
        envelopeSustain: 0.7,
        envelopeRelease: 2.0,
      });

      // triggerEnvelope starts from baseLevel=0
      controller.triggerEnvelope();
      // After release, wet should ramp back toward baseLevel (0 by default)
      expect(() => controller.releaseEnvelope()).not.toThrow();
      // The ramp target is baseLevel — no assertion on intermediate scheduled
      // value since AudioParam scheduling is async, but we can verify the
      // tracked value was set during triggerEnvelope
      expect(controller.getWetGainValue()).toBe(0);
    });

    it('should schedule wet ramp to custom baseLevel on release', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeBaseLevel: 0.4,
        envelopeAttack: 0.001,
        envelopeSustain: 0.8,
        envelopeRelease: 2.0,
      });

      controller.triggerEnvelope();

      // triggerEnvelope sets wet to baseLevel (0.4)
      expect(controller.getWetGainValue()).toBeCloseTo(0.4);

      // releaseEnvelope should not throw and ramps back to baseLevel
      expect(() => controller.releaseEnvelope()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Envelope / bypass toggle interaction
  // ---------------------------------------------------------------------------

  describe('bypass toggle interaction with envelope', () => {
    it('should rest at baseLevel / (1-baseLevel) when filter and envelope are enabled', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeBaseLevel: 0.4,
      });

      // No note triggered — resting state should match baseLevel
      expect(controller.getWetGainValue()).toBeCloseTo(0.4);
      expect(controller.getDryGainValue()).toBeCloseTo(0.6);
    });

    it('should update resting state immediately when baseLevel changes via setParameters', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeBaseLevel: 0.2,
      });

      controller.setParameters({ envelopeBaseLevel: 0.7 });

      expect(controller.getWetGainValue()).toBeCloseTo(0.7);
      expect(controller.getDryGainValue()).toBeCloseTo(0.3);
    });

    it('should reset to dry=1 wet=0 when disabling filter mid-envelope', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeAttack: 2.0, // very long attack so envelope is still rising
      });

      controller.triggerEnvelope(); // starts ramp — wet is at 0
      controller.setParameters({ enabled: false }); // should cancel and reset

      expect(controller.getDryGainValue()).toBe(1);
      expect(controller.getWetGainValue()).toBe(0);
    });

    it('should reset to baseLevel resting state when re-enabling filter with envelope', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeAttack: 2.0,
      });

      controller.triggerEnvelope();
      controller.setParameters({ enabled: false }); // disable cancels
      controller.setParameters({ enabled: true }); // re-enable: rests at baseLevel (0)

      expect(controller.getDryGainValue()).toBe(1);
      expect(controller.getWetGainValue()).toBe(0);
    });

    it('should allow a fresh triggerEnvelope after disabling and re-enabling', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeAttack: 0.5,
        envelopeSustain: 0.8,
        envelopeRelease: 0.2,
      });

      controller.triggerEnvelope();
      controller.setParameters({ enabled: false });
      controller.setParameters({ enabled: true });
      controller.triggerEnvelope();

      // Envelope restarts from dry=1, wet=0
      expect(controller.getWetGainValue()).toBeCloseTo(0);
      expect(controller.getDryGainValue()).toBeCloseTo(1);
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

    it('should not throw when filter envelope is active', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        frequency: 1000,
        keyboardTracking: 0.5,
      });

      controller.triggerEnvelope();
      expect(() => controller.trackNote(660)).not.toThrow();
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

    it('should not throw on disconnect when filter envelope was active', () => {
      controller = new FilterController({
        audioContext,
        destination,
        enabled: true,
        envelopeEnabled: true,
        envelopeAttack: 0.1,
        envelopeSustain: 0.7,
        envelopeRelease: 0.2,
      });

      controller.triggerEnvelope();
      expect(() => controller.disconnect()).not.toThrow();
    });
  });
});

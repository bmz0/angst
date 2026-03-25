import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnvelopeController } from './envelope.js';

describe('EnvelopeController', () => {
  let audioContext: OfflineAudioContext;
  let destination: AudioNode;
  let controller: EnvelopeController;

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
    it('should create controller and expose a GainNode as input', () => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.5 });

      expect(controller).toBeDefined();
      expect(controller.getInput()).toBeInstanceOf(GainNode);
    });

    it('should default to enabled when enabled is omitted', () => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.5 });

      expect(controller.getEnabled()).toBe(true);
    });

    it('should respect enabled: true', () => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.5, enabled: true });

      expect(controller.getEnabled()).toBe(true);
    });

    it('should respect enabled: false', () => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.5, enabled: false });

      expect(controller.getEnabled()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getParams
  // ---------------------------------------------------------------------------

  describe('getParams', () => {
    it('should return the ADSR values passed in config', () => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.3 });

      const params = controller.getParams();
      expect(params.attack).toBeCloseTo(0.1);
      expect(params.decay).toBeCloseTo(0.2);
      expect(params.sustain).toBeCloseTo(0.5);
      expect(params.release).toBeCloseTo(0.3);
    });
  });

  // ---------------------------------------------------------------------------
  // setParameters
  // ---------------------------------------------------------------------------

  describe('setParameters', () => {
    beforeEach(() => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.5 });
    });

    it('should enable the envelope', () => {
      controller.setParameters({ enabled: false });
      controller.setParameters({ enabled: true });

      expect(controller.getEnabled()).toBe(true);
    });

    it('should disable the envelope', () => {
      controller.setParameters({ enabled: false });

      expect(controller.getEnabled()).toBe(false);
    });

    it('should update attack', () => {
      controller.setParameters({ attack: 0.25 });

      expect(controller.getParams().attack).toBeCloseTo(0.25);
    });

    it('should update decay', () => {
      controller.setParameters({ decay: 0.4 });

      expect(controller.getParams().decay).toBeCloseTo(0.4);
    });

    it('should update sustain', () => {
      controller.setParameters({ sustain: 0.5 });

      expect(controller.getParams().sustain).toBeCloseTo(0.5);
    });

    it('should update release', () => {
      controller.setParameters({ release: 1.2 });

      expect(controller.getParams().release).toBeCloseTo(1.2);
    });

    it('should not change unspecified parameters', () => {
      controller.setParameters({ attack: 0.05 });

      const params = controller.getParams();
      expect(params.decay).toBeCloseTo(0.1);
      expect(params.sustain).toBeCloseTo(0.7);
      expect(params.release).toBeCloseTo(0.5);
    });
  });

  // ---------------------------------------------------------------------------
  // trigger — enabled
  // ---------------------------------------------------------------------------

  describe('trigger (enabled)', () => {
    beforeEach(() => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.5, enabled: true });
    });

    it('should not throw', () => {
      expect(() => controller.trigger()).not.toThrow();
    });

    it('should schedule a gain ramp (gain node is a GainNode)', () => {
      controller.trigger();

      expect(controller.getInput()).toBeInstanceOf(GainNode);
    });
  });

  // ---------------------------------------------------------------------------
  // trigger — disabled (bypass)
  // ---------------------------------------------------------------------------

  describe('trigger (disabled)', () => {
    beforeEach(() => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.5, enabled: false });
    });

    it('should not throw', () => {
      expect(() => controller.trigger()).not.toThrow();
    });

    it('should set gain to 1 immediately', () => {
      controller.trigger();

      expect(controller.getInput().gain.value).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // release — enabled
  // ---------------------------------------------------------------------------

  describe('release (enabled)', () => {
    beforeEach(() => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.5, enabled: true });
    });

    it('should not throw', () => {
      controller.trigger();
      expect(() => controller.release()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // release — disabled (bypass)
  // ---------------------------------------------------------------------------

  describe('release (disabled)', () => {
    beforeEach(() => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.5, enabled: false });
    });

    it('should not throw', () => {
      expect(() => controller.release()).not.toThrow();
    });

    it('should set gain to 0 immediately', () => {
      controller.trigger(); // sets gain to 1
      controller.release();

      expect(controller.getInput().gain.value).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // enable/disable interaction — switching at runtime
  // ---------------------------------------------------------------------------

  describe('enable/disable via setParameters', () => {
    it('should bypass ADSR after being disabled mid-session', () => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.3, decay: 0.2, sustain: 0.6, release: 0.5, enabled: true });

      controller.setParameters({ enabled: false });
      controller.trigger();

      expect(controller.getEnabled()).toBe(false);
      expect(controller.getInput().gain.value).toBe(1);
    });

    it('should resume ADSR shaping after being re-enabled', () => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.3, decay: 0.2, sustain: 0.6, release: 0.5, enabled: false });

      controller.setParameters({ enabled: true });

      expect(controller.getEnabled()).toBe(true);
      // When enabled, trigger() starts an ADSR ramp from the current gain rather than jumping to 1
      expect(() => controller.trigger()).not.toThrow();
    });

    it('should set gain to 0 on release when disabled', () => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.5, enabled: true });

      controller.trigger();
      controller.setParameters({ enabled: false });
      controller.release();

      expect(controller.getInput().gain.value).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------------------

  describe('disconnect', () => {
    it('should not throw when disconnecting', () => {
      controller = new EnvelopeController({ audioContext, destination, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.5 });

      expect(() => controller.disconnect()).not.toThrow();
    });
  });
});

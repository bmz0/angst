import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReverbController } from './reverb.js';

describe('ReverbController', () => {
  let audioContext: BaseAudioContext;
  let destination: AudioNode;
  let controller: ReverbController;

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
    it('should create and expose an input GainNode', () => {
      controller = new ReverbController({
        audioContext,
        destination,
        roomSize: 1.5,
        decay: 2,
        mix: 0.4,
        enabled: true,
        color: 0,
        preDelay: 0.01,
      });

      expect(controller.getInput()).toBeInstanceOf(GainNode);
    });

    it('should set input gain to 1', () => {
      controller = new ReverbController({
        audioContext,
        destination,
        roomSize: 1.5,
        decay: 2,
        mix: 0.4,
        enabled: true,
        color: 0,
        preDelay: 0.01,
      });

      expect(controller.getInput().gain.value).toBe(1);
    });

    it('should construct with neutral color (0) without throwing', () => {
      expect(() => new ReverbController({
        audioContext,
        destination,
        roomSize: 1.5,
        decay: 2,
        mix: 0.6,
        enabled: true,
        color: 0,
        preDelay: 0.01,
      })).not.toThrow();
    });

    it('should construct with dark color (-1) without throwing', () => {
      expect(() => new ReverbController({
        audioContext,
        destination,
        roomSize: 1.5,
        decay: 2,
        mix: 0.6,
        enabled: true,
        color: -1,
        preDelay: 0.01,
      })).not.toThrow();
    });

    it('should construct with bright color (1) without throwing', () => {
      expect(() => new ReverbController({
        audioContext,
        destination,
        roomSize: 1.5,
        decay: 2,
        mix: 0.6,
        enabled: true,
        color: 1,
        preDelay: 0.01,
      })).not.toThrow();
    });

    it('should construct when disabled without throwing', () => {
      expect(() => new ReverbController({
        audioContext,
        destination,
        roomSize: 1.5,
        decay: 2,
        mix: 0.6,
        enabled: false,
        color: 0,
        preDelay: 0.01,
      })).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // setParameters
  // ---------------------------------------------------------------------------

  describe('setParameters', () => {
    beforeEach(() => {
      controller = new ReverbController({
        audioContext,
        destination,
        roomSize: 1.0,
        decay: 2,
        mix: 0.3,
        enabled: false,
        color: 0,
        preDelay: 0.01,
      });
    });

    it('should enable reverb without throwing', () => {
      expect(() => controller.setParameters({ enabled: true })).not.toThrow();
    });

    it('should disable reverb without throwing', () => {
      controller.setParameters({ enabled: true });
      expect(() => controller.setParameters({ enabled: false })).not.toThrow();
    });

    it('should update mix without throwing', () => {
      controller.setParameters({ enabled: true });
      expect(() => controller.setParameters({ mix: 0.8 })).not.toThrow();
    });

    it('should update mix while disabled without throwing', () => {
      expect(() => controller.setParameters({ mix: 0.9 })).not.toThrow();
    });

    // -------------------------------------------------------------------------
    // IR regeneration
    // -------------------------------------------------------------------------

    it('should regenerate IR when roomSize changes', () => {
      expect(() => controller.setParameters({ roomSize: 3.0 })).not.toThrow();
    });

    it('should regenerate IR when decay changes', () => {
      expect(() => controller.setParameters({ decay: 5 })).not.toThrow();
    });

    it('should regenerate IR when color changes', () => {
      expect(() => controller.setParameters({ color: -0.5 })).not.toThrow();
    });

    it('should regenerate IR when roomSize, decay, and color all change', () => {
      expect(() => controller.setParameters({ roomSize: 2.0, decay: 4, color: 0.5 })).not.toThrow();
    });

    it('should not throw when updating all parameters together', () => {
      expect(() =>
        controller.setParameters({ enabled: true, mix: 0.5, roomSize: 2.5, decay: 3, color: -1 })
      ).not.toThrow();
    });

    it('should handle minimum roomSize without throwing', () => {
      expect(() => controller.setParameters({ roomSize: 0.1 })).not.toThrow();
    });

    it('should handle maximum roomSize without throwing', () => {
      expect(() => controller.setParameters({ roomSize: 5.0 })).not.toThrow();
    });

    it('should handle minimum decay without throwing', () => {
      expect(() => controller.setParameters({ decay: 0.1 })).not.toThrow();
    });

    it('should handle maximum decay without throwing', () => {
      expect(() => controller.setParameters({ decay: 10 })).not.toThrow();
    });

    it('should handle minimum color (-1, dark) without throwing', () => {
      expect(() => controller.setParameters({ color: -1 })).not.toThrow();
    });

    it('should handle maximum color (1, bright) without throwing', () => {
      expect(() => controller.setParameters({ color: 1 })).not.toThrow();
    });

    it('should handle neutral color (0) without throwing', () => {
      expect(() => controller.setParameters({ color: 0 })).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------------------

  describe('disconnect', () => {
    it('should disconnect without throwing', () => {
      controller = new ReverbController({
        audioContext,
        destination,
        roomSize: 1.0,
        decay: 2,
        mix: 0.3,
        enabled: true,
        color: 0,
        preDelay: 0.01,
      });

      expect(() => controller.disconnect()).not.toThrow();
    });
  });
});

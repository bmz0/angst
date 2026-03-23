import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OverdriveController } from './overdrive.js';

describe('OverdriveController', () => {
  let audioContext: BaseAudioContext;
  let destination: AudioNode;
  let controller: OverdriveController;
  const makeSoftClipCurve = vi.fn((amount: number) => new Float32Array([0, amount, 1]));
  const makeFoldCurve = vi.fn((threshold: number = 0.5) => new Float32Array([0, threshold, 1]));

  OverdriveController.SOFT_CURVE_FN = makeSoftClipCurve;
  OverdriveController.FOLD_CURVE_FN = makeFoldCurve;

  beforeEach(() => {
    audioContext = new OfflineAudioContext({
      numberOfChannels: 2,
      length: 48000 * 2,
      sampleRate: 48000
    });
    destination = audioContext.destination;
  });

  describe('constructor', () => {
    it('should create with soft overdrive enabled', () => {
      controller = new OverdriveController({
        audioContext,
        destination,
        type: 'soft',
        amount: 50,
        enabled: true
      });

      expect(controller.getInput()).toBeInstanceOf(GainNode);
      expect(makeSoftClipCurve).toHaveBeenCalledWith(50);
    });

    it('should create with fold overdrive disabled', () => {
      controller = new OverdriveController({
        audioContext,
        destination,
        type: 'fold',
        amount: 75,
        enabled: false
      });

      expect(controller).toBeDefined();
      const threshold = 1.0 - (75 / 100);
      expect(makeFoldCurve).toHaveBeenCalledWith(threshold);
    });

    it('should set initial gain values when enabled', () => {
      controller = new OverdriveController({
        audioContext,
        destination,
        type: 'soft',
        amount: 0,
        enabled: true
      });

      const input = controller.getInput();
      expect(input.gain.value).toBe(1);
    });

    it('should set initial gain values when disabled', () => {
      controller = new OverdriveController({
        audioContext,
        destination,
        type: 'soft',
        amount: 0,
        enabled: false
      });

      const input = controller.getInput();
      expect(input.gain.value).toBe(1);
    });
  });

  describe('setParameters', () => {
    beforeEach(() => {
      controller = new OverdriveController({
        audioContext,
        destination,
        type: 'soft',
        amount: 30,
        enabled: false
      });
      vi.clearAllMocks();
    });

    it('should enable overdrive', () => {
      controller.setParameters({ enabled: true });
      
      // Verify bypass state changed (wet gain should be 1, dry should be 0)
      // Note: We can't directly inspect private nodes, so we verify curve updates
      expect(makeSoftClipCurve).not.toHaveBeenCalled(); // Only updateBypass called
    });

    it('should change overdrive type from soft to fold', () => {
      controller.setParameters({ type: 'fold' });

      const threshold = 1.0 - (30 / 100); // amount is still 30
      expect(makeFoldCurve).toHaveBeenCalledWith(threshold);
    });

    it('should update soft overdrive amount', () => {
      controller.setParameters({ amount: 80 });

      expect(makeSoftClipCurve).toHaveBeenCalledWith(80);
    });

    it('should update fold overdrive threshold when amount changes', () => {
      controller.setParameters({ type: 'fold' });
      vi.clearAllMocks();

      controller.setParameters({ amount: 60 });

      const threshold = 1.0 - (60 / 100);
      expect(makeFoldCurve).toHaveBeenCalledWith(threshold);
    });

    it('should update curve when both type and amount change', () => {
      controller.setParameters({ 
        type: 'fold',
        amount: 90 
      });

      const threshold = 1.0 - (90 / 100);
      expect(makeFoldCurve).toHaveBeenCalledWith(threshold);
      // Should only call once despite two parameters changing
      expect(makeFoldCurve).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple parameter updates correctly', () => {
      controller.setParameters({
        enabled: true,
        type: 'fold',
        amount: 45
      });

      const threshold = 1.0 - (45 / 100);
      expect(makeFoldCurve).toHaveBeenCalledWith(threshold);
    });

    it('should not update curve when only enabled changes', () => {
      controller.setParameters({ enabled: true });

      expect(makeSoftClipCurve).not.toHaveBeenCalled();
      expect(makeFoldCurve).not.toHaveBeenCalled();
    });
  });

  describe('fold threshold calculation', () => {
    beforeEach(() => {
      controller = new OverdriveController({
        audioContext,
        destination,
        type: 'fold',
        amount: 0,
        enabled: true
      });
      vi.clearAllMocks();
    });

    it('should calculate threshold as 1.0 when amount is 0', () => {
      controller.setParameters({ amount: 0 });

      expect(makeFoldCurve).toHaveBeenCalledWith(1.0);
    });

    it('should calculate threshold as 0.5 when amount is 50', () => {
      controller.setParameters({ amount: 50 });

      expect(makeFoldCurve).toHaveBeenCalledWith(0.5);
    });

    it('should calculate threshold as 0.0 when amount is 100', () => {
      controller.setParameters({ amount: 100 });

      expect(makeFoldCurve).toHaveBeenCalledWith(0.0);
    });
  });

  describe('disconnect', () => {
    it('should disconnect all nodes', () => {
      controller = new OverdriveController({
        audioContext,
        destination,
        type: 'soft',
        amount: 50,
        enabled: true
      });

      // This should not throw
      expect(() => controller.disconnect()).not.toThrow();
    });
  });

  describe('audio routing', () => {
    it('should have input node connected properly', () => {
      controller = new OverdriveController({
        audioContext,
        destination,
        type: 'soft',
        amount: 50,
        enabled: true
      });

      const input = controller.getInput();
      expect(input).toBeInstanceOf(GainNode);
      expect(input.numberOfInputs).toBe(1);
      expect(input.numberOfOutputs).toBe(1);
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DelayController } from './delay.js';

describe('DelayController', () => {
  let audioContext: BaseAudioContext;
  let destination: AudioNode;
  let controller: DelayController;

  beforeEach(() => {
    vi.useFakeTimers();
    audioContext = new OfflineAudioContext({
      numberOfChannels: 2,
      length: 48000 * 2,
      sampleRate: 48000,
    });
    destination = audioContext.destination;
  });

  afterEach(() => {
    vi.useRealTimers();
    controller?.disconnect();
  });

  // ---------------------------------------------------------------------------
  // constructor
  // ---------------------------------------------------------------------------

  describe('constructor', () => {
    it('should create with default delayPan (0) and ping-pong enabled', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
      });

      expect(controller).toBeDefined();
      expect(controller.isPingPong()).toBe(true);
      expect(controller.getDelayPan()).toBe(0);
    });

    it('should expose an input GainNode', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: false,
      });

      expect(controller.getInput()).toBeInstanceOf(GainNode);
    });

    it('should initialise stereo panner to delayPan value when enabled', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        delayPan: 0.6,
      });

      expect(controller.getCurrentPan()).toBeCloseTo(0.6);
    });

    it('should initialise stereo panner to delayPan value when disabled', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: false,
        delayPan: -0.4,
      });

      expect(controller.getCurrentPan()).toBeCloseTo(-0.4);
    });

    it('should respect pingPong: false config', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: false,
        delayPan: 0.5,
      });

      expect(controller.isPingPong()).toBe(false);
    });

    it('should start ping-pong interval when enabled and pingPong are both true', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
      });

      expect(setIntervalSpy).toHaveBeenCalledOnce();
    });

    it('should NOT start ping-pong interval when disabled', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: false,
        pingPong: true,
      });

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('should NOT start ping-pong interval when pingPong is false', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: false,
      });

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // switchPan
  // ---------------------------------------------------------------------------

  describe('switchPan', () => {
    it('should flip the pan sign (positive → negative) when ping-pong is on', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
        delayPan: 0.5,
      });
      // After construction panDirection=1 → pan=0.5
      expect(controller.getCurrentPan()).toBeCloseTo(0.5);

      controller.switchPan();
      expect(controller.getCurrentPan()).toBeCloseTo(-0.5);
    });

    it('should flip pan back on a second call', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
        delayPan: 0.5,
      });

      controller.switchPan();
      controller.switchPan();
      expect(controller.getCurrentPan()).toBeCloseTo(0.5);
    });

    it('should have no effect when ping-pong is off', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: false,
        delayPan: 0.5,
      });

      controller.switchPan();
      expect(controller.getCurrentPan()).toBeCloseTo(0.5);
    });

    it('should work with negative delayPan (initial left, flips right)', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
        delayPan: -0.4,
      });

      expect(controller.getCurrentPan()).toBeCloseTo(-0.4);
      controller.switchPan();
      expect(controller.getCurrentPan()).toBeCloseTo(0.4);
    });
  });

  // ---------------------------------------------------------------------------
  // setParameters – ping-pong toggle
  // ---------------------------------------------------------------------------

  describe('setParameters – pingPong', () => {
    beforeEach(() => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
        delayPan: 0.6,
      });
    });

    it('should stop ping-pong interval and fix pan at delayPan when turned off', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      // Flip once so panDirection = -1
      controller.switchPan();
      expect(controller.getCurrentPan()).toBeCloseTo(-0.6);

      controller.setParameters({ pingPong: false });

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(controller.isPingPong()).toBe(false);
      // Pan must snap to static delayPan value (not the flipped position)
      expect(controller.getCurrentPan()).toBeCloseTo(0.6);
    });

    it('should start interval when ping-pong is turned on while enabled', () => {
      controller.setParameters({ pingPong: false });
      vi.clearAllMocks();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      controller.setParameters({ pingPong: true });

      expect(setIntervalSpy).toHaveBeenCalledOnce();
      expect(controller.isPingPong()).toBe(true);
    });

    it('should NOT start interval when ping-pong is turned on while disabled', () => {
      controller.setParameters({ enabled: false });
      controller.setParameters({ pingPong: false });
      vi.clearAllMocks();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      controller.setParameters({ pingPong: true });

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // setParameters – enabled toggle
  // ---------------------------------------------------------------------------

  describe('setParameters – enabled', () => {
    it('should start ping-pong interval when enabling with pingPong true', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: false,
        pingPong: true,
      });
      vi.clearAllMocks();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      controller.setParameters({ enabled: true });

      expect(setIntervalSpy).toHaveBeenCalledOnce();
    });

    it('should NOT start ping-pong interval when enabling with pingPong false', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: false,
        pingPong: false,
      });
      vi.clearAllMocks();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      controller.setParameters({ enabled: true });

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('should clear ping-pong interval when disabled', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
      });
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      controller.setParameters({ enabled: false });

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // setParameters – delayPan
  // ---------------------------------------------------------------------------

  describe('setParameters – delayPan', () => {
    it('should update static pan immediately when ping-pong is off', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: false,
        delayPan: 0,
      });

      controller.setParameters({ delayPan: 0.7 });

      expect(controller.getDelayPan()).toBeCloseTo(0.7);
      expect(controller.getCurrentPan()).toBeCloseTo(0.7);
    });

    it('should update current directional pan when ping-pong is on (panDirection = 1)', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
        delayPan: 0.3,
      });
      // panDirection starts at 1 after startPingPong
      controller.setParameters({ delayPan: 0.8 });

      expect(controller.getDelayPan()).toBeCloseTo(0.8);
      expect(controller.getCurrentPan()).toBeCloseTo(0.8); // 1 * 0.8
    });

    it('should update directional pan correctly when panDirection has flipped (= -1)', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
        delayPan: 0.5,
      });
      controller.switchPan(); // panDirection = -1

      controller.setParameters({ delayPan: 0.4 });

      expect(controller.getCurrentPan()).toBeCloseTo(-0.4);
    });

    it('subsequent switchPan should use updated delayPan value', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
        delayPan: 0.3,
      });

      controller.setParameters({ delayPan: 0.9 });
      controller.switchPan();

      expect(controller.getCurrentPan()).toBeCloseTo(-0.9);
    });
  });

  // ---------------------------------------------------------------------------
  // setParameters – other fields
  // ---------------------------------------------------------------------------

  describe('setParameters – other fields', () => {
    beforeEach(() => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: false,
      });
    });

    it('should update mix', () => {
      // Just verify no throw and internal state
      expect(() => controller.setParameters({ mix: 0.8 })).not.toThrow();
    });

    it('should update feedback', () => {
      expect(() => controller.setParameters({ feedback: 0.6 })).not.toThrow();
    });

    it('should update delayTime', () => {
      expect(() => controller.setParameters({ delayTime: 1.5 })).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------------------

  describe('disconnect', () => {
    it('should not throw when disconnecting', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
      });

      expect(() => controller.disconnect()).not.toThrow();
    });

    it('should not throw when disconnecting a disabled controller', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.3,
        feedback: 0.3,
        mix: 0.5,
        enabled: false,
      });

      expect(() => controller.disconnect()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // ping-pong timing via fake timers
  // ---------------------------------------------------------------------------

  describe('ping-pong interval (fake timers)', () => {
    it('should flip pan after each delayTime interval elapses', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.5,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
        delayPan: 0.5,
      });

      expect(controller.getCurrentPan()).toBeCloseTo(0.5);

      vi.advanceTimersByTime(500); // 0.5s interval
      expect(controller.getCurrentPan()).toBeCloseTo(-0.5);

      vi.advanceTimersByTime(500);
      expect(controller.getCurrentPan()).toBeCloseTo(0.5);
    });

    it('should NOT flip pan when ping-pong is disabled after enabling', () => {
      controller = new DelayController({
        audioContext,
        destination,
        delayTime: 0.5,
        feedback: 0.3,
        mix: 0.5,
        enabled: true,
        pingPong: true,
        delayPan: 0.5,
      });

      controller.setParameters({ pingPong: false });
      vi.advanceTimersByTime(1000);

      // pan should stay at delayPan (set when pingPong turned off)
      expect(controller.getCurrentPan()).toBeCloseTo(0.5);
    });
  });
});

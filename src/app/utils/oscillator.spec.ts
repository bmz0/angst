import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OscillatorController } from './oscillator.js';

describe('OscillatorController', () => {
  let audioContext: OfflineAudioContext;
  let destination: AudioNode;
  let controller: OscillatorController;

  beforeEach(() => {
    audioContext = new OfflineAudioContext({
      numberOfChannels: 2,
      length: 48000 * 2,
      sampleRate: 48000
    });
    destination = audioContext.destination;
  });

  afterEach(() => {
    controller?.disconnect();
  });

  describe('constructor', () => {
    it('should create controller with default parameters', () => {
      controller = new OscillatorController({ audioContext, destination });

      expect(controller).toBeDefined();
      expect(controller.isPlaying()).toBe(false);
      expect(controller.getCurrentFrequency()).toBe(440);
      expect(controller.getCurrentGain()).toBe(1);
      expect(controller.isInverted()).toBe(false);
    });

    it('should create controller with custom frequency', () => {
      controller = new OscillatorController({ audioContext, destination, frequency: 880 });

      expect(controller.getCurrentFrequency()).toBe(880);
    });

    it('should create controller with custom gain', () => {
      controller = new OscillatorController({ audioContext, destination, gain: 0.5 });

      expect(controller.getCurrentGain()).toBeCloseTo(0.5);
    });

    it('should create controller with inverted phase', () => {
      controller = new OscillatorController({ audioContext, destination, gain: 0.8, invert: true });

      expect(controller.isInverted()).toBe(true);
      expect(controller.getCurrentGain()).toBeCloseTo(0.8);
    });

    it('should create controller with custom oscillator type', () => {
      controller = new OscillatorController({ audioContext, destination, type: 'sawtooth' });

      expect(controller).toBeDefined();
    });
  });

  describe('play', () => {
    beforeEach(() => {
      controller = new OscillatorController({ audioContext, destination, frequency: 440 });
    });

    it('should start playing', () => {
      controller.play({ frequency: 440 });

      expect(controller.isPlaying()).toBe(true);
    });

    it('should update current frequency when play is called', () => {
      controller.play({ frequency: 880 });

      expect(controller.getCurrentFrequency()).toBe(880);
    });

    it('should remain playing when called again with new frequency', () => {
      controller.play({ frequency: 440 });
      controller.play({ frequency: 880 });

      expect(controller.isPlaying()).toBe(true);
      expect(controller.getCurrentFrequency()).toBe(880);
    });

    it('should restart from stopped state', async () => {
      controller.play({ frequency: 440 });
      controller.stop();

      await audioContext.startRendering();

      controller.play({ frequency: 660 });

      expect(controller.isPlaying()).toBe(true);
      expect(controller.getCurrentFrequency()).toBe(660);
    });

    it('should immediately restart when called during stopping state', () => {
      controller.play({ frequency: 440 });
      controller.stop();

      // While in 'stopping' state, play() should dispose and restart
      // without needing startRendering() since play() during stopping
      // calls disposeOscillator() immediately
      controller.play({ frequency: 880 });

      expect(controller.isPlaying()).toBe(true);
      expect(controller.getCurrentFrequency()).toBe(880);
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      controller = new OscillatorController({ audioContext, destination });
    });

    it('should transition to stopping state when stop is called', () => {
      controller.play({ frequency: 440 });
      controller.stop();

      // 'stopping' still counts as playing until 'ended' fires
      expect(controller.isPlaying()).toBe(true);
    });

    it('should transition to stopped state after rendering completes', async () => {
      controller.play({ frequency: 440 });
      controller.stop();

      await audioContext.startRendering();

      expect(controller.isPlaying()).toBe(false);
    });

    it('should do nothing when not playing', () => {
      expect(() => controller.stop()).not.toThrow();
      expect(controller.isPlaying()).toBe(false);
    });

    it('should handle repeated stop calls', () => {
      controller.play({ frequency: 440 });
      controller.stop();

      expect(() => controller.stop()).not.toThrow();
    });
  });

  describe('restart', () => {
    beforeEach(() => {
      controller = new OscillatorController({ audioContext, destination, frequency: 440 });
    });

    it('should restart with a new frequency', () => {
      controller.play({ frequency: 440 });
      controller.restart({ frequency: 880 });

      expect(controller.isPlaying()).toBe(true);
      expect(controller.getCurrentFrequency()).toBe(880);
    });

    it('should restart with current frequency when none provided', () => {
      controller.play({ frequency: 440 });
      controller.restart({});

      expect(controller.isPlaying()).toBe(true);
      expect(controller.getCurrentFrequency()).toBe(440);
    });
  });

  describe('setParameters', () => {
    beforeEach(() => {
      controller = new OscillatorController({ audioContext, destination });
    });

    it('should update gain', () => {
      controller.setParameters({ gain: 0.5 });

      expect(controller.getCurrentGain()).toBeCloseTo(0.5);
    });

    it('should update invert', () => {
      controller.setParameters({ invert: true });

      expect(controller.isInverted()).toBe(true);
    });

    it('should preserve gain magnitude when inverting', () => {
      controller.setParameters({ gain: 0.7 });
      controller.setParameters({ invert: true });

      expect(controller.getCurrentGain()).toBeCloseTo(0.7);
      expect(controller.isInverted()).toBe(true);
    });

    it('should restore positive gain when uninverting', () => {
      controller.setParameters({ gain: 0.7, invert: true });
      controller.setParameters({ invert: false });

      expect(controller.getCurrentGain()).toBeCloseTo(0.7);
      expect(controller.isInverted()).toBe(false);
    });

    it('should update glide time', () => {
      expect(() => controller.setParameters({ glideTime: 0.3 })).not.toThrow();
    });

    it('should update frequency without playing when not in playing state', () => {
      controller.setParameters({ frequency: 880 });

      expect(controller.getCurrentFrequency()).toBe(880);
      expect(controller.isPlaying()).toBe(false);
    });

    it('should trigger play when frequency changes while playing', () => {
      controller.play({ frequency: 440 });
      controller.setParameters({ frequency: 880 });

      expect(controller.isPlaying()).toBe(true);
      expect(controller.getCurrentFrequency()).toBe(880);
    });

    it('should update oscillator type while in init state', () => {
      expect(() => controller.setParameters({ type: 'square' })).not.toThrow();
    });

    it('should update oscillator type while playing', () => {
      controller.play({ frequency: 440 });

      expect(() => controller.setParameters({ type: 'sawtooth' })).not.toThrow();
    });
  });

  describe('disconnect', () => {
    it('should not throw when disconnecting after playing', () => {
      controller = new OscillatorController({ audioContext, destination });
      controller.play({ frequency: 440 });

      expect(() => controller.disconnect()).not.toThrow();
    });

    it('should not throw when disconnecting without playing', () => {
      controller = new OscillatorController({ audioContext, destination });

      expect(() => controller.disconnect()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // play with at? (offline absolute-time scheduling)
  // ---------------------------------------------------------------------------

  describe('play with at (offline scheduling)', () => {
    beforeEach(() => {
      controller = new OscillatorController({ audioContext, destination, frequency: 440 });
    });

    it('should start playing when at is provided', () => {
      controller.play({ frequency: 440, at: 0 });

      expect(controller.isPlaying()).toBe(true);
    });

    it('should update current frequency when at is provided', () => {
      controller.play({ frequency: 880, at: 0 });

      expect(controller.getCurrentFrequency()).toBe(880);
    });

    it('should render a non-silent buffer when played with at=0', async () => {
      controller.play({ frequency: 440, at: 0 });

      const buffer = await audioContext.startRendering();
      const data = buffer.getChannelData(0);
      const hasAudio = data.some(s => Math.abs(s) > 0);

      expect(hasAudio).toBe(true);
    });

    it('should render silence before at time and audio after it', async () => {
      const atTime = 0.5;
      controller.play({ frequency: 440, at: atTime });

      const buffer = await audioContext.startRendering();
      const sr = buffer.sampleRate;
      const data = buffer.getChannelData(0);

      // Before the scheduled start the buffer should be silent
      const silentWindow = data.slice(0, Math.floor(atTime * sr * 0.9));
      const hasAudioBeforeAt = silentWindow.some(s => Math.abs(s) > 0);
      expect(hasAudioBeforeAt).toBe(false);

      // After the scheduled start there should be audio
      const activeWindow = data.slice(Math.ceil(atTime * sr * 1.1));
      const hasAudioAfterAt = activeWindow.some(s => Math.abs(s) > 0);
      expect(hasAudioAfterAt).toBe(true);
    });

    it('should schedule frequency glide when at is provided with glideTime > 0', () => {
      // Should not throw and state should reflect playing
      controller.play({ frequency: 440, at: 0 });
      expect(() => controller.play({ frequency: 880, at: 0.5, glideTime: 0.2 })).not.toThrow();
      expect(controller.getCurrentFrequency()).toBe(880);
    });

    it('should schedule instant pitch change when at is provided with glideTime = 0', () => {
      controller.play({ frequency: 440, at: 0 });
      expect(() => controller.play({ frequency: 880, at: 0.5 })).not.toThrow();
      expect(controller.getCurrentFrequency()).toBe(880);
    });

    it('stop with at should schedule future stop without immediately changing isPlaying', () => {
      controller.play({ frequency: 440, at: 0 });
      controller.stop(0, 1.0); // stop at 1 second

      // Still in stopping/playing state immediately after scheduling
      expect(controller.isPlaying()).toBe(true);
    });

    it('should stop and render silence after the scheduled stop time', async () => {
      const stopAt = 0.5;
      controller.play({ frequency: 440, at: 0 });
      controller.stop(0, stopAt);

      const buffer = await audioContext.startRendering();
      const sr = buffer.sampleRate;
      const data = buffer.getChannelData(0);

      // There should be some audio before the stop
      const beforeStop = data.slice(0, Math.floor(stopAt * sr * 0.9));
      const hadAudio = beforeStop.some(s => Math.abs(s) > 0);
      expect(hadAudio).toBe(true);

      // After the stop (with some margin) the buffer should be silent
      const afterStop = data.slice(Math.ceil(stopAt * sr * 1.1));
      const hasAudioAfterStop = afterStop.some(s => Math.abs(s) > 0);
      expect(hasAudioAfterStop).toBe(false);
    });

    it('restart with at should seamlessly re-pitch without breaking isPlaying', () => {
      controller.play({ frequency: 440, at: 0 });
      controller.restart({ frequency: 880, at: 0.5 });

      expect(controller.isPlaying()).toBe(true);
      expect(controller.getCurrentFrequency()).toBe(880);
    });
  });

  // ---------------------------------------------------------------------------
  // triggerPitchSweep
  // ---------------------------------------------------------------------------

  describe('triggerPitchSweep', () => {
    beforeEach(() => {
      controller = new OscillatorController({ audioContext, destination, frequency: 440 });
    });

    it('should not throw when called while playing', () => {
      controller.play({ frequency: 440, at: 0 });

      expect(() => controller.triggerPitchSweep(440, 55, 0.05, 0)).not.toThrow();
    });

    it('should no-op gracefully when not playing', () => {
      expect(() => controller.triggerPitchSweep(440, 55, 0.05, 0)).not.toThrow();
    });

    it('should clamp sub-Hz start and end values to 1 Hz minimum', () => {
      controller.play({ frequency: 440, at: 0 });

      // 0 Hz would throw in exponentialRampToValueAtTime — must not throw
      expect(() => controller.triggerPitchSweep(0, 0, 0.1, 0)).not.toThrow();
    });

    it('should render audio with a pitch sweep applied', async () => {
      controller.play({ frequency: 440, at: 0 });
      controller.triggerPitchSweep(880, 110, 1.5, 0);

      const buffer = await audioContext.startRendering();
      const data = buffer.getChannelData(0);
      const hasAudio = data.some(s => Math.abs(s) > 0);
      expect(hasAudio).toBe(true);
    });
  });
});
export interface ArpeggiatorConfig {
  pattern: string; // Pattern where each digit is semitones from root
  tempo: number; // BPM
}

export class ArpeggiatorController {
  private intervalId?: number;
  private currentStep = 0;
  private intervals: number[];
  private tempo: number;
  private onNoteChange?: (frequencyOffset: number) => void;

  private readonly DEFAULT_PATTERN = '0';
  private readonly DEFAULT_TEMPO = 120;

  constructor(config?: Partial<ArpeggiatorConfig>) {
    this.intervals = this.parsePattern(config?.pattern ?? this.DEFAULT_PATTERN);
    this.tempo = config?.tempo ?? this.DEFAULT_TEMPO;
  }

  start(callback: (frequencyOffset: number) => void): void {
    this.stop(); // Clear any existing interval
    this.onNoteChange = callback;
    this.currentStep = 1;

    const stepDuration = (60 / this.tempo) * 1000; // Convert BPM to ms per step

    this.onNoteChange(this.intervals[0]);

    this.intervalId = window.setInterval(() => {
      const semitoneOffset = this.intervals[this.currentStep];
      this.onNoteChange?.(semitoneOffset);
      
      this.currentStep = (this.currentStep + 1) % this.intervals.length;
    }, stepDuration);
  }

  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.currentStep = 0;
  }

  setTempo(tempo: number): void {
    this.tempo = tempo;
  
    // Restart if currently running to apply new tempo
    if (this.intervalId !== undefined && this.onNoteChange) {
      const callback = this.onNoteChange;
      this.start(callback);
    }
  }

  setPattern(pattern: string): void {
    this.intervals = this.parsePattern(pattern);
    
    // Restart if currently running to apply new pattern
    if (this.intervalId !== undefined && this.onNoteChange) {
      const callback = this.onNoteChange;
      this.start(callback);
    }
  }

  isRunning(): boolean {
    return this.intervalId !== undefined;
  }

  private parsePattern(pattern: string): number[] {
    // Validate pattern contains only digits and has at least one digit
    if (!/^\d+$/.test(pattern) || pattern.length === 0) {
      return this.parsePattern(this.DEFAULT_PATTERN);
    }
    
    // Convert each character to a number (0-9 semitones)
    return pattern.split('').map(char => parseInt(char, 10));
  }
}

import { Component, HostListener, input, output, model } from '@angular/core';

export interface NoteEvent {
  note: string;
  octaveOffset?: number;
}

interface KeyboardAction {
  stop?: boolean;
  toggleOscillatorType?: boolean;
  incrementOctave?: boolean;
  decrementOctave?: boolean;
  note?: string;
  octaveOffset?: number;
}

interface KeyDefinition {
  note: string;
  isBlack: boolean;
  octaveOffset: number;
}

@Component({
  selector: 'piano-keyboard',
  templateUrl: './keyboard.html',
  styleUrls: ['./keyboard.css'],
  standalone: true
})
export class Keyboard {
  public currentOctave = model(4);
  public sustainMode = input(false);
  protected notePressed = output<NoteEvent>();
  protected noteReleased = output<void>();
  protected octaveChanged = output<number>();
  protected oscillatorTypeToggled = output<void>();

  protected activeNote?: string;

  protected readonly keys: KeyDefinition[] = [
    { note: 'C', isBlack: false, octaveOffset: 0 },
    { note: 'C#', isBlack: true, octaveOffset: 0 },
    { note: 'D', isBlack: false, octaveOffset: 0 },
    { note: 'D#', isBlack: true, octaveOffset: 0 },
    { note: 'E', isBlack: false, octaveOffset: 0 },
    { note: 'F', isBlack: false, octaveOffset: 0 },
    { note: 'F#', isBlack: true, octaveOffset: 0 },
    { note: 'G', isBlack: false, octaveOffset: 0 },
    { note: 'G#', isBlack: true, octaveOffset: 0 },
    { note: 'A', isBlack: false, octaveOffset: 0 },
    { note: 'A#', isBlack: true, octaveOffset: 0 },
    { note: 'B', isBlack: false, octaveOffset: 0 },
    { note: 'C', isBlack: false, octaveOffset: 1 }
  ];

  private readonly keyMap: Record<string, string> = {
    'KeyA': 'C',
    'KeyW': 'C#',
    'KeyS': 'D',
    'KeyE': 'D#',
    'KeyD': 'E',
    'KeyF': 'F',
    'KeyT': 'F#',
    'KeyG': 'G',
    'KeyY': 'G#',
    'KeyH': 'A',
    'KeyU': 'A#',
    'KeyJ': 'B',
    'KeyK': 'C'
  };

  @HostListener('window:keydown', ['$event'])
  protected handleKeyDown(event: KeyboardEvent): void {
    // Prevent key repeat
    if (event.repeat) return;

    const action = this.parseKeyEvent(event);
    
    if (!action) return;
    
    event.preventDefault();
    this.executeAction(action);
  }

  @HostListener('window:keyup', ['$event'])
  protected handleKeyUp(event: KeyboardEvent): void {
    const note = this.keyMap[event.code];
    if (note && !this.sustainMode()) {
      event.preventDefault();
      this.stop();
    }
  }

  private parseKeyEvent(event: KeyboardEvent): KeyboardAction | null {
    if (event.code === 'Escape' || event.code === 'Space') {
      return { stop: true };
    }

    if (event.code === 'KeyO') {
      return { toggleOscillatorType: true };
    }

    if (event.code === 'Comma') {
      return { decrementOctave: true };
    }

    if (event.code === 'Period') {
      return { incrementOctave: true };
    }

    const note = this.keyMap[event.code];
    if (note) {
      const octaveOffset = note === 'C' && event.code === 'KeyK' ? 1 : 0;
      return { note, octaveOffset };
    }

    return null;
  }

  private executeAction(action: KeyboardAction): void {
    if (action.stop) {
      this.stop();
    } else if (action.toggleOscillatorType) {
      this.oscillatorTypeToggled.emit();
    } else if (action.incrementOctave) {
      this.incrementOctave();
    } else if (action.decrementOctave) {
      this.decrementOctave();
    } else if (action.note) {
      this.playNote(action.note, action.octaveOffset);
    }
  }

  protected playNote(note: string, octaveOffset: number = 0): void {
    const noteKey = octaveOffset === 1 ? `${note}-high` : note;
    this.activeNote = noteKey;
    this.notePressed.emit({ note, octaveOffset });
  }

  protected stopNote(note: string, octaveOffset: number = 0): void {
    const noteKey = octaveOffset === 1 ? `${note}-high` : note;
    if (this.activeNote === noteKey && !this.sustainMode()) {
      this.stop();
    }
  }

  protected stop(): void {
    this.activeNote = undefined;
    this.noteReleased.emit();
  }

  protected isActive(note: string, octaveOffset: number = 0): boolean {
    const noteKey = octaveOffset === 1 ? `${note}-high` : note;
    return this.activeNote === noteKey;
  }

  private incrementOctave(): void {
    const currentOctave = this.currentOctave();
    if (currentOctave < 9) {
      this.currentOctave.set(currentOctave + 1)
      this.octaveChanged.emit(currentOctave + 1);
    }
  }

  private decrementOctave(): void {
    const currentOctave = this.currentOctave();
    if (currentOctave > 0) {
      this.currentOctave.set(currentOctave - 1);
      this.octaveChanged.emit(currentOctave - 1);
    }
  }
}

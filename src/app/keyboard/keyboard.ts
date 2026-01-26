import { Component, HostListener, output, model } from '@angular/core';

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

interface PressedKey {
  note: string;
  octaveOffset: number;
  keyCode: string;
}

@Component({
  selector: 'piano-keyboard',
  templateUrl: './keyboard.html',
  styleUrls: ['./keyboard.css'],
  standalone: true
})
export class Keyboard {
  public currentOctave = model(4);
  protected notePressed = output<NoteEvent>();
  protected noteReleased = output<void>();
  protected octaveChanged = output<number>();
  protected oscillatorTypeToggled = output<void>();

  protected activeNote?: string;
  private pressedKeys: PressedKey[] = [];

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
    this.executeAction(action, event.code);
  }

  @HostListener('window:keyup', ['$event'])
  protected handleKeyUp(event: KeyboardEvent): void {
    const note = this.keyMap[event.code];
    if (note) {
      event.preventDefault();
      this.handleKeyRelease(event.code);
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

  private executeAction(action: KeyboardAction, keyCode?: string): void {
    if (action.stop) {
      this.stop();
      this.pressedKeys = [];
    } else if (action.toggleOscillatorType) {
      this.oscillatorTypeToggled.emit();
    } else if (action.incrementOctave) {
      this.incrementOctave();
    } else if (action.decrementOctave) {
      this.decrementOctave();
    } else if (action.note && keyCode) {
      this.handleKeyPress(action.note, action.octaveOffset ?? 0, keyCode);
    }
  }

  private handleKeyPress(note: string, octaveOffset: number, keyCode: string): void {
    // Check if this key is already pressed
    const existingIndex = this.pressedKeys.findIndex(k => k.keyCode === keyCode);
    if (existingIndex !== -1) {
      return;
    }

    // Add to pressed keys
    this.pressedKeys.push({ note, octaveOffset, keyCode });

    // Play the newly pressed note
    this.playNote(note, octaveOffset);
  }

  private handleKeyRelease(keyCode: string): void {
    // Find and remove the released key
    const index = this.pressedKeys.findIndex(k => k.keyCode === keyCode);
    if (index === -1) {
      return;
    }

    const releasedKey = this.pressedKeys[index];
    this.pressedKeys.splice(index, 1);

    // Check if the released key was the currently active one
    const noteKey = this.getNoteKey(releasedKey.note, releasedKey.octaveOffset);
    if (this.activeNote === noteKey) {
      if (this.pressedKeys.length > 0) {
        // Play the last remaining key
        const lastKey = this.pressedKeys[this.pressedKeys.length - 1];
        this.playNote(lastKey.note, lastKey.octaveOffset);
      } else {
        // No keys left, stop playback
        this.stop();
      }
    }
  }

  protected playNote(note: string, octaveOffset: number = 0): void {
    const noteKey = this.getNoteKey(note, octaveOffset);
    this.activeNote = noteKey;
    this.notePressed.emit({ note, octaveOffset });
  }

  protected stopNote(note: string, octaveOffset: number = 0): void {
    // Remove this note from pressed keys
    const noteKey = this.getNoteKey(note, octaveOffset);
    const index = this.pressedKeys.findIndex(
      k => this.getNoteKey(k.note, k.octaveOffset) === noteKey
    );
    
    if (index !== -1) {
      this.pressedKeys.splice(index, 1);
    }

    // If this was the active note, handle release logic
    if (this.activeNote === noteKey) {
      if (this.pressedKeys.length > 0) {
        const lastKey = this.pressedKeys[this.pressedKeys.length - 1];
        this.playNote(lastKey.note, lastKey.octaveOffset);
      } else {
        this.stop();
      }
    }
  }

  protected stop(): void {
    this.activeNote = undefined;
    this.noteReleased.emit();
  }

  protected isActive(note: string, octaveOffset: number = 0): boolean {
    const noteKey = this.getNoteKey(note, octaveOffset);
    return this.activeNote === noteKey;
  }

  private getNoteKey(note: string, octaveOffset: number): string {
    return octaveOffset === 1 ? `${note}-high` : note;
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

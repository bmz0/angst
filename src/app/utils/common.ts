/**
 * Standard tuning pitch for A4 in Hz (concert pitch)
 */
export const A4_FREQUENCY = 440;

/**
 * Converts scientific pitch notation to frequency in Hz
 * @param note - Note in scientific pitch notation (e.g., 'A4', 'C#5', 'Bb3')
 * @returns Frequency in Hz
 */
export function getFrequency(note: string): number {
  const parsedNote = note.match(/^([A-G])([#b]?)([0-9])$/);

  if (!parsedNote) {
    throw new Error('Invalid note format');
  }

  const [, letter, accidental, octaveStr] = parsedNote;
  const octave = Number(octaveStr);

  // Calculate position relative to C in semitones
  const basePositions: Record<string, number> = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
  };

  let semitonePosition = basePositions[letter];
  semitonePosition += accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;

  // Distance from A4 in semitones
  const stepsFromA4 = (octave - 4) * 12 + semitonePosition - 9;

  // Apply equal temperament formula: f = A4_FREQUENCY * 2^(n/12)
  return A4_FREQUENCY * Math.pow(2, stepsFromA4 / 12);
}

export function getFrequencyWithOffset(baseFrequency: number, semitones: number): number {
  // Each semitone is 2^(1/12) ratio
  return baseFrequency * Math.pow(2, semitones / 12);
}

/**
 * Disconnects an AudioNode from an optional destination, silently ignoring
 * InvalidAccessError (already disconnected). Any other error is rethrown.
 */
export function safeDisconnect(node: AudioNode, destination?: AudioNode): void {
  try {
    if (destination !== undefined) {
      node.disconnect(destination);
    } else {
      node.disconnect();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'InvalidAccessError') {
      return;
    }
    throw error;
  }
}

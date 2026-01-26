/**
 * Creates a soft clipping/overdrive distortion curve using arctangent-like waveshaping.
 * @param amount - Distortion intensity (0 = clean, higher values = more distortion)
 * @param samples - Number of samples in the curve (default: 44100)
 * @returns Float32Array suitable for WaveShaperNode.curve
 */
export function makeSoftClipCurve(amount: number, samples: number = 44100) {
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  let maxValue = 0;

  // Generate curve and find peak
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    maxValue = Math.max(maxValue, Math.abs(curve[i]));
  }

  // Normalize to prevent level loss
  const normalizationFactor = 1.0 / maxValue;
  for (let i = 0; i < samples; i++) {
    curve[i] *= normalizationFactor;
  }

  return curve;
}

/**
 * Creates a hard clipping curve with threshold-based folding and normalization.
 * Samples exceeding the threshold are folded back by subtracting the excess.
 * The curve is normalized to maintain consistent output level.
 * 
 * @param threshold - Clipping threshold (0.0 to 1.0). Lower values = more distortion
 * @param samples - Number of samples in the transfer curve
 * @returns Float32Array representing the waveshaper curve
 */
export function makeHardClipCurve(threshold: number = 0.5, samples: number = 44100) {
  const curve = new Float32Array(samples);
  
  // Clamp threshold between 0.1 and 1.0 to prevent extreme values
  const clampedThreshold = Math.max(0.1, Math.min(1.0, threshold));
  
  let maxValue = 0;
  
  // Generate curve and find peak value
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1; // Map to -1 to 1
    
    if (x > clampedThreshold) {
      // Positive overflow: subtract excess from threshold
      curve[i] = clampedThreshold - (x - clampedThreshold);
    } else if (x < -clampedThreshold) {
      // Negative overflow: subtract excess from negative threshold
      curve[i] = -clampedThreshold - (x + clampedThreshold);
    } else {
      // Within threshold: pass through unchanged
      curve[i] = x;
    }
    
    maxValue = Math.max(maxValue, Math.abs(curve[i]));
  }
  
  // Normalize to prevent level loss
  const normalizationFactor = maxValue > 0 ? 1.0 / maxValue : 1.0;
  for (let i = 0; i < samples; i++) {
    curve[i] *= normalizationFactor;
  }
  
  return curve;
}

/**
 * Creates a bypass curve (linear pass-through, no distortion).
 * @param samples - Number of samples in the curve (default: 44100)
 * @returns Float32Array with identity mapping
 */
export function makeBypassCurve(samples: number = 44100) {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    curve[i] = (i * 2) / samples - 1;
  }
  return curve;
}

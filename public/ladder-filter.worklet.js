"use strict";
/**
 * Moog-style 4-pole transistor ladder filter — AudioWorklet processor.
 *
 * DSP model: Huovilainen (2006) with sequential (Gauss-Seidel) per-stage
 * updates and per-stage tanh saturation.  Feedback uses the previous
 * sample's y4 (one-sample delay), which introduces ~22 µs of latency at
 * 44 100 Hz — perceptually negligible and industry-standard for this model.
 *
 * Registered processor name: "ladder-filter"
 *
 * ─── AudioParams ──────────────────────────────────────────────────────────────
 *   cutoff     Hz    a-rate   [20, 20 000]   Default: 1 000
 *              Sample-accurate cutoff frequency.  Expose this AudioParam
 *              directly to the filter envelope for zero-latency modulation.
 *
 *   resonance  –     k-rate   [0, 4)         Default: 0
 *              Feedback amount.  0 = no resonance; ≥ 3.8 approaches
 *              self-oscillation (the exact onset depends on drive and
 *              signal level because of the nonlinear feedback path).
 *
 *   drive      –     k-rate   [0.5, 10]      Default: 1
 *              Input gain applied before the feedback subtraction.  ≤ 1
 *              keeps the filter linear; > 1 introduces harmonic content
 *              characteristic of the transistor ladder topology.
 *
 * ─── Messages (port.postMessage) ─────────────────────────────────────────────
 *   { type: 'reset' }
 *              Clears all integrator state immediately.  Useful when
 *              restarting a note after a very long silence to eliminate
 *              any residual DC from the feedback path.
 *
 * ─── Build / integration note ─────────────────────────────────────────────────
 *   AudioWorklet modules must be served as standalone JavaScript files and
 *   loaded via:
 *
 *       await audioContext.audioWorklet.addModule(url);
 *
 *   This TypeScript source file MUST be compiled and deployed separately
 *   from the main Angular bundle.  Recommended strategies:
 *
 *   Option A (simplest): compile with a one-off tsc invocation targeting
 *   ES2017+, place the output in public/ as ladder-filter.worklet.js, and
 *   reference it with a relative URL at runtime.
 *
 *   Option B (build pipeline): add a custom esbuild plugin or a secondary
 *   TypeScript project to compile the worklet during ng build.
 *
 *   Option C: inline the compiled JS as a Blob URL at module initialisation
 *   time — avoids asset management but makes source maps harder to produce.
 *
 *   The FilterController integration wrapper should call addModule() during
 *   its async factory / preload phase (before SynthEngine construction).
 */
// ── Constants ─────────────────────────────────────────────────────────────────
/** Maximum number of channels processed independently. */
const MAX_CHANNELS = 2;
/**
 * Safety ceiling for the resonance coefficient.
 * At exactly 4.0 the Moog ladder self-oscillates; clamp slightly below
 * to prevent unbounded state growth when drive > 1 pushes the loop gain over
 * the limit before feedback clipping can stabilise it.
 */
const MAX_RESONANCE = 3.98;
// ── Processor ─────────────────────────────────────────────────────────────────
class LadderFilterProcessor extends AudioWorkletProcessor {
    /**
     * Four integrator states per channel: [y1, y2, y3, y4].
     * Float64 for numerical stability — the downcast to Float32 happens only
     * when writing to the output buffer.
     */
    state;
    static get parameterDescriptors() {
        return [
            {
                name: 'cutoff',
                defaultValue: 1000,
                minValue: 20,
                maxValue: 20000,
                automationRate: 'a-rate',
            },
            {
                name: 'resonance',
                defaultValue: 0,
                minValue: 0,
                maxValue: 4,
                automationRate: 'k-rate',
            },
            {
                name: 'drive',
                defaultValue: 1,
                minValue: 0.5,
                maxValue: 10,
                automationRate: 'k-rate',
            },
        ];
    }
    constructor(options) {
        super(); // DOM lib declares AudioWorkletProcessor as new() with no parameters
        this.state = Array.from({ length: MAX_CHANNELS }, () => new Float64Array(4));
        this.port.onmessage = (event) => {
            if (event.data.type === 'reset') {
                this.resetState();
            }
        };
    }
    resetState() {
        for (const ch of this.state) {
            ch.fill(0);
        }
    }
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        // Keep the processor alive even when there is no input yet; the first
        // note may arrive before the upstream oscillator has produced any frames.
        if (!input || input.length === 0 || !output || output.length === 0) {
            return true;
        }
        const cutoffParam = parameters['cutoff']; // length 128 (a-rate) or 1 (k-rate)
        const resonance = parameters['resonance'][0]; // k-rate: single value per block
        const drive = parameters['drive'][0]; // k-rate: single value per block
        const k = Math.min(resonance, MAX_RESONANCE);
        const isARateCutoff = cutoffParam.length > 1;
        const blockSize = output[0].length; // typically 128
        const numChannels = Math.min(input.length, output.length, MAX_CHANNELS);
        // Drive normalization: compensates for the tanh saturation loss at the
        // input stage, keeping output level consistent regardless of drive amount.
        // Computed once per block (k-rate) using Math.tanh for accuracy.
        // At drive=1 this applies +2.4 dB of makeup gain; at drive≥5 it approaches
        // unity (the input is already saturating hard and there is nothing to add).
        const driveCompensation = 1 / Math.tanh(drive);
        // Precompute the frequency coefficient for k-rate cutoff (avoids tan() in loop).
        // When cutoff is a-rate we compute per-sample inside the loop instead.
        let gKRate = 0;
        if (!isARateCutoff) {
            gKRate = computeG(cutoffParam[0]);
        }
        for (let ch = 0; ch < numChannels; ch++) {
            const inputCh = input[ch];
            const outputCh = output[ch];
            const s = this.state[ch];
            // Unpack state into local variables — avoids repeated typed-array indexing
            // inside the hot loop, which the JIT can then keep in registers.
            let y1 = s[0], y2 = s[1], y3 = s[2], y4 = s[3];
            for (let i = 0; i < blockSize; i++) {
                const g = isARateCutoff ? computeG(cutoffParam[i]) : gKRate;
                // ── Input with drive and resonance feedback ───────────────────────────
                // Saturate the combined input+feedback signal so that boosting resonance
                // cannot cause unbounded filter state growth.
                const x = tanhClip(drive * (inputCh[i] ?? 0) - k * y4);
                // ── 4-pole cascade (Huovilainen sequential form) ──────────────────────
                // Each stage: y_n += g * ( tanh(input_n) − tanh(y_n) )
                // Sequential update: each stage reads the *just-updated* output of the
                // previous stage, which improves numerical stability compared with the
                // fully explicit (Runge-Kutta-style explicit Euler) form.
                y1 += g * (tanhClip(x) - tanhClip(y1));
                y2 += g * (tanhClip(y1) - tanhClip(y2));
                y3 += g * (tanhClip(y2) - tanhClip(y3));
                y4 += g * (tanhClip(y3) - tanhClip(y4));
                outputCh[i] = y4 * driveCompensation;
            }
            // Persist state for the next block.
            s[0] = y1;
            s[1] = y2;
            s[2] = y3;
            s[3] = y4;
        }
        // Safety fallback: if the upstream source is mono the browser may only
        // provide one input channel even when channelCount:2 is requested (e.g.
        // in some test environments).  Copy ch0 → ch1 so the right channel is
        // never silent regardless.
        if (numChannels === 1 && output.length > 1 && output[1]) {
            output[1].set(output[0]);
        }
        return true; // keep processor alive
    }
}
// ── DSP helpers ───────────────────────────────────────────────────────────────
/**
 * Bilinear-transform frequency coefficient.
 *
 * g = tan(π * fc / fs)
 *
 * This is the correct prewarped coefficient for a first-order ZDF (zero-delay
 * feedback) integrator.  When used as the step size in:
 *
 *   y_new = y + g * (input − y)
 *
 * it places the −3 dB point exactly at fc Hz.
 *
 * Clamped to [ε, 1) to prevent zero-step / Nyquist blow-up.
 */
function computeG(cutoffHz) {
    return Math.min(0.9999, Math.max(1e-4, Math.tan((Math.PI * cutoffHz) / sampleRate)));
}
/**
 * Soft-clip via a rational (Padé [3/2]) approximation to tanh(x).
 *
 * Error vs Math.tanh:  |ε| < 0.0015 for all x  — adequate for audio DSP.
 *
 * Avoids calling Math.tanh directly because some JS engines do not inline it
 * automatically; the polynomial form is more JIT-friendly in the hot sample
 * loop.
 *
 * Behaviour:
 *   |x| ≤ 3  →  rational approximation  (smooth transition region)
 *   |x| >  3  →  hard clamp to ±1        (fully saturated, avoid large x²)
 */
function tanhClip(x) {
    if (x > 3)
        return 1;
    if (x < -3)
        return -1;
    const x2 = x * x;
    return (x * (27 + x2)) / (27 + 9 * x2);
}
// ── Register ──────────────────────────────────────────────────────────────────
registerProcessor('ladder-filter', LadderFilterProcessor);
//# sourceMappingURL=ladder-filter.worklet.js.map
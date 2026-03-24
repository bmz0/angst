export function drawWaveform(
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement,
  canvasContext: CanvasRenderingContext2D,
  dataArray: Uint8Array<ArrayBuffer>,
  canvasBackground: string,
  canvasLine: string
): void {
  const width = canvas.width;
  const height = canvas.height;

  analyser.getByteTimeDomainData(dataArray);
  
  canvasContext.fillStyle = canvasBackground;
  canvasContext.fillRect(0, 0, width, height);
  
  canvasContext.lineWidth = 2;
  canvasContext.strokeStyle = canvasLine;
  canvasContext.beginPath();
  
  const bufferLength = dataArray.length;
  const sliceWidth = width / bufferLength;
  let x = 0;
  
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * height / 2;
    
    if (i === 0) {
      canvasContext.moveTo(x, y);
    } else {
      canvasContext.lineTo(x, y);
    }
    
    x += sliceWidth;
  }
  
  canvasContext.lineTo(width, height / 2);
  canvasContext.stroke();
}

const PEAK_DECAY = 1.2;
const PEAK_HOLD_MS = 1200;

export function drawSpectrum(
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement,
  canvasContext: CanvasRenderingContext2D,
  dataArray: Uint8Array<ArrayBuffer>,
  peaks: Float32Array,
  peakTimestamps: Float64Array,
  now: number,
  canvasBackground: string,
  canvasLine: string
): void {
  const width = canvas.width;
  const height = canvas.height;

  analyser.getByteFrequencyData(dataArray);

  canvasContext.fillStyle = canvasBackground;
  canvasContext.fillRect(0, 0, width, height);

  canvasContext.fillStyle = canvasLine;

  const bufferLength = dataArray.length;
  const logMin = Math.log10(5);
  const logMax = Math.log10(bufferLength);

  for (let x = 0; x < width; x++) {
    const binIndex = Math.min(Math.round(Math.pow(10, logMin + (x / width) * (logMax - logMin)) - 1), bufferLength - 1);
    const barHeight = (dataArray[binIndex] / 255) * height - 10;

    if (barHeight > peaks[x]) {
      peaks[x] = barHeight;
      peakTimestamps[x] = now;
    } else if (now - peakTimestamps[x] > PEAK_HOLD_MS) {
      peaks[x] = Math.max(0, peaks[x] - PEAK_DECAY);
    }

    canvasContext.fillRect(x, height - barHeight, 1, barHeight);
    if (peaks[x] > 0) {
      canvasContext.fillRect(x, height - peaks[x], 1, 1);
    }
  }
}

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

export function drawSpectrum(
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement,
  canvasContext: CanvasRenderingContext2D,
  dataArray: Uint8Array<ArrayBuffer>,
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
  const barWidth = width / bufferLength;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * height - 10;
    canvasContext.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
  }
}

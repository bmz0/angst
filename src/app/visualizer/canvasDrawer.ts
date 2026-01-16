export function drawWaveform(
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement,
  canvasContext: CanvasRenderingContext2D
): void {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const width = canvas.width;
  const height = canvas.height;
  const canvasBackground = getComputedStyle(canvas).getPropertyValue('--canvas-background') || 'white';
  const canvasLine = getComputedStyle(canvas).getPropertyValue('--canvas-line') || 'black';

  analyser.getByteTimeDomainData(dataArray);
  
  canvasContext.fillStyle = canvasBackground;
  canvasContext.fillRect(0, 0, width, height);
  
  canvasContext.lineWidth = 2;
  canvasContext.strokeStyle = canvasLine;
  canvasContext.beginPath();
  
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

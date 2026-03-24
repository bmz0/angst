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

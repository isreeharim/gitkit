/**
 * Browser-side utility for rasterizing SVG markup into a high-resolution PNG Blob
 * using standard HTML5 Canvas without any external servers or paid third-party tools.
 */
export async function exportSvgToPngBlob(
  svgString: string,
  options: { scale?: number } = {}
): Promise<Blob> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PNG export is only supported in browser environments with HTML5 Canvas.');
  }

  const scale = options.scale ?? 2; // Default 2x for crisp Retina rendering

  // Parse width and height from SVG attributes or viewBox
  const widthMatch = svgString.match(/width="(\d+)"/);
  const heightMatch = svgString.match(/height="(\d+)"/);
  const viewBoxMatch = svgString.match(/viewBox="0 0 (\d+) (\d+)"/);

  const baseWidth = widthMatch
    ? parseInt(widthMatch[1], 10)
    : viewBoxMatch
      ? parseInt(viewBoxMatch[1], 10)
      : 1200;

  const baseHeight = heightMatch
    ? parseInt(heightMatch[1], 10)
    : viewBoxMatch
      ? parseInt(viewBoxMatch[2], 10)
      : 800;

  const width = baseWidth * scale;
  const height = baseHeight * scale;

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load SVG into image for canvas rendering.'));
      img.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not acquire 2D rendering context from canvas.');
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw background and SVG
    ctx.drawImage(img, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas failed to serialize to PNG blob.'));
        }
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

import type { Rect, ImageFilters } from "../types";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous"; // Tainted canvas korumasi (Asset Protocol icin gerekli)
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Goruntu okunamadi."));
    image.src = src;
  });

export const cropImageToBase64 = async (
  imageSrc: string, 
  rect: Rect, 
  filters?: ImageFilters,
  displayWidth?: number,
  displayHeight?: number,
): Promise<string> => {
  const image = await loadImage(imageSrc);

  // Scale rect from CSS display pixels to natural image pixels
  // object-fit: contain means the image may be letterboxed inside displayWidth x displayHeight
  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (displayWidth && displayWidth > 0 && displayHeight && displayHeight > 0) {
    const naturalAspect = image.naturalWidth / image.naturalHeight;
    const containerAspect = displayWidth / displayHeight;

    let renderedW: number;
    let renderedH: number;

    if (naturalAspect > containerAspect) {
      // Image is wider than container — letterboxed top/bottom
      renderedW = displayWidth;
      renderedH = displayWidth / naturalAspect;
      offsetX = 0;
      offsetY = (displayHeight - renderedH) / 2;
    } else {
      // Image is taller than container — pillarboxed left/right
      renderedH = displayHeight;
      renderedW = displayHeight * naturalAspect;
      offsetX = (displayWidth - renderedW) / 2;
      offsetY = 0;
    }

    scaleX = image.naturalWidth / renderedW;
    scaleY = image.naturalHeight / renderedH;
  }

  // Apply offset and scale to get natural-pixel source coordinates
  const sX = Math.max(0, Math.floor((rect.x - offsetX) * scaleX));
  const sY = Math.max(0, Math.floor((rect.y - offsetY) * scaleY));
  const sWidth = Math.max(1, Math.floor(rect.width * scaleX));
  const sHeight = Math.max(1, Math.floor(rect.height * scaleY));

  // --- DINAMİK ÖLÇEKLENDİRME ---
  // Çok küçük görselleri büyüt (OCR için), çok büyükleri olduğu gibi bırak veya küçült.
  // Hedef: Metin yüksekliğinin makul olması ve RAM tasarrufu.
  let scaleFactor = 1.0;
  
  if (sWidth < 1000 && sHeight < 1000) {
    scaleFactor = 2.0; // Küçük alanlar için büyütme hala yararlı
  } else if (sWidth > 2000 || sHeight > 2000) {
    scaleFactor = 0.8; // Çok büyük alanlar için hafif küçültme performansı artırır
  }

  const dWidth = Math.floor(sWidth * scaleFactor);
  const dHeight = Math.floor(sHeight * scaleFactor);

  // Maksimum boyut sınırı (RAM koruması)
  const MAX_CANVAS_DIM = 3000;
  let finalWidth = dWidth;
  let finalHeight = dHeight;
  
  if (finalWidth > MAX_CANVAS_DIM || finalHeight > MAX_CANVAS_DIM) {
    const ratio = Math.min(MAX_CANVAS_DIM / finalWidth, MAX_CANVAS_DIM / finalHeight);
    finalWidth = Math.floor(finalWidth * ratio);
    finalHeight = Math.floor(finalHeight * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = finalWidth;
  canvas.height = finalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas baslatilamadi.");
  }

  // Kaliteli olceklendirme ayarlari
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Gri tonlamaya cevir (Grayscale) + Filters - GPU hizlandirmali
  const contrastPercent = (filters?.contrast ?? 1.0) * 100;
  const invertVal = filters?.invert ? 100 : 0;
  ctx.filter = `grayscale(100%) invert(${invertVal}%) contrast(${contrastPercent}%)`;

  // Arka plani beyaz yap (OCR icin iyidir)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, finalWidth, finalHeight);

  ctx.drawImage(
    image,
    sX,
    sY,
    sWidth,
    sHeight,
    0,
    0,
    finalWidth,
    finalHeight,
  );

  return canvas.toDataURL("image/png", 0.9); // Hafif sıkıştırma hızı artırır
};

export const createThumbnail = async (
  imageSrc: string,
  maxSize: number = 400
): Promise<string> => {
  const image = await loadImage(imageSrc);
  const { width: sWidth, height: sHeight } = image;

  let dWidth = sWidth;
  let dHeight = sHeight;

  if (sWidth > maxSize || sHeight > maxSize) {
    const ratio = Math.min(maxSize / sWidth, maxSize / sHeight);
    dWidth = Math.floor(sWidth * ratio);
    dHeight = Math.floor(sHeight * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = dWidth;
  canvas.height = dHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas baslatilamadi.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, dWidth, dHeight);

  // JPEG formatı thumbnail'ler için daha az yer kaplar
  return canvas.toDataURL("image/jpeg", 0.7);
};


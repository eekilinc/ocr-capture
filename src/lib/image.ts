import type { Rect, ImageFilters } from "../types";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Goruntu okunamadi."));
    image.src = src;
  });

export const cropImageToBase64 = async (
  imageSrc: string, 
  rect: Rect, 
  filters?: ImageFilters
): Promise<string> => {
  const image = await loadImage(imageSrc);

  // Kaynak (source) boyutlari
  const sX = Math.floor(rect.x);
  const sY = Math.floor(rect.y);
  const sWidth = Math.max(1, Math.floor(rect.width));
  const sHeight = Math.max(1, Math.floor(rect.height));

  // Hedef (destination) boyutlari - OCR basarisi icin 2.5x buyutme
  const scaleFactor = 2.5;
  const dWidth = Math.floor(sWidth * scaleFactor);
  const dHeight = Math.floor(sHeight * scaleFactor);

  const canvas = document.createElement("canvas");
  canvas.width = dWidth;
  canvas.height = dHeight;

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
  ctx.fillRect(0, 0, dWidth, dHeight);

  ctx.drawImage(
    image,
    sX,
    sY,
    sWidth,
    sHeight,
    0,
    0,
    dWidth,
    dHeight,
  );

  const dataUrl = canvas.toDataURL("image/png");
  // OCR icin sadece base64 verisi gerekiyorsa ayiralim. 
  // Ama historyde goruntu olarak gostermek icin Data URI daha iyi.
  // Bu fonksiyonu "Data URI" donecek sekilde degistirelim.
  return dataUrl;
};

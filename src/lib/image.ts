import type { Rect } from "../types";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Goruntu okunamadi."));
    image.src = src;
  });

export const cropImageToBase64 = async (imageSrc: string, rect: Rect): Promise<string> => {
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

  // Gri tonlamaya cevir (Grayscale) - Basit bir yontem
  const imageData = ctx.getImageData(0, 0, dWidth, dHeight);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg; // R
    data[i + 1] = avg; // G
    data[i + 2] = avg; // B
  }
  ctx.putImageData(imageData, 0, 0);

  const dataUrl = canvas.toDataURL("image/png");
  // OCR icin sadece base64 verisi gerekiyorsa ayiralim. 
  // Ama historyde goruntu olarak gostermek icin Data URI daha iyi.
  // Bu fonksiyonu "Data URI" donecek sekilde degistirelim.
  return dataUrl;
};

// Prepares a photo for posting, entirely on your device:
// - shrinks it so it uploads quickly and saves data while travelling,
// - turns it the right way up,
// - and re-draws it as a fresh JPEG, which REMOVES hidden details stored in
//   the original file (such as the GPS location where it was taken).

export async function shrinkImage(file: File, maxSize = 1600, quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process this photo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Your browser couldn't process this photo.");
  return { blob, width, height };
}

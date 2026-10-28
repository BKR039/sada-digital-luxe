import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SOURCE_IMAGE = 'C:/Users/LENOVO/.gemini/antigravity-ide/brain/0a498431-76c6-4e93-b54f-d0b328068466/.user_uploaded/media_1791533541371.png';
const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ASSETS_DIR = path.join(ROOT_DIR, 'src', 'assets');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

// Helper to create a Windows ICO binary buffer containing PNG images
function createIcoFromPngs(pngBuffers: { buffer: Buffer; size: number }[]): Buffer {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirTotalSize = headerSize + count * dirEntrySize;

  let currentOffset = dirTotalSize;
  const entries: Buffer[] = [];
  const imageBuffers: Buffer[] = [];

  for (const { buffer, size } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette (0 = no palette)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // image size
    entry.writeUInt32LE(currentOffset, 12); // image offset

    entries.push(entry);
    imageBuffers.push(buffer);
    currentOffset += buffer.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // image type: 1 = ICO
  header.writeUInt16LE(count, 4); // number of images

  return Buffer.concat([header, ...entries, ...imageBuffers]);
}

async function main() {
  console.log('=== GENERATING OFFICIAL SADA BRANDING & FAVICON ASSETS ===');

  if (!fs.existsSync(SOURCE_IMAGE)) {
    throw new Error(`Source master image not found at: ${SOURCE_IMAGE}`);
  }

  // Ensure directories exist
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  // 1. Copy master image to src/assets
  const masterDest = path.join(ASSETS_DIR, 'sada-official-emblem.png');
  fs.copyFileSync(SOURCE_IMAGE, masterDest);
  console.log(`Saved master emblem to: ${masterDest}`);

  // Also save master in public for direct root access
  fs.copyFileSync(SOURCE_IMAGE, path.join(PUBLIC_DIR, 'sada-emblem-1024.png'));

  // 2. Generate PNG favicon variants
  const png16 = await sharp(SOURCE_IMAGE).resize(16, 16, { fit: 'contain' }).png().toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-16x16.png'), png16);
  console.log('Generated public/favicon-16x16.png');

  const png32 = await sharp(SOURCE_IMAGE).resize(32, 32, { fit: 'contain' }).png().toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32x32.png'), png32);
  console.log('Generated public/favicon-32x32.png');

  const png48 = await sharp(SOURCE_IMAGE).resize(48, 48, { fit: 'contain' }).png().toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-48x48.png'), png48);
  console.log('Generated public/favicon-48x48.png');

  // Multi-resolution ICO (16x16, 32x32, 48x48)
  const icoBuffer = createIcoFromPngs([
    { buffer: png16, size: 16 },
    { buffer: png32, size: 32 },
    { buffer: png48, size: 48 },
  ]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  console.log(`Generated public/favicon.ico (${icoBuffer.length} bytes)`);

  // 3. Apple Touch Icon (180x180)
  const appleTouch = await sharp(SOURCE_IMAGE).resize(180, 180, { fit: 'contain' }).png().toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), appleTouch);
  console.log('Generated public/apple-touch-icon.png (180x180)');

  // 4. PWA Icons (192x192, 512x512, maskable)
  const pwa192 = await sharp(SOURCE_IMAGE).resize(192, 192, { fit: 'contain' }).png().toBuffer();
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-192x192.png'), pwa192);
  console.log('Generated public/icons/icon-192x192.png');

  const pwa512 = await sharp(SOURCE_IMAGE).resize(512, 512, { fit: 'contain' }).png().toBuffer();
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-512x512.png'), pwa512);
  console.log('Generated public/icons/icon-512x512.png');

  // Maskable icon with 10% safe margin on dark background #07090E
  const maskableInner = await sharp(SOURCE_IMAGE).resize(410, 410, { fit: 'contain' }).png().toBuffer();
  const maskable512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 7, g: 9, b: 14, alpha: 1 },
    },
  })
    .composite([{ input: maskableInner, top: 51, left: 51 }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(ICONS_DIR, 'maskable-512x512.png'), maskable512);
  console.log('Generated public/icons/maskable-512x512.png');

  // 5. Generate high-fidelity vector favicon.svg that embeds the official SADA emblem
  const base64Png = pwa192.toString('base64');
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <image href="data:image/png;base64,${base64Png}" width="192" height="192" />
</svg>
`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), faviconSvg, 'utf8');
  console.log('Generated public/favicon.svg with official SADA emblem');

  console.log('=== ASSET GENERATION COMPLETE ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

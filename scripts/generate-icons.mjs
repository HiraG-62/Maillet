import sharp from 'sharp';

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
];

for (const { name, size } of sizes) {
  await sharp('public/picture/icon.png')
    .resize(size, size)
    .png()
    .toFile(`public/${name}`);
  console.log(`Generated: public/${name} (${size}x${size})`);
}

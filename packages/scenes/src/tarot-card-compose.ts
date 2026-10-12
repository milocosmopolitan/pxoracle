import * as THREE from "three";
import type { CardLook } from "@pxoracle/contracts";

const images = new THREE.ImageLoader();

/**
 * Layer one card face: matte, art fitted to the frame opening (between enabled banners),
 * banners with their text, then the frame. Parts stay separate assets so decks and cards
 * can swap them without re-exporting artwork.
 */
export async function composeCardFace(look: CardLook): Promise<THREE.Texture> {
  const [art, frame, ...banners] = await Promise.all([
    images.loadAsync(look.art),
    look.frame ? images.loadAsync(look.frame) : Promise.resolve(null),
    ...look.banners.map((b) => images.loadAsync(b.url)),
  ]);
  const [width, height] = look.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Card canvas unavailable");
  let [x, y, w, h] = look.opening;
  ctx.fillStyle = look.matte;
  ctx.fillRect(0, 0, width, height);
  // Art never hides behind a banner: it fills the opening between the enabled slots.
  for (const banner of look.banners) {
    const [, by, , bh] = banner.rect;
    if (banner.slot === "top") {
      h -= by + bh - y;
      y = by + bh;
    } else h = by - y;
  }
  const scale = (look.fit === "cover" ? Math.max : Math.min)(
    w / art.width,
    h / art.height,
  );
  const aw = art.width * scale,
    ah = art.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(art, x + (w - aw) / 2, y + (h - ah) / 2, aw, ah);
  ctx.restore();
  look.banners.forEach((banner, i) => {
    const [bx, by, bw, bh] = banner.rect;
    ctx.save();
    if (banner.slot === "top") {
      ctx.translate(0, by * 2 + bh);
      ctx.scale(1, -1);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(banners[i], bx, by, bw, bh);
    ctx.restore();
    if (!banner.text) return;
    const [tx, ty, tw, th] = banner.textBox;
    let size = Math.round(th * 0.62);
    do ctx.font = `${size--}px Georgia, 'Times New Roman', serif`;
    while (ctx.measureText(banner.text).width > tw && size > 10);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = tx + tw / 2,
      cy = ty + th / 2 + 1;
    if (banner.shadow) {
      ctx.fillStyle = banner.shadow;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]])
        ctx.fillText(banner.text, cx + dx, cy + dy);
    }
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text, cx, cy);
  });
  if (frame) ctx.drawImage(frame, 0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

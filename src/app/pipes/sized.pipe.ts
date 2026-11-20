import { Pipe, PipeTransform } from '@angular/core';

/** Display widths, the same as the app's, so one photo is cached once per size. */
export const IMAGE_WIDTH = { thumb: 400, cover: 800, photo: 1200, full: 1600 } as const;
/** 'avatar': a square crop centred on the face (Cloudinary face detection), for round profile photos. */
export type ImageSize = keyof typeof IMAGE_WIDTH | 'avatar';

/**
 * A Cloudinary photo at a display size: Cloudinary resizes it on the fly (no
 * wider than the width, auto quality, WebP/AVIF where supported), so a story
 * cover is ~100 KB instead of a multi-MB original. Other URLs (Google photos,
 * ones already resized) come back unchanged.
 */
export function cloudinarySized(url: string | null | undefined, size: ImageSize): string {
  if (!url) return '';
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (at < 0 || !url.includes('res.cloudinary.com')) return url;
  const rest = url.slice(at + marker.length);
  if (/^[a-z]{1,3}_[^/]*\//.test(rest)) return url;   // already has a transformation
  const t = size === 'avatar'
    ? 'w_240,h_240,c_fill,g_face,q_auto,f_auto'
    : `w_${IMAGE_WIDTH[size]},c_limit,q_auto,f_auto`;
  return `${url.slice(0, at + marker.length)}${t}/${rest}`;
}

/** `[src]="photo.url | sized:'cover'"` */
@Pipe({ name: 'sized', standalone: false })
export class SizedPipe implements PipeTransform {
  transform(url: string | null | undefined, size: ImageSize = 'cover'): string {
    return cloudinarySized(url, size);
  }
}

import { Pipe, PipeTransform } from '@angular/core';

/**
 * Normalises a person's name to Title Case regardless of how it came
 * from the identity provider (ALL CAPS, all lowercase, camelCase, etc.)
 *
 * Usage: {{ member.name | wlName }}
 */
@Pipe({
  name: 'wlName',
  standalone: false
})
export class WlNamePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

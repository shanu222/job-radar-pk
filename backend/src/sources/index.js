import { remotive, remoteok, arbeitnow, jobicy, himalayas } from './remote.js';
import { reddit } from './reddit.js';
import { jsearch } from './jsearch.js';
import { reliefweb } from './reliefweb.js';
import { pkgov } from './pkgov.js';
import { rss } from './rss.js';

export const ALL_SOURCES = [pkgov, jsearch, reliefweb, remotive, remoteok, arbeitnow, jobicy, himalayas, rss, reddit];

export function activeSources() {
  const disabled = new Set((process.env.DISABLED_SOURCES || '').split(',').map((s) => s.trim()).filter(Boolean));
  return ALL_SOURCES.filter((s) => !disabled.has(s.name) && (!s.enabled || s.enabled()));
}

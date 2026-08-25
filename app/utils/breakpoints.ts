/**
 * The width at which the app stops being a phone: the floating nav pill is
 * replaced by a side rail and the content measure is capped.
 *
 * Written twice on purpose and only twice — here, and as
 * `@media (min-width: 1024px)` in `app/assets/css/main.css`. The rail and the
 * measure are two halves of one layout; change one and you must change the
 * other, so keep them findable by grepping for 1024.
 */
export const DESKTOP = '(min-width: 1024px)'

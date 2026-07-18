/**
 * Device / OS detection helpers.
 *
 * UA sniffing (not media queries) is deliberate here: the question these
 * answer is "can this OS open a signer app installed on the same device",
 * which is an OS property, not a viewport one. `pointer: coarse` would
 * misclassify touch laptops and desktop-mode Android tablets. Both QR and
 * deep-link UIs stay reachable regardless — UA only picks the emphasis.
 */

export const isAndroid = () =>
    typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

export const isMobileUA = () =>
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

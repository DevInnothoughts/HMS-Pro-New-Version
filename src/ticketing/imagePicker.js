/* eslint-disable prettier/prettier */
// imagePicker.js
// ─────────────────────────────────────────────────────────────────────────────
// The mockup's Raise Ticket form has a "Photo / proof" file input. React Native
// has no equivalent built in, and this project does not currently depend on an
// image picker — so this is a shim.
//
// If react-native-image-picker is installed, photos work. If it isn't, the form
// says so plainly and still submits without one. That keeps the whole ticketing
// module shippable today, and turns photos on with one install and a rebuild —
// no code change here or in RaiseTicket.js.
//
// To enable:
//     npm install react-native-image-picker
//     cd ios && pod install          # iOS only
//     # AndroidManifest.xml already needs no extra permission for the gallery
//     # on API 33+; add CAMERA only if you switch to launchCamera below.
//
// The picked photo comes back as a base64 data URL, which is what
// POST /hms/ticketing/tickets accepts today (ticket_attachment.data_url).
// When real file storage arrives, swap `dataUrl` for `storagePath` — the
// column and the API field already exist.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — data_url is a MEDIUMTEXT, not a CDN

let picker;
try {
  // eslint-disable-next-line global-require
  picker = require('react-native-image-picker');
} catch (_) {
  picker = null;
}

/** Is the native module present in this build? */
export function isPhotoPickerAvailable() {
  return !!(picker && typeof picker.launchImageLibrary === 'function');
}

/**
 * Open the gallery and return the chosen photo, or null if the user backed out.
 * @returns {Promise<{fileName, mimeType, fileSize, dataUrl}|null>}
 */
export default async function pickPhoto() {
  if (!isPhotoPickerAvailable()) {
    throw new Error('Photo attachments are not enabled in this build.');
  }

  const res = await picker.launchImageLibrary({
    mediaType: 'photo',
    includeBase64: true,
    // Keep the payload small: it travels as base64 inside the JSON body.
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.7,
    selectionLimit: 1,
  });

  if (res.didCancel) return null;
  if (res.errorCode) {
    throw new Error(res.errorMessage || 'The photo could not be read.');
  }

  const asset = res.assets && res.assets[0];
  if (!asset || !asset.base64) return null;

  if (asset.fileSize && asset.fileSize > MAX_BYTES) {
    throw new Error('That photo is over 2 MB. Try a smaller one.');
  }

  const mimeType = asset.type || 'image/jpeg';
  return {
    fileName: asset.fileName || `photo-${Date.now()}.jpg`,
    mimeType,
    fileSize: asset.fileSize || null,
    dataUrl: `data:${mimeType};base64,${asset.base64}`,
  };
}

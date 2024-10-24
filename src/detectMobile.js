// src/utils/detectMobile.js
export function isMobile() {
  return /Mobi|Android/i.test(navigator.userAgent);
}

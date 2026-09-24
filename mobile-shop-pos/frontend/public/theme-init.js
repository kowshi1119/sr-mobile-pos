// Applies the saved theme before React loads, so light mode does not flash dark first.
// Kept as a file (not inline) because the desktop Content-Security-Policy only allows same-origin scripts.
try {
  var theme = localStorage.getItem('sr-mobile-pos-theme') === 'light' ? 'light' : 'dark';
  document.documentElement.classList.add(theme);
} catch (e) {
  document.documentElement.classList.add('dark');
}

/**
 * Educator navbar: show logged-in educator name and optional avatar.
 * Load only on educator pages. Uses role and userId (educatorId = userId). Redirects if not educator.
 */
(function () {
  function init() {
    try {
      if (localStorage.getItem('role') !== 'educator') {
        window.location.href = 'educator-login.html';
        return;
      }
      var educatorId = localStorage.getItem('userId');
      var educatorName = localStorage.getItem('educatorName');
      var displayName = (educatorName && String(educatorName).trim()) ? educatorName.trim() : 'Educator';

      var nameEl = document.getElementById('navbar-educator-name');
      if (nameEl) nameEl.textContent = displayName;

      var badgeEl = document.getElementById('navbar-role-badge');
      if (badgeEl) badgeEl.textContent = 'Educator';

      if (educatorId) {
        var nav = document.querySelector('nav');
        if (nav) {
          var img = nav.querySelector('img[alt="Profile"], img[alt="Educator"]');
          if (img && typeof img.src === 'string' && img.src.indexOf('dicebear') !== -1) {
            img.alt = displayName;
            img.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(educatorId) + '&backgroundColor=e0e7ff';
          }
        }
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.error) console.error('educator-navbar.js:', e);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

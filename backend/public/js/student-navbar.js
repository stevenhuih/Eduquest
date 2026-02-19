/**
 * Student navbar: show logged-in student name and optional avatar.
 * Load only on student pages. Reads studentId and studentName only.
 * Runs on DOMContentLoaded. Does not redirect.
 */
(function () {
  function init() {
    try {
      var studentId = localStorage.getItem('userId');
      var studentName = localStorage.getItem('studentName');
      var displayName = (studentName && String(studentName).trim()) ? studentName.trim() : 'Student';

      var nameEl = document.getElementById('navbar-student-name');
      if (nameEl) nameEl.textContent = displayName;

      var badgeEl = document.getElementById('navbar-role-badge');
      if (badgeEl) badgeEl.textContent = 'Student';

      if (studentId) {
        var nav = document.querySelector('nav');
        if (nav) {
          var img = nav.querySelector('img[alt="Profile"], img[alt="Student"]');
          if (img && typeof img.src === 'string' && img.src.indexOf('dicebear') !== -1) {
            img.alt = displayName;
            img.src = 'https://api.dicebear.com/7.x/notionists/svg?seed=' + encodeURIComponent(studentId) + '&backgroundColor=e0e7ff';
          }
        }
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.error) console.error('student-navbar.js:', e);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

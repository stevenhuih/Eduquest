/**
 * Unified navbar for EduQuest: educator, student, educator admin.
 * Runs on DOMContentLoaded. Does not redirect; redirect logic stays per-page.
 * Safely skips missing elements.
 */
(function () {
  var ROLE_FALLBACK = {
    educatoradmin: 'Educator Admin',
    educator: 'Educator',
    student: 'Student'
  };

  function getIdentity() {
    var role = localStorage.getItem('role');
    var userId = localStorage.getItem('userId');
    if (!role || !userId) return null;
    if (role === 'educatoradmin') {
      var name = localStorage.getItem('educatoradminName') || localStorage.getItem('centerName') || '';
      return {
        userRole: 'educatoradmin',
        userId: userId,
        userName: (name && String(name).trim()) ? name.trim() : ROLE_FALLBACK.educatoradmin
      };
    }
    if (role === 'educator') {
      var eName = localStorage.getItem('educatorName') || '';
      return {
        userRole: 'educator',
        userId: userId,
        userName: (eName && String(eName).trim()) ? eName.trim() : ROLE_FALLBACK.educator
      };
    }
    if (role === 'student') {
      var sName = localStorage.getItem('studentName') || '';
      return {
        userRole: 'student',
        userId: userId,
        userName: (sName && String(sName).trim()) ? sName.trim() : ROLE_FALLBACK.student
      };
    }
    return null;
  }

  function initNavbar() {
    try {
      var identity = getIdentity();
      var displayName = identity ? identity.userName : '';
      var roleLabel = '';
      if (identity) {
        roleLabel = identity.userRole === 'educatoradmin' ? ROLE_FALLBACK.educatoradmin
          : identity.userRole === 'educator' ? ROLE_FALLBACK.educator
          : ROLE_FALLBACK.student;
      }

      var nameEl = document.getElementById('navbar-user-name');
      if (nameEl) nameEl.textContent = displayName || roleLabel || '';

      var badgeEl = document.getElementById('navbar-role-badge');
      if (badgeEl) badgeEl.textContent = roleLabel;

      if (identity && identity.userId) {
        var nav = document.querySelector('nav');
        if (nav) {
          var img = nav.querySelector('img[alt="Profile"], img[alt="Educator"], img[alt="Educator Admin"], img[alt="Student"]');
          if (img && typeof img.src === 'string' && img.src.indexOf('dicebear') !== -1) {
            img.alt = displayName || roleLabel || 'Profile';
            img.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(identity.userId) + '&backgroundColor=e0e7ff';
          }
        }
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.error) console.error('navbar.js:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
  } else {
    initNavbar();
  }
})();

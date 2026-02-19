/**
 * Auth headers for EduQuest API. Sends exactly one role header based on localStorage.role + localStorage.userId.
 */
function getAuthHeaders() {
  const role = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');

  const headers = {
    'Content-Type': 'application/json'
  };

  if (!role || !userId) {
    return headers;
  }

  if (role === 'student') {
    headers['x-student-id'] = userId;
  }

  if (role === 'educator') {
    headers['x-educator-id'] = userId;
  }

  if (role === 'educatoradmin') {
    headers['x-educatoradmin-id'] = userId;
  }

  if (role === 'platformadmin') {
    headers['x-platformadmin-id'] = userId;
  }

  return headers;
}

/**
 * Fetch helper that always sends auth headers for protected /api routes.
 * @param {string} url - Full URL (e.g. API_BASE + "/educators/admin/1")
 * @param {RequestInit} options - fetch options; headers are merged with getAuthHeaders().
 */
function apiFetch(url, options) {
  options = options || {};
  options.headers = Object.assign({}, getAuthHeaders(), options.headers || {});
  return fetch(url, options);
}

/**
 * Clear stored identity and redirect to the given login page.
 * @param {string} redirectUrl - e.g. 'student-login.html', 'educator-login.html', 'educatoradmin-login.html'
 */
function logout(redirectUrl) {
  localStorage.removeItem('role');
  localStorage.removeItem('userId');
  if (redirectUrl) {
    window.location.href = redirectUrl;
  }
}

/**
 * Fetch wrapper that sends auth headers. Use for all API calls from educator admin / educator / student pages.
 */
function apiFetch(url, options) {
  options = options || {};
  options.headers = Object.assign({}, getAuthHeaders(), options.headers || {});
  return fetch(url, options);
}

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

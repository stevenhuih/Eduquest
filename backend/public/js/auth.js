function requireEducatorAuth() {
  if (localStorage.getItem("role") !== "educator") {
    window.location.href = "educator-login.html";
    return;
  }
  const educatorId = localStorage.getItem("userId");
}

function logoutEducator() {
  localStorage.removeItem("role");
  localStorage.removeItem("userId");
  localStorage.removeItem("educatorName");
  window.location.href = "educator-login.html";
}

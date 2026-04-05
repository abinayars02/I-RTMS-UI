function logout() {
  localStorage.removeItem("token");
  window.location = "login.html";
}

function goSearch() {
  window.location = "search.html";
}

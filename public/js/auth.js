const AUTH_REDIRECT_DELAY_MS = 1200;

function ensureAuthUiStyles() {
  if (document.getElementById("auth-enhancements-style")) return;

  const style = document.createElement("style");
  style.id = "auth-enhancements-style";
  style.textContent = `
    .auth-toast-stack {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 3000;
      pointer-events: none;
    }

    .auth-toast {
      min-width: 280px;
      max-width: 360px;
      padding: 14px 16px;
      border-radius: 14px;
      box-shadow: 0 14px 35px rgba(15, 23, 42, 0.18);
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      pointer-events: auto;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.22s ease, transform 0.22s ease;
    }

    .auth-toast.is-visible {
      opacity: 1;
      transform: translateY(0);
    }

    .auth-toast--success {
      background: linear-gradient(135deg, #166534, #16a34a);
    }

    .auth-toast--error {
      background: linear-gradient(135deg, #991b1b, #dc2626);
    }

    .auth-toast-title {
      display: block;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .auth-password-shell,
    .input-wrapper.auth-password-wrapper {
      position: relative;
    }

    .auth-password-shell input,
    .input-wrapper.auth-password-wrapper input {
      padding-right: 48px;
    }

    .auth-password-toggle {
      position: absolute;
      top: 50%;
      right: 12px;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      border-radius: 999px;
      opacity: 0.8;
    }

    .auth-password-toggle:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.08);
    }

    .auth-password-toggle:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .auth-password-toggle-icon {
      font-size: 16px;
      line-height: 1;
    }

    @media (max-width: 640px) {
      .auth-toast-stack {
        left: 16px;
        right: 16px;
        top: 16px;
      }

      .auth-toast {
        min-width: 0;
        max-width: none;
      }
    }
  `;

  document.head.appendChild(style);
}

function getToastStack() {
  let stack = document.querySelector(".auth-toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "auth-toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

function showToast(message, type = "success", title) {
  ensureAuthUiStyles();
  const stack = getToastStack();
  const toast = document.createElement("div");
  toast.className = `auth-toast auth-toast--${type}`;

  const heading = title || (type === "success" ? "Success" : "Notice");
  toast.innerHTML = `<span class="auth-toast-title">${heading}</span><span>${message}</span>`;
  stack.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 220);
  }, 3200);
}

function setButtonState(button, isBusy, idleLabel, busyLabel) {
  if (!button) return;
  button.disabled = isBusy;
  button.textContent = isBusy ? busyLabel : idleLabel;
  button.style.opacity = isBusy ? "0.8" : "";
  button.style.cursor = isBusy ? "wait" : "";
}

function addPasswordToggle(input) {
  if (!input || input.dataset.passwordEnhanced === "true") return;
  ensureAuthUiStyles();

  let wrapper = input.parentElement;
  if (!wrapper || (!wrapper.classList.contains("input-wrapper") && !wrapper.classList.contains("auth-password-shell"))) {
    wrapper = document.createElement("div");
    wrapper.className = "auth-password-shell";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
  }

  if (wrapper.classList.contains("input-wrapper")) {
    wrapper.classList.add("auth-password-wrapper");
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "auth-password-toggle";
  toggle.setAttribute("aria-label", "Show password");
  toggle.setAttribute("aria-pressed", "false");
  toggle.innerHTML = '<span class="auth-password-toggle-icon" aria-hidden="true">👁</span>';

  toggle.addEventListener("click", function () {
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    toggle.setAttribute("aria-pressed", isHidden ? "true" : "false");
    toggle.title = isHidden ? "Hide Password" : "Show Password";
  });

  toggle.title = "Show Password";
  wrapper.appendChild(toggle);
  input.dataset.passwordEnhanced = "true";
}

function enhancePasswordFields() {
  addPasswordToggle(document.getElementById("password"));
}

function getDisplayName(user, email) {
  if (user && user.name) return user.name;
  if (user && user.email) return user.email;
  return (email || "").split("@")[0] || "User";
}

function redirectWithSuccess(message) {
  showToast(message, "success", "Success");
  window.setTimeout(() => {
    window.location = "search.html";
  }, AUTH_REDIRECT_DELAY_MS);
}

async function register() {
  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const submitButton = document.querySelector('button[onclick="register()"]');
  const name = nameEl ? nameEl.value.trim() : "";
  const email = emailEl ? emailEl.value.trim() : "";
  const password = passwordEl ? passwordEl.value : "";

  if (!name || !email || !password) {
    showToast("Please enter name, email and password.", "error", "Registration failed");
    return;
  }

  const nameRegex = /^[a-zA-Z\s]+$/;
  if (!nameRegex.test(name)) {
    showToast("Name should only contain letters.", "error", "Registration failed");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast("Please enter a valid email address.", "error", "Registration failed");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.", "error", "Registration failed");
    return;
  }

  setButtonState(submitButton, true, "Register", "Creating account...");

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.message || "Registration failed", "error", "Registration failed");
      return;
    }

    const displayName = getDisplayName(data.user, email);
    localStorage.setItem("token", data.token);
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("username", displayName);

    redirectWithSuccess(`Welcome, ${displayName}! Your account has been created successfully and you are now logged in.`);
  } catch (e) {
    console.error(e);
    showToast("Registration error. Is the server running?", "error", "Registration failed");
  } finally {
    setButtonState(submitButton, false, "Register", "Creating account...");
  }
}

async function login() {
  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const submitButton = document.querySelector('#loginForm button[type="submit"]');
  const email = emailEl ? emailEl.value.trim() : "";
  const password = passwordEl ? passwordEl.value : "";

  if (!email || !password) {
    showToast("Please enter email and password.", "error", "Login failed");
    return;
  }

  setButtonState(submitButton, true, "Login", "Signing in...");

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.message || "Login failed", "error", "Login failed");
      return;
    }

    const displayName = getDisplayName(data.user, email);
    localStorage.setItem("token", data.token);
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("username", displayName);
    redirectWithSuccess(`Welcome back, ${displayName}! You have logged in successfully.`);
  } catch (e) {
    console.error(e);
    showToast("Login error. Is the server running?", "error", "Login failed");
  } finally {
    setButtonState(submitButton, false, "Login", "Signing in...");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enhancePasswordFields);
} else {
  enhancePasswordFields();
}

const AUTH_REDIRECT_DELAY_MS = 1200;
let registerVerificationPending = false;

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
  addPasswordToggle(document.getElementById("newPassword"));
  addPasswordToggle(document.getElementById("confirmPassword"));
}

function getDisplayName(user, email) {
  if (user && user.name) return user.name;
  if (user && user.email) return user.email;
  return (email || "").split("@")[0] || "User";
}

function isValidRegisterEmail(email) {
  const registerEmailRegex = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  return registerEmailRegex.test(email);
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
  const otpEl = document.getElementById("registerOtp");
  const otpGroupEl = document.getElementById("registerOtpGroup");
  const helperEl = document.getElementById("registerHelper");
  const submitButton = document.querySelector('#registerForm button[type="submit"]');
  const name = nameEl ? nameEl.value.trim() : "";
  const email = emailEl ? emailEl.value.trim() : "";
  const password = passwordEl ? passwordEl.value : "";
  const otp = otpEl ? otpEl.value.trim() : "";

  if (!name || !email || !password) {
    showToast("Please enter name, email and password.", "error", "Registration failed");
    return;
  }

  const nameRegex = /^[a-zA-Z\s]+$/;
  if (!nameRegex.test(name)) {
    showToast("Name should only contain letters.", "error", "Registration failed");
    return;
  }

  if (!isValidRegisterEmail(email)) {
    showToast("Invalid email address", "error", "Registration failed");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.", "error", "Registration failed");
    return;
  }

  if (!registerVerificationPending) {
    setButtonState(submitButton, true, "Register", "Sending code...");

    try {
      const res = await fetch("/api/auth/register/request-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || "Registration failed", "error", "Registration failed");
        return;
      }

      registerVerificationPending = true;
      if (otpGroupEl) otpGroupEl.hidden = false;
      if (otpEl) otpEl.focus();
      if (helperEl) helperEl.textContent = "A verification code has been sent to your email. Enter it to complete registration.";
      setButtonState(submitButton, false, "Verify & Register", "Sending code...");
      showToast("Verification code sent to your email.", "success", "Verification required");
    } catch (e) {
      console.error(e);
      showToast("Registration error. Is the server running?", "error", "Registration failed");
    } finally {
      if (!registerVerificationPending) {
        setButtonState(submitButton, false, "Register", "Sending code...");
      }
    }
    return;
  }

  if (!otp) {
    showToast("Please enter the verification code sent to your email.", "error", "Registration failed");
    return;
  }

  setButtonState(submitButton, true, "Verify & Register", "Verifying code...");

  try {
    const res = await fetch("/api/auth/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp })
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
    setButtonState(submitButton, false, "Verify & Register", "Verifying code...");
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

async function requestPasswordReset() {
  const emailEl = document.getElementById("email");
  const submitButton = document.querySelector('#forgotPasswordForm button[type="submit"]');
  const helperEl = document.getElementById("forgotPasswordHelper");
  const email = emailEl ? emailEl.value.trim() : "";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    showToast("Please enter your registered email.", "error", "Reset failed");
    return;
  }

  if (!emailRegex.test(email)) {
    showToast("Please enter a valid email address.", "error", "Reset failed");
    return;
  }

  setButtonState(submitButton, true, "Send Reset Link", "Verifying email...");

  try {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.message || "Unable to process password reset.", "error", "Reset failed");
      return;
    }

    if (helperEl) {
      helperEl.textContent = "Email verified. Opening your secure reset form now.";
    }
    showToast("Email verified. Redirecting to the secure password reset form.", "success", "Reset ready");

    window.setTimeout(function () {
      window.location = data.resetUrl || "reset-password.html";
    }, 900);
  } catch (e) {
    console.error(e);
    showToast("Password reset request failed. Is the server running?", "error", "Reset failed");
  } finally {
    setButtonState(submitButton, false, "Send Reset Link", "Verifying email...");
  }
}

async function validateResetLink() {
  const form = document.getElementById("resetPasswordForm");
  if (!form) return true;

  const statusEl = document.getElementById("resetPasswordStatus");
  const params = new URLSearchParams(window.location.search);
  const email = (params.get("email") || "").trim();
  const token = (params.get("token") || "").trim();

  const emailEl = document.getElementById("resetEmail");
  if (emailEl) emailEl.value = email;

  if (!email || !token) {
    if (statusEl) statusEl.textContent = "This reset link is incomplete. Please request a new one.";
    form.classList.add("is-disabled");
    Array.from(form.elements).forEach(function (field) { field.disabled = true; });
    return false;
  }

  try {
    const qs = new URLSearchParams({ email, token });
    const res = await fetch("/api/auth/reset-password/validate?" + qs.toString(), { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (statusEl) statusEl.textContent = data.message || "This reset link is invalid or expired.";
      form.classList.add("is-disabled");
      Array.from(form.elements).forEach(function (field) { field.disabled = true; });
      return false;
    }

    if (statusEl) statusEl.textContent = "Reset link verified. Choose a new password.";
    return true;
  } catch (e) {
    console.error(e);
    if (statusEl) statusEl.textContent = "Unable to verify this reset link right now.";
    form.classList.add("is-disabled");
    Array.from(form.elements).forEach(function (field) { field.disabled = true; });
    return false;
  }
}

async function resetPassword() {
  const params = new URLSearchParams(window.location.search);
  const email = (params.get("email") || "").trim();
  const token = (params.get("token") || "").trim();
  const passwordEl = document.getElementById("newPassword");
  const confirmPasswordEl = document.getElementById("confirmPassword");
  const submitButton = document.querySelector('#resetPasswordForm button[type="submit"]');
  const password = passwordEl ? passwordEl.value : "";
  const confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : "";

  if (!email || !token) {
    showToast("This reset link is incomplete. Please request a new one.", "error", "Reset failed");
    return;
  }

  if (!password || !confirmPassword) {
    showToast("Please enter and confirm your new password.", "error", "Reset failed");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.", "error", "Reset failed");
    return;
  }

  if (password !== confirmPassword) {
    showToast("Passwords do not match.", "error", "Reset failed");
    return;
  }

  setButtonState(submitButton, true, "Reset Password", "Saving password...");

  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, password, confirmPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.message || "Unable to reset password.", "error", "Reset failed");
      return;
    }

    showToast("Your password has been updated. Please log in with your new password.", "success", "Password reset");
    window.setTimeout(function () {
      window.location = "login.html";
    }, AUTH_REDIRECT_DELAY_MS);
  } catch (e) {
    console.error(e);
    showToast("Password reset failed. Is the server running?", "error", "Reset failed");
  } finally {
    setButtonState(submitButton, false, "Reset Password", "Saving password...");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enhancePasswordFields);
} else {
  enhancePasswordFields();
}

document.addEventListener("DOMContentLoaded", function () {
  const registerForm = document.getElementById("registerForm");
  if (!registerForm) return;

  ["name", "email", "password"].forEach(function (id) {
    const field = document.getElementById(id);
    if (!field) return;

    field.addEventListener("input", function () {
      registerVerificationPending = false;

      const otpGroupEl = document.getElementById("registerOtpGroup");
      const otpEl = document.getElementById("registerOtp");
      const helperEl = document.getElementById("registerHelper");
      const submitButton = document.querySelector('#registerForm button[type="submit"]');

      if (otpGroupEl) otpGroupEl.hidden = true;
      if (otpEl) otpEl.value = "";
      if (helperEl) helperEl.textContent = "";
      setButtonState(submitButton, false, "Register", "Verifying code...");
    });
  });
});

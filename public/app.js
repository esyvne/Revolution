const apiBase = document.querySelector('meta[name="api-base"]')?.content || "";
const form = document.getElementById("login-form");
const error = document.getElementById("login-error");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.classList.remove("is-visible");
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch(`${apiBase}/api/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value,
      }),
    });
    if (!response.ok) throw new Error("invalid_credentials");
    location.href = "dashboard.html";
  } catch (_) {
    error.classList.add("is-visible");
    button.disabled = false;
  }
});

const apiBase = document.querySelector('meta[name="api-base"]')?.content || "";

async function guard() {
  const response = await fetch(`${apiBase}/api/me`, { credentials: "include" });
  if (!response.ok) return location.replace("index.html");
  const user = await response.json();
  document.querySelector("[data-username]").textContent = user.username;
}

document
  .querySelector("[data-logout]")
  ?.addEventListener("click", async (event) => {
    event.preventDefault();
    await fetch(`${apiBase}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
    location.replace("index.html");
  });

guard();

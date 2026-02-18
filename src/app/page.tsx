"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Demo credentials (change later)
    if (username === "admin" && password === "1234") {
      localStorage.setItem("auth", "true");
      router.push("/home");
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md dark:bg-zinc-900"
      >
        <h1 className="mb-6 text-2xl font-semibold text-black dark:text-white">
          Login
        </h1>

        {error && (
          <p className="mb-4 text-sm text-red-500">{error}</p>
        )}

        <input
          type="text"
          placeholder="Username"
          className="mb-4 w-full rounded-md border px-4 py-2 dark:bg-black dark:text-white"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-6 w-full rounded-md border px-4 py-2 dark:bg-black dark:text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full rounded-full bg-black py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black"
        >
          Login
        </button>
      </form>
    </div>
  );
}

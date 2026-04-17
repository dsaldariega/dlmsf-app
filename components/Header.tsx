"use client";

import LogoutButton from "./LogoutButton";

export default function Header() {
  return (
    <header className="w-full bg-white shadow-md px-6 py-4 flex justify-end items-center">
      <LogoutButton />
    </header>
  );
}

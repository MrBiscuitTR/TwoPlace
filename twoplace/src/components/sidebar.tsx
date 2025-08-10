"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";

// sidebar.tsc component
export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/friends", label: "Friends" },
    { href: "/search", label: "Search" },
    { href: "/calls", label: "Calls" },
    { href: "/settings", label: "Settings" },
    { href: "/about", label: "About" },
  ];
  const handleLogout = async () => {
    try {
      await auth.signOut();
      // İstersen burada yönlendirme de yapabilirsin, örn:
      // window.location.href = "/login";
    } catch (error) {
      console.error("Çıkış yaparken hata:", error);
    }
  };
  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">TwoPlace</h2>
      <nav className="sidebar-nav">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-link ${pathname === href ? "active" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <button className="logout-button" onClick={handleLogout}>
        Çıkış Yap
      </button>
    </aside>
  );
}

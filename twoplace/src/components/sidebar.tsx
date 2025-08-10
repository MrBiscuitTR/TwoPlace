"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";

import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import CallIcon from '@mui/icons-material/Call';

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", Icon: HomeIcon },
    { href: "/friends", label: "Friends", Icon: PeopleIcon },
    { href: "/search", label: "Search", Icon: SearchIcon },
    { href: "/calls", label: "Calls", Icon: CallIcon },
    { href: "/settings", label: "Settings", Icon: SettingsIcon },
    { href: "/about", label: "About", Icon: InfoIcon },
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
        {links.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-link ${pathname === href ? "active" : ""}`}
          >
            <Icon style={{ verticalAlign: 'middle' 
              // media query: if not mobile, margin right 8

            }} />
            <span style={{ verticalAlign: 'middle' , alignItems:"center"}}>&nbsp;&nbsp;{label}</span>
          </Link>
        ))}
      </nav>
      <button className="logout-button" onClick={handleLogout}>
        Çıkış Yap
      </button>
    </aside>
  );
}

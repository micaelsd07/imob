import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/painel" className="brand">Fabelle <span>Tour 3D</span></Link>
        <nav className="topnav">
          <NavLink to="/painel" end>Imóveis</NavLink>
          <NavLink to="/painel/guia">Guia de fotos</NavLink>
        </nav>
        <div className="topbar-user">
          <div className="avatar">{user?.name?.[0] ?? '?'}</div>
          <div className="topbar-user-info">
            <b>{user?.name}</b>
            <small>{user?.agency}</small>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sair</button>
        </div>
      </header>
      <main className="container">{children}</main>
    </div>
  );
}

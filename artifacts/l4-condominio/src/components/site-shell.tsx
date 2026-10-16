import { Link, useLocation } from 'wouter';
import { ArrowRight, LogIn, Menu, PackageCheck, ShoppingBag, Store, UserRound, X, ListChecks } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useUser, UserButton } from '@clerk/react';
const navItems = [
  { href: '/', label: 'Mercado', icon: ShoppingBag },
  { href: '/orders', label: 'Mis pedidos', icon: PackageCheck },
  { href: '/seller', label: 'Mi tienda', icon: Store },
  { href: '/seller/listings', label: 'Mis avisos', icon: ListChecks },
  { href: '/profile', label: 'Mi perfil', icon: UserRound },
];
const logoAsset = `${import.meta.env.BASE_URL}laureles-logo.png`;

      export function SiteShell({ children }: { children: ReactNode }) {
        const [location] = useLocation();
        const [menuOpen, setMenuOpen] = useState(false);
        const { isSignedIn, isLoaded } = useUser();

        return (
          <div className="l4-shell l4-grain min-h-[100dvh] text-foreground">
            <div className="border-b border-white/10 bg-[#2d4a67] text-center text-xs font-medium tracking-wide text-white/90">
              Hecho por vecinos. Solo para residentes de Laureles 4.
            </div>
            <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
              <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-5 px-5 py-3.5 md:px-9">
                <Link href="/" className="flex shrink-0 items-center gap-3" data-testid="link-brand-home">
                  <img src={logoAsset} className="h-12 w-12 rounded-xl object-cover object-top shadow-sm" alt="Los Laureles Condominio de Departamentos, Cuarta Etapa" data-testid="img-l4-logo" />
                  <span className="hidden text-sm font-semibold leading-tight text-[#29445f] sm:block">Laureles 4<span className="block pt-0.5 text-[11px] font-normal tracking-wide text-muted-foreground">Mercado del vecindario</span></span>
                </Link>
                <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
                  {navItems.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${location === href ? 'bg-[#eaf4df] font-semibold text-[#2d4a67]' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
                      <Icon size={16} strokeWidth={1.8} />
                      {label}
                    </Link>
                  ))}
                </nav>

                {/* Sección dinámica de autenticación y botón de cerrar sesión */}
                <div className="hidden items-center gap-3 sm:flex">
                  {isLoaded && isSignedIn ? (
                    <div className="flex items-center gap-3" data-testid="container-user-logged-in">
                      <UserButton/>
                    </div>
                  ) : (
                    <>
                      <Link href="/sign-in" className="rounded-full px-4 py-2 text-sm font-medium text-foreground hover:bg-muted" data-testid="link-sign-in">
                        <LogIn size={16} className="mr-1.5 inline" />Ingresar
                      </Link>
                      <Link href="/register" className="rounded-full bg-[#a2d64b] px-5 py-2.5 text-sm font-bold text-[#243c54] shadow-sm transition-transform hover:-translate-y-0.5" data-testid="link-join">
                        Unirme a la comunidad <ArrowRight size={15} className="ml-1 inline" />
                      </Link>
                    </>
                  )}
                </div>

                <button className="rounded-xl p-2 text-foreground lg:hidden" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)} data-testid="button-mobile-menu">
                  {menuOpen ? <X size={21} /> : <Menu size={21} />}
                </button>
              </div>
              {menuOpen && <nav className="grid gap-1 border-t border-border px-5 py-3 lg:hidden" aria-label="Navegación móvil">
                {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted" data-testid={`link-mobile-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} />{label}</Link>)}
                {!isSignedIn ? (
                  <Link href="/register" onClick={() => setMenuOpen(false)} className="mt-1 rounded-xl bg-[#a2d64b] px-4 py-3 text-center text-sm font-bold text-[#243c54]" data-testid="link-mobile-join">Unirme a la comunidad</Link>
                ) : null}
              </nav>}
            </header>
      <main>{children}</main>
      <footer className="mt-20 border-t border-border/70 bg-[#2d4a67] text-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between md:px-9">
          <div className="flex items-center gap-3">
            <img src={logoAsset} alt="" className="h-11 w-11 rounded-lg object-cover object-top" />
            <div><p className="font-semibold">Lo bueno se queda cerca.</p><p className="mt-1 text-xs text-white/65">Un pequeño mercado para Laureles 4.</p></div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
            <Link href="/" data-testid="link-footer-market">Mercado</Link>
            <Link href="/orders" data-testid="link-footer-orders">Pedidos</Link>
            <Link href="/register" data-testid="link-footer-register">Vender en el vecindario</Link>
            <Link href="/admin" data-testid="link-footer-admin">Administración</Link>
          </div>
          <p className="text-xs text-white/55">Una comunidad privada para compartir con cuidado.</p>
        </div>
      </footer>
    </div>
  );
}

export function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="mb-8 max-w-2xl"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#567843]" data-testid="text-page-eyebrow">{eyebrow}</p><h1 className="text-4xl font-semibold leading-[1.08] text-[#29445f] sm:text-5xl" data-testid="text-page-title">{title}</h1><p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground" data-testid="text-page-subtitle">{subtitle}</p></div>;
}

export function StatePanel({ title, detail, retry }: { title: string; detail: string; retry?: () => void }) {
  return <div className="rounded-3xl border border-border bg-card px-7 py-12 text-center" data-testid="panel-state"><div className="mx-auto mb-4 h-2 w-16 rounded-full bg-[#a2d64b]" /><h2 className="text-2xl font-semibold text-[#29445f]" data-testid="text-state-title">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground" data-testid="text-state-detail">{detail}</p>{retry && <button onClick={retry} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground" data-testid="button-retry">Intentar de nuevo</button>}</div>;
}


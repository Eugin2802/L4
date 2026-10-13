import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

const logoAsset = `${import.meta.env.BASE_URL}laureles-logo.png`;

export default function NotFound() {
  return (
    <main className="l4-shell l4-grain flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <section className="w-full max-w-xl rounded-[2rem] border border-border bg-card p-8 text-center sm:p-12">
        <img src={logoAsset} alt="Logo de Laureles 4" className="mx-auto h-16 w-16 rounded-2xl object-cover object-top" />
        <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#57763d]">Te saliste del camino</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold text-[#29445f]">Esta página no existe.</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">El aviso que buscas quizá ya no esté aquí. Vuelve al mercado del vecindario y mira qué encuentras.</p>
        <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#2d4a67] px-5 py-3 text-sm font-bold text-white" data-testid="link-not-found-home"><ArrowLeft size={16} />Volver al mercado</Link>
      </section>
    </main>
  );
}

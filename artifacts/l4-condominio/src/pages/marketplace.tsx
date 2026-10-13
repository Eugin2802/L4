import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Copy, Heart, MessageCircle, Minus, Plus, Search, ShieldCheck, ShoppingBag, Star, X } from 'lucide-react';
import { useCreateOrder, useCreateReport, useListCategories, useListFavorites, useListProductReviews, useListProducts, useToggleFavorite } from '@workspace/api-client-react';
import type { Product, Review } from '@workspace/api-client-react';
import { ListProductsSort } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { PageHeading, SiteShell, StatePanel } from '@/components/site-shell';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 }).format(value);
const logoAsset = `${import.meta.env.BASE_URL}laureles-logo.png`;

export default function Marketplace() {
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState<ListProductsSort>('featured');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Product | null>(null);
  const [report, setReport] = useState<Product | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [cart, setCart] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [buyer, setBuyer] = useState({ name: '', phone: '', tower: '', apartment: '', desiredDate: '', desiredTime: '' });
  const [paymentConsent, setPaymentConsent] = useState(false);
  const [paymentRevealed, setPaymentRevealed] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();
  const productsQuery = useListProducts({ ...(categoryId ? { categoryId } : {}), sort });
  const categoriesQuery = useListCategories();
  const favoritesQuery = useListFavorites();
  const toggleFavorite = useToggleFavorite();
  const createOrder = useCreateOrder();
  const createReport = useCreateReport();
  const products = useMemo(() => (productsQuery.data ?? []).filter((p) => `${p.title} ${p.description} ${p.shopName}`.toLowerCase().includes(search.toLowerCase())), [productsQuery.data, search]);
  const featured = products.filter((p) => p.featured);
  const remainder = products.filter((p) => !p.featured);
  const favorites = new Set((favoritesQuery.data ?? []).map((p) => p.id));
  const cartTotal = cart.reduce((sum, item) => sum + item.price * (quantities[item.id] ?? 1), 0);
  const whatsappOrderMessage = cart.length
    ? [
      `Hola ${cart[0].sellerName}, quiero coordinar este pedido de L4:`,
      ...cart.map((item) => `• ${quantities[item.id] ?? 1} × ${item.title}`),
      `Total: ${money(cartTotal)}`,
      `Nombre: ${buyer.name || 'Por confirmar'}`,
      `Teléfono: ${buyer.phone || 'Por confirmar'}`,
      `Torre y departamento: ${buyer.tower || '—'} · ${buyer.apartment || '—'}`,
      buyer.desiredDate ? `Entrega solicitada: ${buyer.desiredDate}${buyer.desiredTime ? ` a las ${buyer.desiredTime}` : ''}` : '',
      'Te enviaré aquí el comprobante de pago de Yape o Plin.',
    ].filter((line) => line.length > 0).join('\n')
    : '';
  const sellerWhatsAppUrl = cart[0]?.sellerPhone
    ? buildWhatsAppUrl(cart[0].sellerPhone, whatsappOrderMessage)
    : null;
  const toggle = (product: Product) => toggleFavorite.mutate({ data: { productId: product.id } }, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/favorites'] }),
    onError: () => setNotice('Inicia sesión para guardar tus favoritos.'),
  });
  const addToBag = (product: Product) => {
    if (cart.length && cart[0].sellerId !== product.sellerId) {
      setNotice('Cada pedido es para un solo vendedor. Finaliza esta compra antes de elegir productos de otro vecino.');
      window.setTimeout(() => setNotice(''), 3200);
      return;
    }
    if (cart.some((item) => item.id === product.id)) {
      setQuantities((current) => ({ ...current, [product.id]: (current[product.id] ?? 1) + 1 }));
    } else {
      setCart([...cart, product]);
      setQuantities((current) => ({ ...current, [product.id]: 1 }));
    }
    setNotice(`${product.title} agregado a tu bolsa`);
    window.setTimeout(() => setNotice(''), 2600);
  };
  const changeQuantity = (productId: string, delta: number) => {
    const next = (quantities[productId] ?? 1) + delta;
    if (next <= 0) {
      setCart((current) => current.filter((item) => item.id !== productId));
      setQuantities((current) => {
        const updated = { ...current };
        delete updated[productId];
        return updated;
      });
      return;
    }
    setQuantities((current) => ({ ...current, [productId]: next }));
  };
  const copySellerPhone = async () => {
    const sellerPhone = cart[0]?.sellerPhone;
    if (!sellerPhone) return;
    try {
      await navigator.clipboard.writeText(sellerPhone);
      setCopyStatus('Número copiado');
    } catch {
      setCopyStatus('No se pudo copiar; puedes seleccionar el número para copiarlo.');
    }
  };
  const buyNow = () => {
    if (!cart.length) return;
    const desiredAt = buyer.desiredDate && buyer.desiredTime
      ? new Date(`${buyer.desiredDate}T${buyer.desiredTime}`).toISOString()
      : null;
    createOrder.mutate({ data: { sellerId: cart[0].sellerId, buyerName: buyer.name, phone: buyer.phone, tower: buyer.tower, apartment: buyer.apartment, desiredAt, paymentProofUrl: null, items: cart.map((item) => ({ productId: item.id, quantity: quantities[item.id] ?? 1 })) } }, {
      onSuccess: () => {
        setCart([]);
        setQuantities({});
        setCheckoutOpen(false);
        setNotice('Pedido enviado. Si aún no lo hiciste, coordina el pago y el comprobante por WhatsApp.');
        queryClient.invalidateQueries({ queryKey: ['/api/l4/orders'] });
      },
      onError: () => setNotice('No pudimos registrar tu pedido. Inicia sesión e inténtalo de nuevo.'),
    });
  };
  const submitReport = () => {
    if (!report || reportReason.trim().length < 5) return;
    createReport.mutate({ data: { targetType: 'product', targetId: report.id, reason: reportReason.trim() } }, { onSuccess: () => { setReport(null); setReportReason(''); setNotice('Gracias. Enviamos el reporte al equipo de la comunidad.'); }, onError: () => setNotice('No pudimos enviar el reporte. Inicia sesión e inténtalo de nuevo.') });
  };
  const featuredProduct = featured[0];
  return <SiteShell>
    <section className="mx-auto max-w-[1320px] px-5 pb-12 pt-8 md:px-9 md:pt-12">
      <div className="overflow-hidden rounded-[2rem] bg-[#2d4a67] text-white shadow-[0_24px_70px_-34px_rgba(35,60,84,.55)]">
        <div className="grid min-h-[350px] items-center md:grid-cols-[1.06fr_.94fr]">
          <div className="relative z-10 px-7 py-10 md:px-14 md:py-14">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90"><span className="h-2 w-2 rounded-full bg-[#a2d64b]" /> A tus vecinos les gusta compartir</div>
            <h1 className="max-w-xl text-5xl font-semibold leading-[.98] tracking-tight text-white sm:text-6xl md:text-7xl">Encuentra algo<br /><span className="text-[#b5e36e]">para quedarte.</span></h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/75 sm:text-base">Un mercado pequeño y cercano para quienes viven aquí. Descubre, comparte y compra dentro de Laureles 4.</p>
            <a href="#discover" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#a2d64b] px-5 py-3 text-sm font-bold text-[#243c54] transition-transform hover:-translate-y-0.5" data-testid="link-explore-market">Explorar el mercado <ArrowRight size={16} /></a>
          </div>
          <div className="relative min-h-[250px] overflow-hidden md:h-full">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_46%,rgba(162,214,75,.44),transparent_37%),linear-gradient(135deg,rgba(255,255,255,.08),transparent_52%)]" />
            <div className="absolute -right-4 top-1/2 h-72 w-72 -translate-y-1/2 rotate-12 rounded-[5rem] border border-white/15 md:right-12" />
            <div className="absolute right-10 top-1/2 flex h-56 w-56 -translate-y-1/2 rotate-[-8deg] items-center justify-center rounded-[3.5rem] bg-[#d5edaf] text-[#2d4a67] shadow-2xl md:right-28">
              <div className="rotate-[8deg] text-center"><img src={logoAsset} className="mx-auto mb-3 h-24 w-24 rounded-2xl object-cover object-top" alt="" /><p className="font-serif text-3xl font-semibold">Cerca de ti.<br />Como debe ser.</p></div>
            </div>
            <div className="absolute bottom-7 left-5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur"><p className="font-serif text-2xl">01</p><p className="text-[10px] uppercase tracking-[.18em] text-white/65">La comunidad primero</p></div>
          </div>
        </div>
      </div>
      <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[{ icon: ShieldCheck, title: 'Solo entre vecinos', note: 'Una comunidad privada, no todo internet.' }, { icon: Heart, title: 'Compra con confianza', note: 'Cada compra se queda cerca de casa.' }, { icon: ShoppingBag, title: 'Entrega sencilla', note: 'Coordina una entrega dentro del conjunto.' }].map(({ icon: Icon, title, note }, i) => <div key={title} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/75 p-4" data-testid={`feature-promise-${i}`}><span className="rounded-xl bg-[#eaf4df] p-2.5 text-[#52743a]"><Icon size={19} /></span><div><p className="text-sm font-semibold text-[#29445f]">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p></div></div>)}
      </div>
    </section>
    <section id="discover" className="mx-auto max-w-[1320px] px-5 pb-16 md:px-9">
      <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <PageHeading eyebrow="Selección del vecindario" title="Lo que buscas está más cerca." subtitle="Descubre lo que tus vecinos comparten esta semana." />
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <label className="relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en el mercado" className="w-full rounded-full border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#84b63b] sm:w-52" data-testid="input-market-search" /></label>
          <select value={sort} onChange={(e) => setSort(e.target.value as ListProductsSort)} className="rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none" aria-label="Ordenar productos" data-testid="select-product-sort"><option value="featured">Destacados</option><option value="rating">Mejor calificados</option><option value="newest">Más recientes</option></select>
          <button onClick={() => { setCheckoutOpen(true); setPaymentConsent(false); setPaymentRevealed(false); }} className="relative flex items-center gap-2 rounded-full bg-[#2d4a67] px-4 py-2.5 text-sm font-semibold text-white" data-testid="button-open-cart"><ShoppingBag size={16} /> Bolsa <span className="rounded-full bg-[#a2d64b] px-1.5 text-xs font-bold text-[#243c54]" data-testid="text-cart-count">{cart.reduce((sum, item) => sum + (quantities[item.id] ?? 1), 0)}</span></button>
        </div>
      </div>
      <div className="mb-7 flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setCategoryId('')} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${categoryId === '' ? 'bg-[#2d4a67] text-white' : 'border border-border bg-card text-muted-foreground'}`} data-testid="button-category-all">Todas</button>
        {(categoriesQuery.data ?? []).map((category) => <button key={category.id} onClick={() => setCategoryId(category.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${categoryId === category.id ? 'bg-[#2d4a67] text-white' : 'border border-border bg-card text-muted-foreground'}`} data-testid={`button-category-${category.id}`}>{category.name}</button>)}
      </div>
      {productsQuery.isLoading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="animate-pulse rounded-3xl bg-card"><div className="aspect-[4/3] rounded-3xl bg-muted" /><div className="space-y-3 p-4"><div className="h-4 w-2/3 rounded bg-muted" /><div className="h-3 w-1/2 rounded bg-muted" /></div></div>)}</div> :
       productsQuery.isError ? <StatePanel title="El mercado está tomando un respiro." detail="No pudimos cargar los avisos. Inténtalo de nuevo." retry={() => productsQuery.refetch()} /> :
       products.length === 0 ? <StatePanel title="Todavía no hay avisos." detail="Prueba otra categoría o vuelve pronto. Tus vecinos quizá estén publicando algo." /> :
      <div className="space-y-10">
        {featuredProduct && !categoryId && !search && <section className="grid overflow-hidden rounded-[1.75rem] border border-[#dce8cc] bg-[#edf5e4] md:grid-cols-[.9fr_1.1fr]" data-testid={`feature-featured-${featuredProduct.id}`}>
           <div className="flex flex-col justify-center px-7 py-8 md:px-10"><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#57763d]"><Star size={14} fill="currentColor" /> Recomendado por tus vecinos</div><h2 className="text-4xl font-semibold text-[#29445f]">{featuredProduct.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-6 text-[#596a5a]">{featuredProduct.description || `Un gran hallazgo de ${featuredProduct.shopName}.`}</p><div className="mt-5 flex items-center gap-4"><span className="font-serif text-2xl font-semibold text-[#29445f]">{money(featuredProduct.price)}</span><button onClick={() => setDetail(featuredProduct)} className="rounded-full bg-[#2d4a67] px-5 py-2.5 text-sm font-semibold text-white" data-testid={`button-view-${featuredProduct.id}`}>Ver detalles</button></div></div>
          <ProductArtwork product={featuredProduct} className="min-h-[260px] md:min-h-[330px]" />
        </section>}
         {featured.length > 0 && !categoryId && !search && <div><h2 className="mb-4 font-serif text-2xl font-semibold text-[#29445f]">Selección de la comunidad</h2><div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{featured.map((product) => <ProductCard key={product.id} product={product} isFavorite={favorites.has(product.id)} onFavorite={toggle} onView={setDetail} onAdd={addToBag} />)}</div></div>}
         <div><div className="mb-4 flex items-end justify-between"><h2 className="font-serif text-2xl font-semibold text-[#29445f]">{categoryId || search ? 'Resultados' : 'Más cosas de aquí'}</h2><span className="text-xs text-muted-foreground" data-testid="text-listing-count">{(categoryId || search ? products : remainder).length} avisos</span></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{(categoryId || search ? products : remainder).map((product) => <ProductCard key={product.id} product={product} isFavorite={favorites.has(product.id)} onFavorite={toggle} onView={setDetail} onAdd={addToBag} />)}</div></div>
      </div>}
      <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-[1.75rem] bg-[#2d4a67] px-7 py-8 text-white sm:flex-row sm:items-center md:px-10">
         <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#b5e36e]">¿Un emprendimiento?</p><h2 className="mt-2 font-serif text-3xl">A tus vecinos les encantará conocerlo.</h2><p className="mt-2 text-sm text-white/70">Abre tu tienda y comparte con Laureles 4.</p></div>
         <Link href="/register" className="shrink-0 rounded-full bg-[#a2d64b] px-5 py-3 text-sm font-bold text-[#243c54]" data-testid="link-start-selling">Empieza a vender <ArrowRight className="ml-1 inline" size={15} /></Link>
      </div>
    </section>
    {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#29445f] px-5 py-3 text-sm font-medium text-white shadow-xl" role="status" data-testid="status-market-notice">{notice}</div>}
    {detail && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#172636]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={detail.title} data-testid="dialog-product-detail"><div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] bg-background shadow-2xl sm:rounded-[2rem]"><button onClick={() => setDetail(null)} className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-[#29445f]" aria-label="Cerrar detalles" data-testid="button-close-details"><X size={18} /></button><div className="grid sm:grid-cols-2"><ProductArtwork product={detail} className="min-h-[260px] sm:min-h-[420px]" /><div className="p-7 sm:p-9"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#57763d]">{detail.categoryName}</p><h2 className="mt-2 text-4xl font-semibold text-[#29445f]" data-testid={`text-detail-title-${detail.id}`}>{detail.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{detail.description || 'Un buen hallazgo compartido por uno de tus vecinos.'}</p><div className="mt-5 flex items-center gap-2 text-sm text-amber-600"><Star size={16} fill="currentColor" /> {detail.averageRating.toFixed(1)} <span className="text-muted-foreground">({detail.reviewCount} opiniones)</span></div><p className="mt-6 font-serif text-3xl font-semibold text-[#29445f]">{money(detail.price)}</p><p className="mt-1 text-sm text-muted-foreground">De {detail.shopName || detail.sellerName}</p><button onClick={() => { addToBag(detail); setDetail(null); }} className="mt-6 w-full rounded-full bg-[#2d4a67] px-5 py-3 text-sm font-bold text-white" data-testid={`button-add-${detail.id}`}>Agregar a la bolsa</button><button onClick={() => setReport(detail)} className="mt-3 w-full rounded-full border border-border px-5 py-3 text-sm font-medium text-muted-foreground hover:text-destructive" data-testid={`button-report-${detail.id}`}>Reportar este aviso</button><ProductComments productId={detail.id} /></div></div></div></div>}
    {report && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#172636]/60 p-4" role="dialog" aria-modal="true" aria-label="Reportar aviso" data-testid="dialog-report"><div className="w-full max-w-md rounded-3xl bg-background p-6"><h2 className="font-serif text-2xl font-semibold text-[#29445f]">Cuéntanos qué ocurre.</h2><p className="mt-2 text-sm text-muted-foreground">El equipo de la comunidad revisará tu reporte de forma privada.</p><textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="mt-5 min-h-28 w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-[#84b63b]" placeholder="Cuéntanos un poco más (mínimo 5 caracteres)" data-testid="input-report-reason" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setReport(null)} className="rounded-full px-4 py-2 text-sm" data-testid="button-cancel-report">Cancelar</button><button onClick={submitReport} disabled={reportReason.trim().length < 5 || createReport.isPending} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" data-testid="button-submit-report">{createReport.isPending ? 'Enviando…' : 'Enviar reporte'}</button></div></div></div>}
    {checkoutOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#172636]/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Finalizar pedido" data-testid="dialog-checkout">
      <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-background p-6 sm:rounded-[2rem] sm:p-8">
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#57763d]">Compra entre vecinos</p><h2 className="mt-1 font-serif text-3xl font-semibold text-[#29445f]">Tu pedido</h2></div>
          <button onClick={() => setCheckoutOpen(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Cerrar compra" data-testid="button-close-checkout"><X size={18} /></button>
        </div>
        {cart.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground" data-testid="text-cart-empty">Tu bolsa espera su primer hallazgo.</p> : <>
          <div className="my-5 max-h-44 space-y-2 overflow-auto">{cart.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/70 px-3 py-2.5 text-sm" data-testid={`row-cart-${item.id}`}>
            <span className="min-w-0 flex-1 font-medium">{item.title}</span>
            <div className="flex items-center gap-2"><button onClick={() => changeQuantity(item.id, -1)} className="rounded-full bg-background p-1.5" aria-label={`Quitar una unidad de ${item.title}`} data-testid={`button-quantity-minus-${item.id}`}><Minus size={14} /></button><span className="min-w-5 text-center" data-testid={`text-quantity-${item.id}`}>{quantities[item.id] ?? 1}</span><button onClick={() => changeQuantity(item.id, 1)} className="rounded-full bg-background p-1.5" aria-label={`Agregar una unidad de ${item.title}`} data-testid={`button-quantity-plus-${item.id}`}><Plus size={14} /></button></div>
            <span className="w-24 text-right font-semibold">{money(item.price * (quantities[item.id] ?? 1))}</span>
          </div>)}</div>
          <div className="mb-5 flex justify-between border-t border-border pt-4 font-semibold"><span>Total</span><span>{money(cart.reduce((sum, item) => sum + item.price * (quantities[item.id] ?? 1), 0))}</span></div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-[#29445f]">Pago por Yape o Plin</p>
            {!paymentRevealed ? <>
              <label className="mt-3 flex items-start gap-3 text-xs leading-5 text-muted-foreground"><input type="checkbox" checked={paymentConsent} onChange={(event) => setPaymentConsent(event.target.checked)} className="mt-0.5 accent-[#6f9f38]" data-testid="input-confirm-seller-phone" /><span>Confirmo que quiero ver el teléfono del vendedor para coordinar el pago por Yape o Plin.</span></label>
              <button onClick={() => { setPaymentRevealed(true); setCopyStatus(''); }} disabled={!paymentConsent} className="mt-3 rounded-full bg-[#2d4a67] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-45" data-testid="button-reveal-payment">Confirmar y ver datos de pago</button>
            </> : <div className="mt-3 rounded-xl bg-[#eaf4df] p-3" data-testid="panel-seller-payment">
              <p className="text-xs font-semibold text-[#29445f]">Coordina el pago por Yape o Plin y envía el comprobante al vendedor por WhatsApp:</p>
              {cart[0].sellerPhone ? <div className="mt-2 flex flex-wrap items-center gap-2">{sellerWhatsAppUrl ? <a href={sellerWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-lg font-bold text-[#29445f] underline decoration-[#8ca777] underline-offset-4" data-testid="link-seller-whatsapp-phone">{cart[0].sellerPhone}</a> : <span className="font-mono text-lg font-bold text-[#29445f]" data-testid="text-seller-phone">{cart[0].sellerPhone}</span>}<button onClick={copySellerPhone} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#29445f]" data-testid="button-copy-seller-phone"><Copy size={13} />Copiar</button>{sellerWhatsAppUrl && <a href={sellerWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#29445f]" data-testid="link-seller-whatsapp"><MessageCircle size={14} />Escribir por WhatsApp</a>}</div> : <p className="mt-2 text-sm text-[#8a4b2b]" data-testid="text-seller-phone-unavailable">El vendedor aún no ha registrado un número válido de WhatsApp. Coordina directamente antes de pagar.</p>}
              {cart[0].sellerPhone && !sellerWhatsAppUrl && <p className="mt-2 text-xs text-[#8a4b2b]" role="alert">El número del vendedor no tiene un formato válido para abrir WhatsApp.</p>}
              {copyStatus && <p className="mt-2 text-xs text-[#52743a]" role="status" data-testid="status-copy-phone">{copyStatus}</p>}
            </div>}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#29445f]">Tu nombre<input required value={buyer.name} onChange={(event) => setBuyer({ ...buyer, name: event.target.value })} placeholder="Nombre y apellido" className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal" data-testid="input-buyer-name" /></label>
            <label className="text-xs font-semibold text-[#29445f]">Tu teléfono<input required type="tel" value={buyer.phone} onChange={(event) => setBuyer({ ...buyer, phone: event.target.value })} placeholder="Teléfono de contacto" className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal" data-testid="input-buyer-phone" /></label>
            <label className="text-xs font-semibold text-[#29445f]">Torre<input required value={buyer.tower} onChange={(event) => setBuyer({ ...buyer, tower: event.target.value })} placeholder="Torre" className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal" data-testid="input-buyer-tower" /></label>
            <label className="text-xs font-semibold text-[#29445f]">Departamento<input required value={buyer.apartment} onChange={(event) => setBuyer({ ...buyer, apartment: event.target.value })} placeholder="N.º de departamento" className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal" data-testid="input-buyer-apartment" /></label>
            <label className="text-xs font-semibold text-[#29445f]">Fecha de entrega (opcional)<input type="date" value={buyer.desiredDate} onChange={(event) => setBuyer({ ...buyer, desiredDate: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal" data-testid="input-desired-date" /></label>
            <label className="text-xs font-semibold text-[#29445f]">Hora de entrega (opcional)<input type="time" value={buyer.desiredTime} onChange={(event) => setBuyer({ ...buyer, desiredTime: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal" data-testid="input-desired-time" /></label>
          </div>
          <div className="mt-5 rounded-2xl border border-[#cbdabd] bg-[#f5f8f0] p-4" data-testid="panel-whatsapp-proof-instructions">
            <p className="text-xs leading-5 text-[#405c2c]">Completa tus datos y abre WhatsApp para enviar el comprobante de Yape o Plin al vendedor. Luego vuelve a L4 y registra el pedido.</p>
            {sellerWhatsAppUrl && <a href={sellerWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#2d4a67] px-4 py-2.5 text-xs font-bold text-white" data-testid="link-send-proof-whatsapp"><MessageCircle size={15} />Enviar comprobante por WhatsApp</a>}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Tu vecino coordinará contigo la entrega. La fecha y hora se enviarán solo si completas ambos campos.</p>
          <button onClick={buyNow} disabled={!cart.length || !buyer.name.trim() || !buyer.phone.trim() || !buyer.tower.trim() || !buyer.apartment.trim() || createOrder.isPending} className="mt-5 w-full rounded-full bg-[#2d4a67] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" data-testid="button-place-order">{createOrder.isPending ? 'Enviando pedido…' : 'Enviar pedido'}</button>
        </>}
      </div>
    </div>}
  </SiteShell>;
}

function ProductArtwork({ product, className = '' }: { product: Product; className?: string }) {
  return <div className={`relative overflow-hidden bg-[#dce8d0] ${className}`} data-testid={`artwork-product-${product.id}`}>
    {product.imageUrl ? <img src={product.imageUrl} alt={product.title} className="absolute inset-0 h-full w-full object-cover" data-testid={`img-product-${product.id}`} /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_26%,#f8f3df,transparent_32%),linear-gradient(145deg,#c8dfab,#83a5a3_55%,#647f97)]"><div className="absolute left-[15%] top-[18%] h-28 w-28 rounded-full border border-white/50 bg-white/10 backdrop-blur-sm" /><div className="absolute bottom-[-15%] right-[-3%] h-56 w-56 rotate-[-18deg] rounded-[3rem] border border-white/50 bg-[#f5edda]/55 shadow-2xl" /><div className="absolute bottom-7 left-6 max-w-[60%] text-3xl font-semibold text-[#29445f] drop-shadow-sm">{product.categoryName}</div></div>}
     {product.featured && <span className="absolute left-3 top-3 rounded-full bg-[#a2d64b] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#29445f]">Destacado</span>}
  </div>;
}

function ProductCard({ product, isFavorite, onFavorite, onView, onAdd }: { product: Product; isFavorite: boolean; onFavorite: (product: Product) => void; onView: (product: Product) => void; onAdd: (product: Product) => void }) {
  return <article className="group overflow-hidden rounded-[1.4rem] border border-border/75 bg-card transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-25px_rgba(35,60,84,.38)]" data-testid={`card-product-${product.id}`}>
    <button className="relative block w-full text-left" onClick={() => onView(product)} aria-label={`Ver ${product.title}`} data-testid={`button-open-product-${product.id}`}><ProductArtwork product={product} className="aspect-[4/3] transition-transform duration-500 group-hover:scale-[1.02]" /></button>
    <div className="p-3.5 sm:p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-[.14em] text-[#65804f]" data-testid={`text-category-${product.id}`}>{product.categoryName}</p><button className="mt-1 block truncate text-left font-semibold text-[#29445f]" onClick={() => onView(product)} data-testid={`button-title-${product.id}`}>{product.title}</button></div><button onClick={() => onFavorite(product)} className={`rounded-full p-2 transition ${isFavorite ? 'bg-[#fce8e5] text-[#b44c41]' : 'bg-muted text-muted-foreground hover:text-[#b44c41]'}`} aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'} data-testid={`button-favorite-${product.id}`}><Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} /></button></div><div className="mt-3 flex items-center justify-between"><span className="font-serif text-lg font-semibold text-[#29445f]" data-testid={`text-price-${product.id}`}>{money(product.price)}</span><span className="flex items-center gap-1 text-xs text-amber-600" data-testid={`text-rating-${product.id}`}><Star size={13} fill="currentColor" />{product.averageRating.toFixed(1)}</span></div><div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3"><span className="truncate text-[11px] text-muted-foreground">{product.shopName || product.sellerName}</span><button onClick={() => onAdd(product)} className="rounded-full bg-[#eaf4df] px-3 py-1.5 text-xs font-bold text-[#405c2c] hover:bg-[#d9ebc4]" data-testid={`button-bag-${product.id}`}><Check size={12} className="mr-1 inline" />Agregar</button></div></div>
  </article>;
}

function ProductComments({ productId }: { productId: string }) {
  const comments = useListProductReviews(productId);
  const createReport = useCreateReport();
  const reportComment = (reviewId: string) => {
    const reason = window.prompt('¿Por qué quieres reportar esta opinión? (mínimo 5 caracteres)')?.trim();
    if (!reason || reason.length < 5) return;
    createReport.mutate(
      { data: { targetType: 'comment', targetId: reviewId, reason } },
      {
        onSuccess: () => window.alert('Opinión reportada. El administrador la revisará.'),
        onError: () => window.alert('No pudimos enviar el reporte. Inicia sesión e inténtalo de nuevo.'),
      },
    );
  };
  if (comments.isLoading) return <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground" data-testid="status-comments-loading">Cargando opiniones de vecinos…</p>;
  if (comments.isError) return <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground" role="status" data-testid="status-comments-error">Las opiniones no están disponibles por ahora.</p>;
  return <section className="mt-5 border-t border-border pt-4" data-testid="section-product-comments">
    <h3 className="text-xs font-bold uppercase tracking-[.14em] text-[#638049]">Opiniones de vecinos</h3>
    {!comments.data?.length && <p className="mt-2 text-xs text-muted-foreground" data-testid="text-no-comments">Todavía no hay opiniones. Puedes dejar la primera.</p>}
    <div className="mt-2 space-y-3">{(comments.data ?? []).map((review: Review) => <article key={review.id} className="rounded-xl bg-muted/60 p-3" data-testid={`card-comment-${review.id}`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-[#29445f]">{review.authorName} <span className="text-amber-600">· {review.rating}/5</span></p><button type="button" onClick={() => reportComment(review.id)} disabled={createReport.isPending} className="shrink-0 text-[10px] font-semibold text-[#9e4036] hover:underline" data-testid={`button-report-comment-${review.id}`}>Reportar opinión</button></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{review.comment}</p></article>)}</div>
  </section>;
}

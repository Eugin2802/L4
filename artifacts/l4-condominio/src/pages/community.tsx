import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { ArrowDownToLine, ArrowRight, BadgeCheck, Check, ChevronRight, CircleAlert, ClipboardList, Copy, CreditCard, FileImage, LockKeyhole, Plus, Shield, Store, Upload, Users, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  getGetAdminOverviewQueryKey,
  getListFeaturedRequestsQueryKey,
  getListOrdersQueryKey,
  getListReportsQueryKey,
  useApproveFeaturedRequest,
  useAdminLogin,
  useBlockUser,
  useConfirmOrderReceived,
  useCreateCategory,
  useCreateFeaturedRequest,
  useCreateProduct,
  useCreateReview,
  useDeleteCategory,
  useGetAdminOverview,
  useGetAdminSettings,
  useGetProfile,
  useGetSellerOverview,
  useListCategories,
  useListFeaturedRequests,
  useListOrders,
  useListProductReviews,
  useListProducts,
  useListReports,
  useListUsers,
  useResolveReport,
  useSaveProfile,
  useDeleteProduct,
  useUpdateProduct,
  useUpdateAdminSettings,
  useUpdateCategory,
  useUpdateOrderStatus,
  useSetProductFeatured,
  useDeleteReview,
} from '@workspace/api-client-react';
import type { CategoryInput, FeaturedRequestInput, OrderStatusInputStatus, Product, ProductInput, ProfileInput, ReportResolutionInputStatus, Review } from '@workspace/api-client-react';
import { PageHeading, SiteShell, StatePanel } from '@/components/site-shell';

const fmtMoney = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 }).format(value);
const statusLabels: Record<string, string> = { accepted: 'Aceptado', preparing: 'Preparando', ready: 'Listo para entregar', delivered: 'Entregado' };
function chartMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
  return fmtMoney(Number(value));
}
function chartTooltip(value: unknown): [string, string] {
  const amount = typeof value === 'number' || typeof value === 'string' ? value : null;
  return [chartMoney(amount), 'Ventas del mes'];
}
function chartMonthLabel(value: unknown) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? `Mes: ${new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(new Date(timestamp))}` : `Mes: ${String(value)}`;
}
function monthTimestamp(value: string) {
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01T12:00:00` : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}
function targetTypeLabel(value: string) {
  return ({ product: 'producto', review: 'opinión', user: 'residente', order: 'pedido' } as Record<string, string>)[value] ?? value;
}
function reviewRequestStatus(value: string) {
  return ({ pending: 'pendiente', approved: 'aprobada', rejected: 'rechazada' } as Record<string, string>)[value] ?? value;
}

export function RegistrationGate() {
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [, setLocation] = useLocation();
  const continueToSignup = () => {
    if (!terms || !adult) return;
    sessionStorage.setItem('l4_registration_consent', JSON.stringify({ acceptedTerms: true, isAdult: true, createdAt: Date.now() }));
    setLocation('/sign-up');
  };
  return <SiteShell><section className="mx-auto max-w-3xl px-5 py-12 md:py-20"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#57763d]">Bienvenida vecinal</p><h1 className="mt-3 text-5xl font-semibold leading-[1.04] text-[#29445f] sm:text-6xl">Hagamos que<br />todo quede más cerca.</h1><p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">L4 es un mercado privado para quienes viven en Laureles 4. Antes de crear tu cuenta, confirma estos dos puntos.</p><div className="mt-9 space-y-4 rounded-[1.75rem] border border-border bg-card p-6 sm:p-8"><label className="flex cursor-pointer items-start gap-4 rounded-2xl p-3 transition hover:bg-muted/70" data-testid="label-terms-consent"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-5 w-5 accent-[#6f9f38]" data-testid="input-accept-terms" /><span><span className="font-semibold text-[#29445f]">Acepto los términos de la comunidad.</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">Me comprometo a tratar con respeto a los demás. No publicaré insultos, groserías, acoso, contenido sexual ni productos o servicios ilegales. El administrador puede retirar avisos o bloquear cuentas que infrinjan estas reglas.</span></span></label><label className="flex cursor-pointer items-start gap-4 rounded-2xl p-3 transition hover:bg-muted/70" data-testid="label-age-consent"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1 h-5 w-5 accent-[#6f9f38]" data-testid="input-confirm-adult" /><span><span className="font-semibold text-[#29445f]">Confirmo que tengo 18 años o más.</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">Las cuentas y transacciones de L4 son solo para personas adultas.</span></span></label><div className="rounded-xl border border-border bg-[#f5f3e8] px-4 py-3 text-xs leading-5 text-[#596a5a]" data-testid="text-transaction-disclaimer">L4 ofrece un espacio para publicar avisos; no participa en las ventas, pagos ni entregas, y no verifica ni garantiza los productos o acuerdos. Compradores y vendedores son responsables de revisar los productos, acordar las condiciones y resolver sus transacciones. Este aviso no excluye responsabilidades que la ley no permita excluir.</div><div className="rounded-xl bg-[#f5f3e8] px-4 py-3 text-xs leading-5 text-[#596a5a]" data-testid="text-consent-storage">Tu confirmación se guarda temporalmente durante el registro y también quedará asociada a tu perfil.</div><button disabled={!terms || !adult} onClick={continueToSignup} className="mt-3 w-full rounded-full bg-[#2d4a67] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#375c7f] disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-continue-register">Continuar a crear mi cuenta <ArrowRight size={16} className="ml-1 inline" /></button><p className="text-center text-sm text-muted-foreground">¿Ya tienes cuenta? <Link href="/sign-in" className="font-semibold text-[#456638]" data-testid="link-register-signin">Ingresar</Link></p></div></section></SiteShell>;
}

export function ProfilePage() {
  const profile = useGetProfile();
  const { isLoaded: clerkLoaded, user } = useUser();
  const saveProfile = useSaveProfile();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProfileInput>({ email: '', displayName: '', shopName: '', phone: '', acceptedTerms: false, isAdult: false });
  const [preview, setPreview] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [initialized, setInitialized] = useState(false);
  const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? '';
  useEffect(() => {
    if (clerkLoaded && !initialized && (profile.data || profile.isError)) {
      let consent = { acceptedTerms: false, isAdult: false };
      try {
        const stored = sessionStorage.getItem('l4_registration_consent');
        if (stored) {
          const parsed = JSON.parse(stored) as { acceptedTerms?: boolean; isAdult?: boolean; createdAt?: number };
          const fresh = !parsed.createdAt || Date.now() - parsed.createdAt < 30 * 60 * 1000;
          if (fresh) consent = { acceptedTerms: Boolean(parsed.acceptedTerms), isAdult: Boolean(parsed.isAdult) };
        }
      } catch {
        consent = { acceptedTerms: false, isAdult: false };
      }
      const existing = Boolean(profile.data);
      setDraft({
        email: profile.data?.email ?? clerkEmail,
        displayName: profile.data?.displayName ?? user?.fullName ?? '',
        shopName: profile.data?.shopName ?? '',
        phone: profile.data?.phone ?? '',
        avatarUrl: profile.data?.avatarUrl,
        acceptedTerms: consent.acceptedTerms || existing,
        isAdult: consent.isAdult || existing,
      });
      setInitialized(true);
    }
  }, [profile.data, profile.isError, initialized, clerkLoaded, clerkEmail, user?.fullName]);
  const acceptConsent = (field: 'acceptedTerms' | 'isAdult', value: boolean) => setDraft((current) => ({ ...current, [field]: value }));
  const selectFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPreview(URL.createObjectURL(file));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    saveProfile.mutate({ data: { ...draft, email: clerkEmail || profile.data?.email || draft.email, avatarUrl: profile.data?.avatarUrl ?? null } }, { onSuccess: () => { setSaved(true); sessionStorage.removeItem('l4_registration_consent'); queryClient.invalidateQueries({ queryKey: ['/api/l4/profile'] }); } });
  };
  return <SiteShell><section className="mx-auto max-w-4xl px-5 py-12 md:py-16"><PageHeading eyebrow="Tu espacio" title={profile.data ? 'Mi perfil y tienda' : 'Completa tu perfil'} subtitle="Cuéntales a tus vecinos quién eres y qué compartes." />{profile.isLoading || !clerkLoaded || !initialized ? <LoadingPanel /> : !profile.data && !user ? <StatePanel title="No pudimos encontrar tu cuenta." detail="Inicia sesión para crear o actualizar tu perfil." retry={() => profile.refetch()} /> : <form onSubmit={submit} className="grid gap-7 rounded-[1.75rem] border border-border bg-card p-6 sm:grid-cols-[180px_1fr] sm:p-9" data-testid="form-profile">
    {!profile.data && <div className="sm:col-span-2 rounded-xl bg-[#f5f3e8] px-4 py-3 text-sm leading-5 text-[#596a5a]" data-testid="text-first-profile-onboarding">Tu cuenta ya está creada. Completa estos datos para empezar a comprar y vender en Laureles 4.</div>}
    <div><div className="relative mx-auto h-36 w-36 overflow-hidden rounded-[2rem] bg-[#eaf4df] sm:mx-0">{preview ? <img src={preview} alt="Vista previa temporal de la foto de perfil" className="h-full w-full object-cover" data-testid="img-profile-preview" /> : profile.data?.avatarUrl ? <img src={profile.data.avatarUrl} alt="Perfil" className="h-full w-full object-cover" data-testid="img-profile-avatar" /> : <div className="flex h-full items-center justify-center font-serif text-5xl font-semibold text-[#54713f]" data-testid="text-profile-initial">{(draft.displayName || 'L').slice(0, 1).toUpperCase()}</div>}</div><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => selectFile(e.target.files?.[0])} data-testid="input-avatar-file" /><button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#9fb883] px-3 py-2.5 text-xs font-semibold text-[#52743a]" data-testid="button-upload-avatar"><Upload size={14} />Elegir o arrastrar una foto</button><p className="mt-2 text-[11px] leading-4 text-muted-foreground" data-testid="text-photo-storage-note">Solo vista previa. No hay almacenamiento persistente disponible; la imagen no se guardará.</p></div>
    <div className="space-y-4"><p className="text-xs text-muted-foreground" data-testid="text-profile-email">Correo de tu cuenta: {clerkEmail || profile.data?.email || draft.email}</p><Field label="Tu nombre" value={draft.displayName} onChange={(value) => setDraft({ ...draft, displayName: value })} testId="input-profile-name" required /><Field label="Nombre de tu tienda" value={draft.shopName} onChange={(value) => setDraft({ ...draft, shopName: value })} testId="input-profile-shop" required /><Field label="Teléfono" value={draft.phone} onChange={(value) => setDraft({ ...draft, phone: value })} testId="input-profile-phone" required /><label className="flex items-start gap-3 text-sm"><input checked={draft.acceptedTerms} onChange={(e) => acceptConsent('acceptedTerms', e.target.checked)} type="checkbox" className="mt-0.5 accent-[#6f9f38]" data-testid="input-profile-terms" /><span>Acepto los términos de la comunidad L4.</span></label><label className="flex items-start gap-3 text-sm"><input checked={draft.isAdult} onChange={(e) => acceptConsent('isAdult', e.target.checked)} type="checkbox" className="mt-0.5 accent-[#6f9f38]" data-testid="input-profile-adult" /><span>Confirmo que tengo 18 años o más.</span></label><div className="flex flex-wrap items-center gap-3 pt-2"><button disabled={saveProfile.isPending || !draft.acceptedTerms || !draft.isAdult || !draft.displayName.trim() || !draft.shopName.trim() || draft.phone.trim().length < 6} className="rounded-full bg-[#2d4a67] px-6 py-3 text-sm font-bold text-white disabled:opacity-50" data-testid="button-save-profile">{saveProfile.isPending ? 'Guardando…' : profile.data ? 'Guardar perfil' : 'Completar perfil'}</button>{saved && <span className="flex items-center gap-1 text-sm font-medium text-[#52743a]" role="status" data-testid="status-profile-saved"><Check size={15} />Cambios guardados</span>}{saveProfile.isError && <span className="text-sm text-destructive" role="alert" data-testid="status-profile-error">No pudimos guardar tu perfil. Inténtalo de nuevo.</span>}</div></div>
  </form>}</section></SiteShell>;
}

export function OrdersPage() {
  const orders = useListOrders({ query: { queryKey: getListOrdersQueryKey(), refetchInterval: 15_000 } });
  const profile = useGetProfile();
  const updateStatus = useUpdateOrderStatus();
  const confirm = useConfirmOrderReceived();
  const createReview = useCreateReview();
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const mine = profile.data?.id;
  const received = (orderId: string) => confirm.mutate({ orderId }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/orders'] }) });
  const nextStatus = (orderId: string, status: OrderStatusInputStatus) => updateStatus.mutate({ orderId, data: { status } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/orders'] }) });
  const review = (orderId: string, productId: string) => createReview.mutate({ data: { orderId, productId, rating: ratings[orderId] ?? 5, comment: comments[orderId] ?? '' } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/orders'] }) });
  return <SiteShell><section className="mx-auto max-w-5xl px-5 py-12 md:py-16"><PageHeading eyebrow="El recorrido de tus pedidos" title="Mis pedidos" subtitle="Sigue tus compras y las ventas de tu tienda." />{orders.isLoading ? <LoadingPanel /> : orders.isError ? <StatePanel title="Tus pedidos no están disponibles." detail="Inicia sesión e inténtalo de nuevo." retry={() => orders.refetch()} /> : !orders.data?.length ? <StatePanel title="Todavía no tienes pedidos." detail="Cuando encuentres algo que te guste, aparecerá aquí." /> : <div className="space-y-4">{orders.data.map((order) => { const isSeller = order.sellerId === mine; return <article key={order.id} className="rounded-[1.6rem] border border-border bg-card p-5 sm:p-7" data-testid={`card-order-${order.id}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#eaf4df] px-3 py-1 text-xs font-bold text-[#52743a]" data-testid={`status-order-${order.id}`}>{statusLabels[order.status] ?? order.status}</span><span className="text-xs text-muted-foreground">{isSeller ? 'Venta' : 'Compra'} · {new Date(order.createdAt).toLocaleDateString('es-PE')}</span></div><h2 className="mt-3 font-serif text-2xl font-semibold text-[#29445f]">{isSeller ? `Para ${order.buyerName}` : `De ${order.sellerName}`}</h2><p className="mt-1 text-sm text-muted-foreground">{order.tower} · Departamento {order.apartment} · {order.phone}</p>{order.desiredAt && <p className="mt-2 text-xs text-muted-foreground">Entrega solicitada: {new Date(order.desiredAt).toLocaleString('es-PE')}</p>}</div><p className="font-serif text-2xl font-semibold text-[#29445f]" data-testid={`text-order-total-${order.id}`}>{fmtMoney(order.total)}</p></div><div className="mt-5 divide-y divide-border">{order.items.map((item) => <div key={item.productId} className="flex justify-between py-2 text-sm" data-testid={`row-order-item-${item.productId}`}><span>{item.quantity} × {item.productName}</span><span>{fmtMoney(item.unitPrice)}</span></div>)}</div>{isSeller && <div className="mt-4 flex flex-wrap gap-2">{(['accepted', 'preparing', 'ready', 'delivered'] as OrderStatusInputStatus[]).map((status) => <button key={status} disabled={order.status === status || updateStatus.isPending} onClick={() => nextStatus(order.id, status)} className={`rounded-full px-3 py-2 text-xs font-semibold ${order.status === status ? 'bg-[#2d4a67] text-white' : 'bg-muted text-foreground hover:bg-[#eaf4df]'}`} data-testid={`button-order-${status}-${order.id}`}>{statusLabels[status]}</button>)}</div>}{!isSeller && <div className="mt-4 flex flex-wrap items-center gap-3">{!order.confirmed && order.status === 'delivered' && <button onClick={() => received(order.id)} disabled={confirm.isPending} className="rounded-full bg-[#2d4a67] px-4 py-2 text-xs font-bold text-white" data-testid={`button-confirm-received-${order.id}`}>Confirmar recepción</button>}{order.confirmed && <span className="flex items-center gap-1 text-xs font-semibold text-[#52743a]" data-testid={`status-confirmed-${order.id}`}><BadgeCheck size={15} />Recibido</span>}{order.confirmed && order.items.map((item) => <div key={item.productId} className="flex items-center gap-2"><select aria-label="Calificación" value={ratings[order.id] ?? 5} onChange={(e) => setRatings({ ...ratings, [order.id]: Number(e.target.value) })} className="rounded-full border border-border bg-card px-3 py-2 text-xs" data-testid={`select-rating-${order.id}`}><option value={5}>5 estrellas</option><option value={4}>4 estrellas</option><option value={3}>3 estrellas</option><option value={2}>2 estrellas</option><option value={1}>1 estrella</option></select><input value={comments[order.id] ?? ''} onChange={(e) => setComments({ ...comments, [order.id]: e.target.value })} placeholder="Escribe una opinión" className="w-32 rounded-full border border-border bg-card px-3 py-2 text-xs" data-testid={`input-review-${order.id}`} /><button onClick={() => review(order.id, item.productId)} className="rounded-full bg-[#eaf4df] px-3 py-2 text-xs font-semibold text-[#52743a]" data-testid={`button-review-${order.id}`}>Calificar al vecino</button></div>)}</div>}</article>; })}</div>}</section></SiteShell>;
}

export function SellerPage() {
  const overview = useGetSellerOverview();
  const settings = useGetAdminSettings();
  const requestFeatured = useCreateFeaturedRequest();
  const featuredRequests = useListFeaturedRequests({ query: { queryKey: getListFeaturedRequestsQueryKey(), refetchInterval: 15_000 } });
  const queryClient = useQueryClient();
  const proofFileRef = useRef<HTMLInputElement>(null);
  const [highlightProduct, setHighlightProduct] = useState<Product | null>(null);
  const [highlightProof, setHighlightProof] = useState('');
  const [highlightConfirmed, setHighlightConfirmed] = useState(false);
  const [highlightSent, setHighlightSent] = useState(false);
  const [highlightError, setHighlightError] = useState('');
  const [highlightCopied, setHighlightCopied] = useState(false);
  const chartData = (overview.data?.monthlySales ?? []).flatMap((row) => {
    const timestamp = monthTimestamp(row.month);
    return timestamp === null ? [] : [{ ...row, timestamp }];
  }).sort((left, right) => left.timestamp - right.timestamp);
  const chartPeriod = chartData.length
    ? `${new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric' }).format(new Date(chartData[0].timestamp))} – ${new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric' }).format(new Date(chartData[chartData.length - 1].timestamp))}`
    : 'sin datos mensuales';
  const download = () => {
    if (!overview.data) return;
    const rows = [
      ['Mes', 'Ventas (S/)', 'Cantidad de pedidos'],
      ...overview.data.monthlySales.map((month) => [month.month, fmtMoney(month.sales), String(month.orderCount)]),
      [],
      ['Productos con mayor acogida', 'Opiniones', 'Calificación promedio'],
      ...overview.data.topProducts.map((product) => [product.title, String(product.reviewCount), product.averageRating.toFixed(1)]),
    ];
    const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ventas-laureles-4.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const requestBoost = (productId: string) => {
    const product = overview.data?.topProducts.find((item) => item.id === productId);
    if (!product) return;
    setHighlightProduct(product);
    setHighlightProof('');
    setHighlightConfirmed(false);
    setHighlightSent(false);
    setHighlightError('');
    setHighlightCopied(false);
  };
  const selectHighlightProof = (file?: File) => {
    if (file?.type.startsWith('image/')) setHighlightProof(URL.createObjectURL(file));
  };
  const submitHighlightRequest = () => {
    if (!highlightProduct || !highlightConfirmed) return;
    const data: FeaturedRequestInput = { productId: highlightProduct.id, receiptUrl: null };
    requestFeatured.mutate({ data }, {
      onSuccess: () => {
        setHighlightSent(true);
        queryClient.invalidateQueries({ queryKey: ['/api/l4/featured-requests'] });
      },
      onError: (error) => setHighlightError(error.status === 409
        ? 'Ya se alcanzó el límite de cinco destacados de hoy. Inténtalo mañana.'
        : 'No pudimos enviar la solicitud. Inténtalo de nuevo.'),
    });
  };
  const copyAdminPhone = async () => {
    if (!settings.data?.paymentPhone) return;
    try {
      await navigator.clipboard.writeText(settings.data.paymentPhone);
      setHighlightCopied(true);
    } catch {
      setHighlightError('No se pudo copiar el teléfono de pago.');
    }
  };
  return <SiteShell>
    <section className="mx-auto max-w-6xl px-5 py-12 md:py-16">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <PageHeading eyebrow="Tu tienda, de un vistazo" title="Espacio vendedor" subtitle="Mira qué productos se mueven y quién vuelve a comprar." />
        <button onClick={download} disabled={!overview.data} className="mb-8 inline-flex items-center gap-2 self-start rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-[#29445f] disabled:opacity-50 sm:self-auto" data-testid="button-download-sales">
          <ArrowDownToLine size={16} />
          Descargar reporte para Excel
        </button>
      </div>
      {overview.isLoading ? <LoadingPanel /> : overview.isError ? <StatePanel title="Tus estadísticas aún no están disponibles." detail="Inicia sesión como vendedor para consultar tus ventas." retry={() => overview.refetch()} /> : <>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Ventas acumuladas" value={fmtMoney(overview.data?.totalSales ?? 0)} />
          <Metric label="Pedidos" value={String(overview.data?.orderCount ?? 0)} />
          <Metric label="Clientes frecuentes" value={String(overview.data?.frequentBuyers.length ?? 0)} />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_.8fr]">
          <section className="rounded-[1.6rem] border border-border bg-card p-5 sm:p-7" aria-labelledby="sales-chart-title">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#638049]">Pulso mensual</p>
              <h2 id="sales-chart-title" className="mt-1 font-serif text-2xl font-semibold text-[#29445f]">Ventas acumuladas por mes</h2>
              <p className="mt-1 text-xs text-muted-foreground">Ventas por mes · importes en soles peruanos (S/)</p>
            </div>
            <div className="h-64 w-full" data-testid="chart-monthly-sales" role="img" aria-label="Ventas mensuales en soles peruanos">
              {chartData.length ? <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 18, right: 12, left: 2, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e5e8df" />
                  <XAxis type="number" dataKey="timestamp" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(value) => new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit' }).format(new Date(Number(value)))} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#758171' }} />
                  <YAxis type="number" tickLine={false} axisLine={false} tickFormatter={chartMoney} tick={{ fontSize: 10, fill: '#758171' }} />
                  <Tooltip formatter={chartTooltip} labelFormatter={chartMonthLabel} contentStyle={{ borderRadius: 14, border: '1px solid #e0e5d9' }} />
                  <Bar dataKey="sales" name="Ventas del mes" fill="#44986D" radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-2xl bg-muted/50 px-5 text-center text-sm text-muted-foreground" data-testid="empty-monthly-sales">Tus ventas mensuales aparecerán aquí cuando registres tu primer pedido.</div>}
            </div>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground" data-testid="text-chart-method">Periodo: {chartPeriod}. Totales mensuales reportados por la plataforma, en soles (S/), sin agrupación ni muestreo adicional.</p>
          </section>
          <section className="rounded-[1.6rem] bg-[#2d4a67] p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b5e36e]">Clientes frecuentes</p>
            <h2 className="mt-2 font-serif text-2xl">Rostros conocidos.</h2>
            {overview.data?.frequentBuyers.length ? <ul className="mt-5 space-y-3">{overview.data.frequentBuyers.map((name, index) => <li key={`${name}-${index}`} className="flex items-center gap-3 border-t border-white/15 pt-3" data-testid={`text-frequent-buyer-${index}`}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold">{name.slice(0, 1)}</span><span className="text-sm">{name}</span></li>)}</ul> : <p className="mt-4 text-sm text-white/65" data-testid="text-no-buyers">Tu primer cliente frecuente está a la vuelta de la esquina.</p>}
          </section>
        </div>
        <section className="mt-5 rounded-[1.6rem] border border-border bg-card p-5 sm:p-7" data-testid="section-featured-requests">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#638049]">Estado de solicitudes</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-[#29445f]">Mis destacados</h2>
          {featuredRequests.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Cargando solicitudes…</p> : featuredRequests.isError ? <p className="mt-3 text-sm text-muted-foreground">No pudimos cargar tus solicitudes. Vuelve a intentarlo.</p> : featuredRequests.data?.length ? <ul className="mt-4 space-y-2">{featuredRequests.data.map((request) => <li key={request.id} className="flex flex-col justify-between gap-2 rounded-xl bg-muted/60 p-3 text-sm sm:flex-row sm:items-center" data-testid={`row-seller-feature-request-${request.id}`}><span className="font-medium text-[#29445f]">{request.productName}</span><span className="text-xs text-muted-foreground">{reviewRequestStatus(request.status)}{request.featuredUntil ? ` · destacado hasta ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.featuredUntil))}` : ''}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Aún no has enviado solicitudes.</p>}
        </section>
        <section className="mt-5 rounded-[1.6rem] border border-border bg-card p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#638049]">Lo más popular</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-[#29445f]">Los favoritos de tus clientes</h2>
          {overview.data?.topProducts.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{overview.data.topProducts.map((product) => <div key={product.id} className="flex items-center justify-between gap-4 rounded-2xl bg-muted/65 p-4" data-testid={`card-popular-product-${product.id}`}><div><p className="font-semibold text-[#29445f]">{product.title}</p><p className="mt-1 text-xs text-muted-foreground">{product.categoryName} · {product.reviewCount} opiniones</p></div><button onClick={() => requestBoost(product.id)} disabled={requestFeatured.isPending} className="shrink-0 rounded-full bg-[#eaf4df] px-3 py-2 text-xs font-bold text-[#52743a]" data-testid={`button-request-feature-${product.id}`}>Solicitar destacado</button></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground" data-testid="text-no-products">Tus productos publicados aparecerán aquí.</p>}
        </section>
      </>}
      <div className="mt-6"><Link href="/seller/listings" className="inline-flex items-center gap-2 rounded-full bg-[#2d4a67] px-5 py-3 text-sm font-bold text-white" data-testid="link-manage-listings"><Store size={16} />Administrar avisos</Link></div>
    </section>
    {highlightProduct && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#172636]/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Solicitar destacado" data-testid="dialog-highlight-request">
      <section className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-background p-6 sm:rounded-[2rem] sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#638049]">Visibilidad en el mercado</p><h2 className="mt-1 font-serif text-3xl font-semibold text-[#29445f]">Destacar {highlightProduct.title}</h2></div><button onClick={() => setHighlightProduct(null)} className="rounded-full p-2 hover:bg-muted" aria-label="Cerrar solicitud" data-testid="button-close-highlight"><X size={18} /></button></div>
        {highlightSent ? <div className="mt-6 rounded-2xl bg-[#eaf4df] p-5" role="status" data-testid="status-highlight-sent"><p className="font-semibold text-[#29445f]">Solicitud enviada</p><p className="mt-2 text-sm leading-5 text-[#52743a]">El equipo de Laureles 4 revisará tu solicitud y el comprobante cuando esté disponible.</p><button onClick={() => setHighlightProduct(null)} className="mt-4 rounded-full bg-[#2d4a67] px-4 py-2.5 text-sm font-bold text-white" data-testid="button-close-highlight-success">Listo</button></div> : <>
          {settings.isLoading ? <div className="mt-5"><LoadingPanel /></div> : settings.isError ? <StatePanel title="No pudimos cargar los datos de pago." detail="Inténtalo de nuevo antes de enviar la solicitud." retry={() => settings.refetch()} /> : !settings.data ? <div className="mt-5"><LoadingPanel /></div> : <>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/60 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Precio</p><p className="mt-1 font-serif text-xl font-semibold text-[#29445f]">{fmtMoney(settings.data.featuredPrice)}</p></div>
              <div className="rounded-xl bg-muted/60 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Duración</p><p className="mt-1 font-serif text-xl font-semibold text-[#29445f]">{settings.data.featuredDurationHours} horas</p></div>
            </div>
            <div className="mt-3 rounded-xl bg-[#eaf4df] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#52743a]">Paga por Yape o Plin al equipo de Laureles 4</p>{settings.data.paymentPhone ? <div className="mt-2 flex flex-wrap items-center gap-2"><span className="font-mono text-lg font-bold text-[#29445f]" data-testid="text-highlight-payment-phone">{settings.data.paymentPhone}</span><button onClick={copyAdminPhone} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#29445f]" data-testid="button-copy-highlight-phone"><Copy size={13} />Copiar</button>{highlightCopied && <span className="text-xs text-[#52743a]" role="status">Número copiado</span>}</div> : <p className="mt-2 text-sm text-muted-foreground">El equipo aún no ha configurado un teléfono de pago.</p>}</div>
             <p className="mt-3 rounded-xl border border-border px-4 py-3 text-xs leading-5 text-muted-foreground" data-testid="text-highlight-cap">Destacados aprobados hoy: {settings.data.featuredToday} de {settings.data.dailyFeaturedLimit}. Se aprueban hasta cinco por día; el equipo revisa cada solicitud y su pago.</p>
             {settings.data.featuredToday >= settings.data.dailyFeaturedLimit && <p className="mt-3 rounded-xl bg-[#f8e8e4] px-4 py-3 text-xs font-semibold text-[#a44236]" role="alert" data-testid="text-highlight-limit-exceeded">Ya se alcanzó el límite permitido de destacados por hoy. Puedes volver a solicitar mañana.</p>}
            <input ref={proofFileRef} type="file" accept="image/*" className="hidden" onChange={(event) => selectHighlightProof(event.target.files?.[0])} data-testid="input-highlight-proof" />
            <button type="button" onClick={() => proofFileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectHighlightProof(event.dataTransfer.files[0]); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#9fb883] px-4 py-3 text-xs font-bold text-[#52743a]" data-testid="button-highlight-proof"><Upload size={15} />Elegir o arrastrar comprobante</button>
            {highlightProof && <img src={highlightProof} alt="Vista previa temporal del comprobante" className="mx-auto mt-3 max-h-40 rounded-xl object-contain" data-testid="img-highlight-proof-preview" />}
            <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground" data-testid="text-highlight-proof-storage">Solo vista previa. No hay almacenamiento persistente disponible; la imagen no se adjuntará a la solicitud.</p>
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs leading-5"><input type="checkbox" checked={highlightConfirmed} onChange={(event) => setHighlightConfirmed(event.target.checked)} className="mt-0.5 accent-[#6f9f38]" data-testid="input-confirm-highlight-request" /><span>Confirmo que deseo enviar la solicitud de destacado para este aviso.</span></label>
            {highlightError && <p className="mt-3 text-sm text-destructive" role="alert" data-testid="status-highlight-error">{highlightError}</p>}
             <button onClick={submitHighlightRequest} disabled={!highlightConfirmed || requestFeatured.isPending || settings.isLoading || settings.isError || settings.data.featuredToday >= settings.data.dailyFeaturedLimit} className="mt-4 w-full rounded-full bg-[#2d4a67] px-5 py-3 text-sm font-bold text-white disabled:opacity-45" data-testid="button-submit-highlight">{requestFeatured.isPending ? 'Enviando solicitud…' : 'Enviar solicitud de destacado'}</button>
          </>}
        </>}
      </section>
    </div>}
  </SiteShell>;
}

export function SellerListingsPage() {
  const profile = useGetProfile();
  const products = useListProducts();
  const categories = useListCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProductInput>({ title: '', description: '', price: 1, categoryId: '' });
  const [editingId, setEditingId] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mine = (products.data ?? []).filter((product) => product.sellerId === profile.data?.id);
  const reset = () => {
    setDraft({ title: '', description: '', price: 1, categoryId: '' });
    setEditingId('');
    setPhotoPreview('');
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const data: ProductInput = { ...draft, price: Number(draft.price), imageUrl: draft.imageUrl ?? null };
    const onSuccess = () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ['/api/l4/products'] });
    };
    if (editingId) updateProduct.mutate({ productId: editingId, data }, { onSuccess });
    else createProduct.mutate({ data }, { onSuccess });
  };
  const edit = (productId: string) => {
    const product = mine.find((item) => item.id === productId);
    if (!product) return;
    setEditingId(productId);
    setDraft({ title: product.title, description: product.description, price: product.price, categoryId: product.categoryId, imageUrl: product.imageUrl });
    setPhotoPreview(product.imageUrl ?? '');
  };
  const selectPhoto = (file?: File) => {
    if (file?.type.startsWith('image/')) setPhotoPreview(URL.createObjectURL(file));
  };
  return <SiteShell><section className="mx-auto max-w-5xl px-5 py-12 md:py-16">
    <PageHeading eyebrow="Tu estante" title="Administrar avisos" subtitle="Publica algo nuevo, mejora un aviso o retíralo del mercado." />
    {profile.isLoading || products.isLoading || categories.isLoading ? <LoadingPanel /> : profile.isError || products.isError || categories.isError ? <StatePanel title="No pudimos cargar tus avisos." detail="Inicia sesión e inténtalo de nuevo para administrar tu tienda." retry={() => { profile.refetch(); products.refetch(); categories.refetch(); }} /> : <div className="grid gap-7 lg:grid-cols-[.95fr_1.05fr]">
      <form onSubmit={save} className="h-fit rounded-[1.6rem] border border-border bg-card p-5 sm:p-7" data-testid="form-product-listing">
        <h2 className="font-serif text-2xl font-semibold text-[#29445f]">{editingId ? 'Editar este aviso' : 'Agregar algo a tu tienda'}</h2>
        <div className="mt-5 space-y-4">
          <Field label="Nombre del producto" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} testId="input-listing-title" required />
          <label className="block text-sm font-semibold text-[#29445f]">Descripción<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal" data-testid="input-listing-description" /></label>
          <label className="block text-sm font-semibold text-[#29445f]">Precio (S/)<input required type="number" min="0.01" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal" data-testid="input-listing-price" /></label>
          <label className="block text-sm font-semibold text-[#29445f]">Categoría<select required value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal" data-testid="select-listing-category"><option value="">Elige una categoría</option>{(categories.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => selectPhoto(event.target.files?.[0])} data-testid="input-listing-photo" />
          <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectPhoto(event.dataTransfer.files[0]); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#9fb883] px-4 py-3 text-xs font-semibold text-[#52743a]" data-testid="button-listing-photo"><Upload size={15} />Elegir o arrastrar una foto</button>
          {photoPreview && <img src={photoPreview} alt="Vista previa temporal del aviso" className="h-24 w-24 rounded-xl object-cover" data-testid="img-listing-preview" />}
          <p className="text-xs leading-5 text-muted-foreground" data-testid="text-listing-storage-note">Solo vista previa. No hay almacenamiento persistente disponible; la imagen no se guardará.</p>
          <div className="flex gap-2"><button disabled={!draft.categoryId || createProduct.isPending || updateProduct.isPending} className="rounded-full bg-[#2d4a67] px-5 py-3 text-sm font-bold text-white disabled:opacity-45" data-testid="button-save-listing">{createProduct.isPending || updateProduct.isPending ? 'Guardando…' : editingId ? 'Guardar aviso' : 'Publicar aviso'}</button>{editingId && <button type="button" onClick={reset} className="rounded-full border border-border px-4 py-3 text-sm" data-testid="button-cancel-listing">Cancelar</button>}</div>
        </div>
      </form>
      <div className="space-y-3">
        <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#638049]">Publicado en el mercado</p><h2 className="mt-1 font-serif text-2xl font-semibold text-[#29445f]">Mis avisos</h2></div><span className="text-xs text-muted-foreground" data-testid="text-owned-listing-count">{mine.length} productos</span></div>
        {mine.length === 0 ? <StatePanel title="Tu estante está vacío." detail="Agrega tu primer aviso con el formulario de al lado." /> : mine.map((product) => <article key={product.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center" data-testid={`card-owned-listing-${product.id}`}><div className="flex items-center gap-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#eaf4df]">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-serif text-lg text-[#52743a]">{product.categoryName.slice(0, 1)}</div>}</div><div><p className="font-semibold text-[#29445f]">{product.title}</p><p className="mt-1 text-xs text-muted-foreground">{fmtMoney(product.price)} · {product.categoryName}</p></div></div><div className="flex gap-2"><button onClick={() => edit(product.id)} className="rounded-full bg-muted px-3 py-2 text-xs font-semibold" data-testid={`button-edit-listing-${product.id}`}>Editar</button><button onClick={() => { if (window.confirm(`¿Quitar «${product.title}» del mercado?`)) deleteProduct.mutate({ productId: product.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/products'] }) }); }} disabled={deleteProduct.isPending} className="rounded-full bg-[#f8e8e4] px-3 py-2 text-xs font-semibold text-[#a44236]" data-testid={`button-delete-listing-${product.id}`}>Quitar</button></div></article>)}
      </div>
    </div>}
  </section></SiteShell>;
}

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<'overview' | 'reports' | 'residents' | 'categories' | 'highlights' | 'settings' | 'reviews'>('overview');
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [settingsDraft, setSettingsDraft] = useState({ featuredPrice: 0, paymentPhone: '', featuredDurationHours: 24 });
  const [settingsReady, setSettingsReady] = useState(false);
  const queryClient = useQueryClient();
  const adminLogin = useAdminLogin();
  const login = (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    adminLogin.mutate({ data: { password } }, {
      onSuccess: (result) => {
        if (!result.success) {
          setLoginError(result.message || 'No pudimos abrir el panel de administración.');
          return;
        }
        setAuthenticated(true);
        setPassword('');
      },
      onError: () => setLoginError('No pudimos abrir el panel. Verifica la contraseña e inténtalo de nuevo.'),
    });
  };
  return <SiteShell><section className="mx-auto max-w-6xl px-5 py-12 md:py-16">{!authenticated ? <div className="mx-auto max-w-md rounded-[1.75rem] border border-border bg-card p-7 sm:p-9"><div className="mb-5 inline-flex rounded-2xl bg-[#eaf4df] p-3 text-[#52743a]"><LockKeyhole size={22} /></div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#638049]">Acceso privado</p><h1 className="mt-2 font-serif text-4xl font-semibold text-[#29445f]">Panel de administración</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Este espacio es exclusivo para el equipo de Laureles 4.</p><form onSubmit={login} className="mt-6"><label className="block text-xs font-bold text-[#29445f]" htmlFor="admin-password">Contraseña de administración</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[#84b63b]" data-testid="input-admin-password" /><button disabled={!password || adminLogin.isPending} className="mt-4 w-full rounded-full bg-[#2d4a67] px-5 py-3 text-sm font-bold text-white disabled:opacity-45" data-testid="button-admin-login">{adminLogin.isPending ? 'Ingresando…' : 'Abrir panel'}</button>{loginError && <p className="mt-3 text-sm text-destructive" role="alert" data-testid="status-admin-login-error">{loginError}</p>}</form><p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Shield size={14} className="mt-0.5 shrink-0" />La contraseña se envía directamente al servicio de sesión y esta página nunca la guarda.</p></div> : <AdminWorkspace tab={tab} setTab={setTab} categoryName={categoryName} setCategoryName={setCategoryName} editingCategory={editingCategory} setEditingCategory={setEditingCategory} settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} settingsReady={settingsReady} setSettingsReady={setSettingsReady} queryClient={queryClient} />}</section></SiteShell>;
}

function AdminWorkspace({ tab, setTab, categoryName, setCategoryName, editingCategory, setEditingCategory, settingsDraft, setSettingsDraft, settingsReady, setSettingsReady, queryClient }: { tab: string; setTab: (tab: 'overview' | 'reports' | 'residents' | 'categories' | 'highlights' | 'settings' | 'reviews') => void; categoryName: string; setCategoryName: (name: string) => void; editingCategory: string; setEditingCategory: (id: string) => void; settingsDraft: { featuredPrice: number; paymentPhone: string; featuredDurationHours: number }; setSettingsDraft: (settings: { featuredPrice: number; paymentPhone: string; featuredDurationHours: number }) => void; settingsReady: boolean; setSettingsReady: (value: boolean) => void; queryClient: ReturnType<typeof useQueryClient> }) {
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey(), refetchInterval: 15_000 } });
  const reports = useListReports({ query: { queryKey: getListReportsQueryKey(), refetchInterval: 15_000 } });
  const users = useListUsers();
  const categories = useListCategories();
  const requests = useListFeaturedRequests({ query: { queryKey: getListFeaturedRequestsQueryKey(), refetchInterval: 15_000 } });
  const settings = useGetAdminSettings();
  const products = useListProducts();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const blockUser = useBlockUser();
  const resolveReport = useResolveReport();
  const approve = useApproveFeaturedRequest();
  const updateSettings = useUpdateAdminSettings();
  const setFeatured = useSetProductFeatured();
  const deleteReview = useDeleteReview();
  const addCategory = () => {
    const payload: CategoryInput = { name: categoryName.trim() };
    if (!payload.name) return;
    if (editingCategory) updateCategory.mutate({ categoryId: editingCategory, data: payload }, { onSuccess: () => { setCategoryName(''); setEditingCategory(''); queryClient.invalidateQueries({ queryKey: ['/api/l4/categories'] }); } });
    else createCategory.mutate({ data: payload }, { onSuccess: () => { setCategoryName(''); queryClient.invalidateQueries({ queryKey: ['/api/l4/categories'] }); } });
  };
  const resolve = (reportId: string, status: ReportResolutionInputStatus) => resolveReport.mutate({ reportId, data: { status } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/admin/reports'] }) });
  const toggleBlocked = (userId: string, blocked: boolean) => blockUser.mutate({ userId, data: { blocked: !blocked } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/admin/users'] }) });
  const approveRequest = (requestId: string) => approve.mutate({ requestId }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/l4/featured-requests'] }); queryClient.invalidateQueries({ queryKey: ['/api/l4/admin/overview'] }); } });
  const toggleProductFeatured = (productId: string, featured: boolean) => setFeatured.mutate({ productId, data: { featured: !featured } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/products'] }) });
  const saveSettings = (e: FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({ data: settingsDraft }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/admin/settings'] }) });
  };
  useEffect(() => {
    if (settings.data && !settingsReady) {
      setSettingsDraft({ featuredPrice: settings.data.featuredPrice, paymentPhone: settings.data.paymentPhone, featuredDurationHours: settings.data.featuredDurationHours });
      setSettingsReady(true);
    }
  }, [settings.data, settingsReady, setSettingsDraft, setSettingsReady]);
   const tabs = [{ id: 'overview', label: 'Resumen', icon: ClipboardList }, { id: 'reports', label: 'Reportes', icon: CircleAlert }, { id: 'residents', label: 'Residentes', icon: Users }, { id: 'categories', label: 'Categorías', icon: Store }, { id: 'highlights', label: 'Destacados', icon: BadgeCheck }, { id: 'reviews', label: 'Opiniones', icon: CircleAlert }, { id: 'settings', label: 'Ajustes', icon: CreditCard }] as const;
   return <div><PageHeading eyebrow="Equipo de la comunidad" title="Panel de administración" subtitle="Cuidemos entre todos un mercado útil, seguro y bien organizado." /><div className="mb-7 flex gap-2 overflow-x-auto pb-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${tab === id ? 'bg-[#2d4a67] text-white' : 'border border-border bg-card text-muted-foreground'}`} data-testid={`button-admin-tab-${id}`}><Icon size={15} />{label}</button>)}</div>
    {tab === 'overview' && <div>{overview.isLoading ? <LoadingPanel /> : overview.isError ? <StatePanel title="No pudimos cargar el resumen." detail="Inténtalo de nuevo cuando tu sesión de administración esté activa." retry={() => overview.refetch()} /> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Residentes" value={String(overview.data?.userCount ?? 0)} /><Metric label="Reportes pendientes" value={String(overview.data?.pendingReports ?? 0)} /><Metric label="Destacados por revisar" value={String(overview.data?.pendingFeatured ?? 0)} /><Metric label="Destacados hoy" value={`${overview.data?.featuredToday ?? 0} / ${overview.data?.dailyFeaturedLimit ?? 0}`} /></div><div className="mt-5 rounded-[1.5rem] border border-border bg-card p-6"><h2 className="font-serif text-2xl font-semibold text-[#29445f]">Un vistazo a la comunidad</h2><p className="mt-2 text-sm text-muted-foreground">El mercado del vecindario está en tus manos. Revisa lo que necesite atención.</p><button onClick={() => setTab('reports')} className="mt-5 rounded-full bg-[#eaf4df] px-4 py-2 text-sm font-bold text-[#52743a]" data-testid="button-review-reports">Revisar reportes <ChevronRight size={15} className="ml-1 inline" /></button></div></>}</div>}
    {tab === 'reports' && <AdminListState loading={reports.isLoading} error={reports.isError} retry={() => reports.refetch()} empty={!reports.data?.length} title="No hay reportes para revisar." detail="Los nuevos reportes de la comunidad aparecerán aquí."><div className="space-y-3">{(reports.data ?? []).map((report) => <article key={report.id} className="rounded-2xl border border-border bg-card p-5" data-testid={`card-report-${report.id}`}><div className="flex flex-wrap justify-between gap-3"><div><span className="rounded-full bg-[#f5eedb] px-3 py-1 text-xs font-bold text-[#866c30]">{targetTypeLabel(report.targetType)} · {report.status === 'pending' ? 'pendiente' : report.status === 'reviewed' ? 'revisado' : report.status === 'dismissed' ? 'descartado' : report.status}</span><h3 className="mt-3 font-semibold text-[#29445f]">Reporte de {report.reporterName}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{report.reason}</p><p className="mt-2 text-xs text-muted-foreground">ID del elemento: {report.targetId}</p></div><div className="flex items-start gap-2"><button onClick={() => resolve(report.id, 'reviewed')} className="rounded-full bg-[#eaf4df] px-3 py-2 text-xs font-bold text-[#52743a]" data-testid={`button-resolve-${report.id}`}>Marcar revisado</button><button onClick={() => resolve(report.id, 'dismissed')} className="rounded-full border border-border px-3 py-2 text-xs font-semibold" data-testid={`button-dismiss-${report.id}`}>Descartar</button></div></div></article>)}</div></AdminListState>}
    {tab === 'residents' && <AdminListState loading={users.isLoading} error={users.isError} retry={() => users.refetch()} empty={!users.data?.length} title="Aún no hay perfiles de residentes." detail="Aquí aparecerán las personas registradas en la comunidad."><div className="overflow-hidden rounded-2xl border border-border bg-card">{(users.data ?? []).map((user) => <div key={user.id} className="flex flex-col justify-between gap-3 border-b border-border p-4 last:border-0 sm:flex-row sm:items-center" data-testid={`row-user-${user.id}`}><div><p className="font-semibold text-[#29445f]">{user.displayName} <span className="text-xs font-normal text-muted-foreground">· {user.shopName}</span></p><p className="mt-1 text-xs text-muted-foreground">{user.email} · {user.phone}</p></div><button onClick={() => toggleBlocked(user.id, user.isBlocked)} className={`rounded-full px-4 py-2 text-xs font-bold ${user.isBlocked ? 'bg-muted text-foreground' : 'bg-[#f8e8e4] text-[#a44236]'}`} data-testid={`button-block-user-${user.id}`}>{user.isBlocked ? 'Reactivar residente' : 'Bloquear residente'}</button></div>)}</div></AdminListState>}
    {tab === 'categories' && <AdminListState loading={categories.isLoading} error={categories.isError} retry={() => categories.refetch()} empty={!categories.data?.length} title="No hay categorías para organizar." detail="Agrega categorías para ayudar a los vecinos a encontrar lo que buscan."><div className="mb-4 flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:flex-row"><input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Nombre de la categoría" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm" data-testid="input-category-name" /><button onClick={addCategory} disabled={categoryName.trim().length < 2 || createCategory.isPending || updateCategory.isPending} className="rounded-full bg-[#2d4a67] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" data-testid="button-save-category">{editingCategory ? 'Guardar cambios' : 'Agregar categoría'} <Plus className="ml-1 inline" size={14} /></button>{editingCategory && <button onClick={() => { setEditingCategory(''); setCategoryName(''); }} className="rounded-full px-3 py-2 text-sm" data-testid="button-cancel-category">Cancelar</button>}</div><div className="space-y-2">{(categories.data ?? []).map((category) => <div key={category.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3" data-testid={`row-category-${category.id}`}><span className="font-medium text-[#29445f]">{category.name}</span><div className="flex gap-2"><button onClick={() => { setCategoryName(category.name); setEditingCategory(category.id); }} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold" data-testid={`button-edit-category-${category.id}`}>Cambiar nombre</button><button onClick={() => { if (window.confirm(`¿Quitar «${category.name}»?`)) deleteCategory.mutate({ categoryId: category.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/l4/categories'] }) }); }} className="rounded-full bg-[#f8e8e4] px-3 py-1.5 text-xs font-semibold text-[#a44236]" data-testid={`button-delete-category-${category.id}`}>Quitar</button></div></div>)}</div></AdminListState>}
    {tab === 'highlights' && <AdminListState loading={requests.isLoading} error={requests.isError} retry={() => requests.refetch()} empty={!requests.data?.length} title="Aún no hay solicitudes de destacados." detail="Aquí aparecerán las solicitudes que envíen los vendedores."><div className="space-y-3">{(requests.data ?? []).map((request) => <article key={request.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center" data-testid={`card-feature-request-${request.id}`}><div><span className="rounded-full bg-[#eaf4df] px-3 py-1 text-xs font-bold text-[#52743a]">{reviewRequestStatus(request.status)}</span><h3 className="mt-2 font-serif text-xl font-semibold text-[#29445f]">{request.productName}</h3><p className="mt-1 text-sm text-muted-foreground">De {request.sellerName} · {fmtMoney(request.price)}</p>{request.receiptUrl && <a href={request.receiptUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#52743a]" data-testid={`link-receipt-${request.id}`}><FileImage size={13} />Ver comprobante</a>}</div><button onClick={() => approveRequest(request.id)} disabled={request.status !== 'pending' || approve.isPending} className="rounded-full bg-[#2d4a67] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-45" data-testid={`button-approve-feature-${request.id}`}>{request.status === 'pending' ? 'Aprobar destacado' : reviewRequestStatus(request.status)}</button></article>)}</div></AdminListState>}
    {tab === 'highlights' && <section className="mt-6"><h2 className="mb-3 font-serif text-2xl font-semibold text-[#29445f]">Avisos destacados activos</h2>{products.isLoading ? <LoadingPanel /> : products.isError ? <StatePanel title="No pudimos cargar los avisos." detail="Inténtalo de nuevo para administrar los destacados." retry={() => products.refetch()} /> : !products.data?.length ? <StatePanel title="Todavía no hay avisos para destacar." detail="Cuando los residentes publiquen productos, podrás destacarlos aquí." /> : <div className="space-y-2">{products.data.map((product) => <div key={product.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center" data-testid={`row-highlight-product-${product.id}`}><div><p className="font-semibold text-[#29445f]">{product.title}</p><p className="mt-1 text-xs text-muted-foreground">{product.sellerName} · {product.categoryName}</p></div><button onClick={() => toggleProductFeatured(product.id, product.featured)} disabled={setFeatured.isPending} className={`rounded-full px-4 py-2 text-xs font-bold ${product.featured ? 'bg-[#f5eedb] text-[#866c30]' : 'bg-[#eaf4df] text-[#52743a]'}`} data-testid={`button-toggle-feature-${product.id}`}>{product.featured ? 'Quitar destacado' : 'Agregar destacado'}</button></div>)}</div>}</section>}
    {tab === 'reviews' && <AdminListState loading={products.isLoading} error={products.isError} retry={() => products.refetch()} empty={!products.data?.length} title="Todavía no hay conversaciones de productos." detail="Aquí aparecerán las opiniones de productos publicadas para moderación."><div className="space-y-4">{(products.data ?? []).map((product) => <AdminReviewModeration key={product.id} productId={product.id} productName={product.title} />)}</div></AdminListState>}
    {tab === 'settings' && <div className="max-w-2xl rounded-[1.5rem] border border-border bg-card p-6 sm:p-8"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#638049]">Espacios destacados</p><h2 className="mt-1 font-serif text-2xl font-semibold text-[#29445f]">Pagos y precios</h2><p className="mt-2 text-sm text-muted-foreground">Los cambios aplican a nuevas solicitudes. El teléfono de pago se mostrará a los vendedores.</p></div>{settings.isError ? <StatePanel title="No se pudieron cargar los ajustes." detail="Verifica tu sesión de administración e inténtalo de nuevo." retry={() => settings.refetch()} /> : <form onSubmit={saveSettings} className="space-y-4"><label className="block text-sm font-semibold">Precio del destacado (S/)<input type="number" min="1" step="0.01" value={settingsDraft.featuredPrice || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, featuredPrice: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal" data-testid="input-featured-price" /></label><label className="block text-sm font-semibold">Teléfono para pagos Yape o Plin<input value={settingsDraft.paymentPhone} onChange={(e) => setSettingsDraft({ ...settingsDraft, paymentPhone: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal" data-testid="input-payment-phone" /></label><label className="block text-sm font-semibold">Duración del destacado en horas<input type="number" min="1" max="168" value={settingsDraft.featuredDurationHours || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, featuredDurationHours: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal" data-testid="input-featured-duration" /></label><p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground" data-testid="text-sheet-status">Conexión con hoja de cálculo: {settings.data?.sheetConfigured ? 'Configurada' : 'No configurada'}</p><button disabled={updateSettings.isPending || settingsDraft.featuredPrice < 1 || settingsDraft.featuredDurationHours < 1} className="rounded-full bg-[#2d4a67] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" data-testid="button-save-admin-settings">{updateSettings.isPending ? 'Guardando…' : 'Guardar ajustes'}</button></form>}</div>}
  </div>;
}

function AdminListState({ loading, error, retry, empty, title, detail, children }: { loading: boolean; error: boolean; retry: () => void; empty: boolean; title: string; detail: string; children: ReactNode }) {
  if (loading) return <LoadingPanel />;
  if (error) return <StatePanel title="No pudimos cargar esta lista." detail="El servicio de administración no respondió. Inténtalo de nuevo." retry={retry} />;
  if (empty) return <><StatePanel title={title} detail={detail} />{children}</>;
  return <div>{children}</div>;
}

function AdminReviewModeration({ productId, productName }: { productId: string; productName: string }) {
  const reviews = useListProductReviews(productId);
  const deleteReview = useDeleteReview();
  const queryClient = useQueryClient();
  return <section className="rounded-2xl border border-border bg-card p-5" data-testid={`section-reviews-${productId}`}>
    <h2 className="font-semibold text-[#29445f]">{productName}</h2>
    {reviews.isLoading && <p className="mt-2 text-sm text-muted-foreground">Cargando opiniones…</p>}
    {reviews.isError && <p className="mt-2 text-sm text-destructive" role="alert">No pudimos cargar las opiniones.</p>}
    {!reviews.isLoading && !reviews.isError && !reviews.data?.length && <p className="mt-2 text-sm text-muted-foreground">Este aviso todavía no tiene opiniones.</p>}
    <div className="mt-3 space-y-2">{(reviews.data ?? []).map((review: Review) => <div key={review.id} className="flex flex-col justify-between gap-3 rounded-xl bg-muted/60 p-3 sm:flex-row sm:items-start" data-testid={`row-comment-${review.id}`}><div><p className="text-xs font-bold text-[#52743a]">{review.authorName} · {review.rating}/5</p><p className="mt-1 text-sm leading-5 text-foreground">{review.comment}</p></div><button onClick={() => { if (window.confirm('¿Quitar esta opinión del aviso?')) deleteReview.mutate({ reviewId: review.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/l4/products/${productId}/reviews`] }) }); }} disabled={deleteReview.isPending} className="shrink-0 rounded-full bg-[#f8e8e4] px-3 py-2 text-xs font-bold text-[#a44236]" data-testid={`button-delete-comment-${review.id}`}>Eliminar opinión</button></div>)}</div>
  </section>;
}

function Field({ label, value, onChange, testId, required }: { label: string; value: string; onChange: (value: string) => void; testId: string; required?: boolean }) {
  return <label className="block text-sm font-semibold text-[#29445f]">{label}<input required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal outline-none transition focus:border-[#84b63b]" data-testid={testId} /></label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[1.3rem] border border-border bg-card p-5" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">{label}</p><p className="mt-2 font-serif text-3xl font-semibold text-[#29445f]" data-testid={`text-metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p></div>;
}

function LoadingPanel() {
  return <div className="animate-pulse rounded-[1.5rem] border border-border bg-card p-7" aria-label="Cargando"><div className="h-5 w-40 rounded bg-muted" /><div className="mt-4 h-3 w-3/4 rounded bg-muted" /><div className="mt-2 h-3 w-1/2 rounded bg-muted" /><div className="mt-7 h-20 rounded-2xl bg-muted" /></div>;
}

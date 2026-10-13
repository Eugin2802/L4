import { setBaseUrl } from '../../../lib/api-client-react/src/custom-fetch';
import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Marketplace from '@/pages/marketplace';
import { AdminPage, OrdersPage, ProfilePage, RegistrationGate, SellerListingsPage, SellerPage } from '@/pages/community';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Redirect } from 'wouter';

const apiUrl = import.meta.env.VITE_API_URL || 'https://l4-condominio-api.onrender.com';
setBaseUrl(apiUrl);
const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const logoAsset = `${import.meta.env.BASE_URL}laureles-logo.png`;
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${logoAsset}`,
  },
  variables: {
    colorPrimary: '#2d4a67',
    colorForeground: '#29445f',
    colorMutedForeground: '#748070',
    colorDanger: '#b84d42',
    colorBackground: '#fffefa',
    colorInput: '#faf9f4',
    colorInputForeground: '#29445f',
    colorNeutral: '#d9dfd3',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffefa] rounded-[1.5rem] w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#29445f] font-semibold',
    headerSubtitle: 'text-[#748070]',
    socialButtonsBlockButtonText: 'text-[#29445f] font-semibold',
    formFieldLabel: 'text-[#29445f] font-semibold',
    footerActionLink: 'text-[#52743a] font-semibold',
    footerActionText: 'text-[#748070]',
    dividerText: 'text-[#748070]',
    identityPreviewEditButton: 'text-[#52743a]',
    formFieldSuccessText: 'text-[#52743a]',
    alertText: 'text-[#9e4036]',
    logoBox: 'rounded-xl overflow-hidden',
    logoImage: 'object-cover',
    socialButtonsBlockButton: 'rounded-xl border-[#d9dfd3]',
    formButtonPrimary: 'rounded-full bg-[#2d4a67] text-white shadow-none',
    formFieldInput: 'rounded-xl border-[#d9dfd3] bg-[#faf9f4] text-[#29445f]',
    footerAction: 'text-[#748070]',
    dividerLine: 'bg-[#d9dfd3]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-lg border-[#d9dfd3]',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};
const spanishClerkLocalization = {
  socialButtonsBlockButton: 'Continuar con {{provider}}',
  dividerText: 'o',
  formFieldLabel__emailAddress: 'Correo electrónico',
  formFieldLabel__username: 'Nombre de usuario',
  formFieldLabel__password: 'Contraseña',
  formFieldLabel__phoneNumber: 'Teléfono',
  formFieldAction__forgotPassword: '¿Olvidaste tu contraseña?',
  formButtonPrimary: 'Continuar',
  signIn: {
    start: {
      title: 'Qué bueno verte, vecino',
      subtitle: 'Ingresa a tu comunidad de Laureles 4',
      actionText: '¿No tienes una cuenta?',
      actionLink: 'Regístrate',
    },
    password: {
      title: 'Ingresa tu contraseña',
      subtitle: 'Continúa a tu comunidad de Laureles 4',
      actionLink: 'Usar otro método',
    },
    emailCode: {
      title: 'Revisa tu correo',
      subtitle: 'Te enviamos un código de acceso',
      formButtonPrimary: 'Continuar',
      resendButton: 'Enviar otro código',
    },
    forgotPassword: {
      title: 'Restablece tu contraseña',
      subtitle: 'Te enviaremos instrucciones a tu correo',
      formButtonPrimary: 'Enviar instrucciones',
    },
  },
  signUp: {
    start: {
      title: 'Pasa, estás en casa',
      subtitle: 'Crea tu cuenta privada de L4',
      actionText: '¿Ya tienes una cuenta?',
      actionLink: 'Ingresa',
    },
    emailCode: {
      title: 'Confirma tu correo',
      subtitle: 'Ingresa el código que te enviamos',
      formButtonPrimary: 'Crear cuenta',
      resendButton: 'Enviar otro código',
    },
  },
} as const;

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (previousId.current !== undefined && previousId.current !== id) client.clear();
      previousId.current = id;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><div className="w-full max-w-xl"><div className="mb-6 text-center"><img src={logoAsset} alt="Logo de Laureles 4" className="mx-auto h-16 w-16 rounded-2xl object-cover object-top" /><p className="mt-3 font-serif text-2xl font-semibold text-[#29445f]">Bienvenido a casa, L4</p></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/register`} /></div></div>;
}

function SignUpPage() {
  const consent = sessionStorage.getItem('l4_registration_consent');
  if (!consent) return <Redirect to="/register" />;
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><div className="w-full max-w-xl"><div className="mb-6 text-center"><img src={logoAsset} alt="Logo de Laureles 4" className="mx-auto h-16 w-16 rounded-2xl object-cover object-top" /><p className="mt-3 font-serif text-2xl font-semibold text-[#29445f]">Tu cuenta L4 empieza aquí</p></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/profile`} /></div></div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Marketplace /></Show><Show when="signed-out"><Marketplace /></Show></>;
}

function RoutedErrorBoundary({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  return <ErrorBoundary resetKey={resetKey}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={spanishClerkLocalization as any}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/register" component={RegistrationGate} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/orders" component={OrdersPage} />
          <Route path="/seller" component={SellerPage} />
          <Route path="/seller/listings" component={SellerListingsPage} />
          <Route path="/admin" component={AdminPage} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;

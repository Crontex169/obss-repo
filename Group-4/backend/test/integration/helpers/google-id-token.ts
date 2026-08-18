import { SignJWT, exportJWK, generateKeyPair } from 'jose';

// US3 (Faz 7): Google OAuth testlerinde gercek Google sunucusuna gidilmez.
// Google id-token'ini kendi test anahtarimizla imzalar, Google'in JWKS
// endpoint'ini (https://www.googleapis.com/oauth2/v3/certs) globalThis.fetch
// seviyesinde bu anahtarin public kismina yonlendiririz (undici MockAgent bu
// Node surumunde native fetch'i yakalamadigi icin tercih edilmedi). Better
// Auth'un verifyGoogleIdToken'i (jose ile imza dogrulamasi) gercekten calisir;
// taklit edilen tek sey Google'in agi, dogrulama mantigi degil.
const KID = 'test-google-kid';
const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

let keyPairPromise: ReturnType<typeof generateKeyPair> | undefined;
function getKeyPair() {
  keyPairPromise ??= generateKeyPair('RS256');
  return keyPairPromise;
}

let installed = false;

export async function mockGoogleJwks(): Promise<void> {
  const { publicKey } = await getKeyPair();
  const jwk = await exportJWK(publicKey);
  const body = JSON.stringify({
    keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }],
  });

  if (installed) return;
  installed = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.startsWith(CERTS_URL)) {
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  };
}

export async function signFakeGoogleIdToken(params: {
  email: string;
  emailVerified?: boolean;
  sub?: string;
  name?: string;
}): Promise<string> {
  const { privateKey } = await getKeyPair();
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
    throw new Error('GOOGLE_CLIENT_ID ortam degiskeni test icin zorunludur');
  }

  return new SignJWT({
    email: params.email,
    email_verified: params.emailVerified ?? true,
    name: params.name ?? 'Test Google User',
    picture: 'https://example.com/avatar.png',
  })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer('https://accounts.google.com')
    .setAudience(audience)
    .setSubject(
      params.sub ??
        `google-sub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

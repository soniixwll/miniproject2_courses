// @vitest-environment node
//
// Run this file under Node, not jsdom. jose's webapi entry checks
// `payload instanceof Uint8Array`, which fails under jsdom because the
// realm-shimmed TextEncoder produces a Uint8Array from a different realm.
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";

// `server-only` throws when loaded outside a React Server Component context
// (Vitest's Node resolver picks the throwing entry). Stub it to a no-op.
vi.mock("server-only", () => ({}));

// Per-test cookie state. The closures inside `fakeCookies` capture these
// `let` bindings by reference, so reassigning in `beforeEach` resets cleanly.
let cookieStore: Map<string, string>;
let setCalls: Array<{ name: string; value: string; options: any }>;
let deleteCalls: string[];

const fakeCookies = {
  get: vi.fn((name: string) => {
    const v = cookieStore.get(name);
    return v !== undefined ? { name, value: v } : undefined;
  }),
  set: vi.fn((name: string, value: string, options: any) => {
    cookieStore.set(name, value);
    setCalls.push({ name, value, options });
  }),
  delete: vi.fn((name: string) => {
    cookieStore.delete(name);
    deleteCalls.push(name);
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => fakeCookies),
}));

// Import after mocks are registered. vi.mock is hoisted, but keeping this
// below makes the dependency order explicit to a reader.
import {
  createSession,
  getSession,
  deleteSession,
  verifySession,
} from "@/lib/auth";

const COOKIE_NAME = "auth-token";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-key"
);

beforeEach(() => {
  cookieStore = new Map();
  setCalls = [];
  deleteCalls = [];
  fakeCookies.get.mockClear();
  fakeCookies.set.mockClear();
  fakeCookies.delete.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// --------------------------- createSession ---------------------------

test("createSession sets the auth cookie with a JWT containing userId and email", async () => {
  await createSession("user-123", "alice@example.com");

  expect(setCalls).toHaveLength(1);
  expect(setCalls[0].name).toBe(COOKIE_NAME);
  expect(typeof setCalls[0].value).toBe("string");
  expect(setCalls[0].value.length).toBeGreaterThan(0);

  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(setCalls[0].value, JWT_SECRET);
  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("alice@example.com");
});

test("createSession sets httpOnly, sameSite=lax, path=/ on the cookie", async () => {
  await createSession("u", "e@e.com");

  const { options } = setCalls[0];
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession expires the cookie ~7 days from now", async () => {
  const before = Date.now();
  await createSession("u", "e@e.com");
  const after = Date.now();

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiresMs = (setCalls[0].options.expires as Date).getTime();

  // Allow a small fudge factor for the time the call took to execute.
  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession does not set the secure flag outside production", async () => {
  // Vitest defaults NODE_ENV to "test"; assert the conditional behaves.
  await createSession("u", "e@e.com");
  expect(setCalls[0].options.secure).toBe(false);
});

test("createSession sets the secure flag when NODE_ENV is production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await createSession("u", "e@e.com");
  expect(setCalls[0].options.secure).toBe(true);
});

// ----------------------------- getSession -----------------------------

test("getSession returns null when no auth cookie is present", async () => {
  expect(await getSession()).toBeNull();
});

test("getSession returns null when the cookie is not a valid JWT", async () => {
  cookieStore.set(COOKIE_NAME, "not-a-jwt");
  expect(await getSession()).toBeNull();
});

test("getSession returns null when the JWT was signed with a different secret", async () => {
  const wrongSecret = new TextEncoder().encode("definitely-not-the-real-secret");
  const token = await new SignJWT({ userId: "u", email: "e@e.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(wrongSecret);
  cookieStore.set(COOKIE_NAME, token);

  expect(await getSession()).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const past = Math.floor(Date.now() / 1000) - 60;
  const token = await new SignJWT({ userId: "u", email: "e@e.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(past)
    .setIssuedAt(past - 60)
    .sign(JWT_SECRET);
  cookieStore.set(COOKIE_NAME, token);

  expect(await getSession()).toBeNull();
});

test("getSession round-trips the data set by createSession", async () => {
  await createSession("user-42", "bob@example.com");

  const session = await getSession();
  expect(session).not.toBeNull();
  expect(session!.userId).toBe("user-42");
  expect(session!.email).toBe("bob@example.com");
});

// --------------------------- deleteSession ---------------------------

test("deleteSession removes the auth cookie", async () => {
  await deleteSession();
  expect(deleteCalls).toEqual([COOKIE_NAME]);
});

test("getSession returns null after createSession + deleteSession", async () => {
  await createSession("user-1", "a@b.c");
  expect(await getSession()).not.toBeNull();

  await deleteSession();
  expect(await getSession()).toBeNull();
});

// --------------------------- verifySession ---------------------------

function fakeRequest(cookieValue?: string) {
  return {
    cookies: {
      get: (name: string) =>
        name === COOKIE_NAME && cookieValue !== undefined
          ? { name, value: cookieValue }
          : undefined,
    },
  } as any;
}

test("verifySession returns null when the request has no auth cookie", async () => {
  expect(await verifySession(fakeRequest())).toBeNull();
});

test("verifySession returns null when the token is malformed", async () => {
  expect(await verifySession(fakeRequest("garbage"))).toBeNull();
});

test("verifySession returns null when the token is signed with the wrong secret", async () => {
  const token = await new SignJWT({ userId: "u", email: "e@e.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(new TextEncoder().encode("wrong-secret"));

  expect(await verifySession(fakeRequest(token))).toBeNull();
});

test("verifySession returns null for an expired token", async () => {
  const past = Math.floor(Date.now() / 1000) - 60;
  const token = await new SignJWT({ userId: "u", email: "e@e.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(past)
    .setIssuedAt(past - 60)
    .sign(JWT_SECRET);

  expect(await verifySession(fakeRequest(token))).toBeNull();
});

test("verifySession returns the payload for a valid token", async () => {
  const token = await new SignJWT({ userId: "user-9", email: "x@y.z" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  const session = await verifySession(fakeRequest(token));
  expect(session).not.toBeNull();
  expect(session!.userId).toBe("user-9");
  expect(session!.email).toBe("x@y.z");
});

test("verifySession reads from request.cookies (not the next/headers cookie store)", async () => {
  // Token lives only in the NextRequest, not in the global cookie store.
  const token = await new SignJWT({ userId: "from-request", email: "r@r.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  expect(cookieStore.has(COOKIE_NAME)).toBe(false);
  const session = await verifySession(fakeRequest(token));
  expect(session?.userId).toBe("from-request");
  // And confirm verifySession did not consult the next/headers store.
  expect(fakeCookies.get).not.toHaveBeenCalled();
});

/**
 * End-to-end API tests against a real Postgres and the real Fastify app (app.inject), with a
 * fake S3. They DROP and recreate the `public` schema, so point TEST_DATABASE_URL at a
 * throwaway database:
 *
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/microgig_test npm test
 *
 * Without TEST_DATABASE_URL the suite is skipped.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { startFakeS3 } from "../helpers/fake-s3.js";
import { makeZip } from "../helpers/zip.js";

const DB_URL = process.env.TEST_DATABASE_URL;
const PASSWORD = "Passw0rd!long";
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const ip = () => `10.${randomInt(255)}.${randomInt(255)}.${randomInt(1, 255)}`;

describe.skipIf(!DB_URL)("API integration", () => {
  let app: FastifyInstance;
  let s3: Awaited<ReturnType<typeof startFakeS3>>;
  let mod: {
    db: typeof import("../../src/db/connection.js");
    schema: typeof import("../../src/db/schema/index.js");
    cron: typeof import("../../src/lib/cron.js");
    notifications: typeof import("../../src/modules/notifications/notifications.service.js");
    orm: typeof import("drizzle-orm");
  };
  const logs: string[] = [];

  async function call(method: string, url: string, opts: { sid?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const res = await app.inject({
      method: method as "GET",
      url: `/api/v1${url}`,
      payload: opts.body as object | undefined,
      cookies: opts.sid ? { sid: opts.sid } : undefined,
      headers: { "x-forwarded-for": ip(), ...opts.headers },
    });
    let json: any = null;
    try { json = res.json(); } catch { /* not JSON */ }
    return { status: res.statusCode, json, res };
  }
  const sidOf = (res: { cookies: { name: string; value: string }[] }) => res.cookies.find((c) => c.name === "sid")?.value ?? "";
  const lastCode = (email: string) => {
    const hit = [...logs].reverse().find((l) => l.includes(`To: ${email}`) && /confirmation code is: \d{6}/.test(l));
    return hit?.match(/confirmation code is: (\d{6})/)?.[1];
  };

  async function signUp(email: string, accountType: "CLIENT" | "FREELANCER") {
    expect((await call("POST", "/auth/send-code", { body: { email } })).status).toBe(200);
    const code = lastCode(email);
    expect(code).toBeTruthy();
    const r = await call("POST", "/auth/register", { body: { email, password: PASSWORD, fullName: `Test ${accountType}`, accountType, code } });
    expect(r.status).toBe(201);
    return sidOf(r.res);
  }
  async function login(email: string, password: string) {
    const r = await call("POST", "/auth/login", { body: { email, password } });
    expect(r.status).toBe(200);
    return sidOf(r.res);
  }

  let admin = "", client = "", seller = "";
  let gig: { id: string; slug: string; priceCents: number };

  beforeAll(async () => {
    s3 = await startFakeS3();
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL: DB_URL,
      COOKIE_SECRET: "integration-test-cookie-secret-at-least-32-chars",
      WEB_ORIGIN: "http://localhost:3000",
      RESEND_API_KEY: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", REDIS_URL: "",
      S3_ENDPOINT: s3.endpoint, S3_REGION: "auto", S3_ACCESS_KEY_ID: "test", S3_SECRET_ACCESS_KEY: "test",
      S3_PRIVATE_BUCKET_NAME: "private", S3_PUBLIC_BUCKET_NAME: "public", STORAGE_PUBLIC_URL: "",
      PLATFORM_FEE_BPS: "2000", AUTO_COMPLETE_DELAY_HOURS: "72", REVISION_DEADLINE_HOURS: "24", CLEARING_PERIOD_DAYS: "3",
      ADMIN_PASSWORD: "Admin-Integration-1!", SEED_USER_PASSWORD: "",
    });
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(" ")); });

    const postgres = (await import("postgres")).default;
    const reset = postgres(DB_URL!, { max: 1, onnotice: () => {} });
    await reset.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await reset.end();

    mod = {
      db: await import("../../src/db/connection.js"),
      schema: await import("../../src/db/schema/index.js"),
      cron: await import("../../src/lib/cron.js"),
      notifications: await import("../../src/modules/notifications/notifications.service.js"),
      orm: await import("drizzle-orm"),
    };
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(mod.db.db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
    await (await import("../../src/db/seed.js")).seedDatabase();

    const { buildApp } = await import("../../src/app.js");
    app = await buildApp();
    await app.ready();

    admin = await login("admin@microgig.dev", "Admin-Integration-1!");
    client = await login("client@microgig.dev", "Client123!");
    seller = await login("seller@microgig.dev", "Seller123!");
    expect((await call("POST", "/wallet/topup", { sid: client, body: { amountCents: 100000 } })).status).toBe(200);
    const search = await call("GET", "/gigs");
    gig = search.json.gigs.find((g: { priceCents: number }) => g.priceCents <= 3000);
    expect(gig).toBeTruthy();
  });

  afterAll(async () => {
    await app?.close();
    await mod?.db.lockConnection.end();
    await s3?.close();
    vi.restoreAllMocks();
  });

  // ── #16 auth ────────────────────────────────────────────────────────────────

  describe("auth", () => {
    it("has no email-enumeration endpoint", async () => {
      expect((await call("POST", "/auth/check-email", { body: { email: "client@microgig.dev" } })).status).toBe(404);
    });

    it("answers send-code identically for new and existing emails, and never mails a code to an existing one", async () => {
      const fresh = await call("POST", "/auth/send-code", { body: { email: "nobody-yet@example.com" } });
      const taken = await call("POST", "/auth/send-code", { body: { email: "client@microgig.dev" } });
      expect(fresh.status).toBe(200);
      expect(taken.status).toBe(200);
      expect(taken.json).toEqual(fresh.json);
      expect(lastCode("client@microgig.dev")).toBeUndefined();
      expect(logs.some((l) => l.includes("To: client@microgig.dev") && l.includes("already has an account"))).toBe(true);
    });

    it("throttles resends to one a minute per email", async () => {
      expect((await call("POST", "/auth/send-code", { body: { email: "nobody-yet@example.com" } })).status).toBe(429);
    });

    it("stores only a hash of the code", async () => {
      const [row] = await mod.db.db.select().from(mod.schema.emailVerifications).where(mod.orm.eq(mod.schema.emailVerifications.email, "nobody-yet@example.com"));
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(row)).not.toContain(lastCode("nobody-yet@example.com"));
    });

    it("requires a code, has no master code, and burns the code after 5 wrong guesses", async () => {
      const email = "nobody-yet@example.com";
      const base = { email, password: PASSWORD, fullName: "Guesser", accountType: "CLIENT" };
      expect((await call("POST", "/auth/register", { body: base })).status).toBe(422);
      const real = lastCode(email)!;
      const wrong = real === "123456" ? "654321" : "123456";
      for (let i = 0; i < 5; i++) {
        expect((await call("POST", "/auth/register", { body: { ...base, code: wrong } })).status).toBe(422);
      }
      const late = await call("POST", "/auth/register", { body: { ...base, code: real } });
      expect(late.status).toBe(422);
      expect(late.json.error.message).toMatch(/too many wrong attempts/);
    });

    it("signs up with a valid code and marks the email verified", async () => {
      await signUp("new-client@example.com", "CLIENT");
      const [u] = await mod.db.db.select().from(mod.schema.users).where(mod.orm.eq(mod.schema.users.email, "new-client@example.com"));
      expect(u.emailVerified).toBe(true);
    });

    it("locks an account for 15 minutes after 5 failed logins", async () => {
      await signUp("lockme@example.com", "CLIENT");
      for (let i = 0; i < 5; i++) {
        expect((await call("POST", "/auth/login", { body: { email: "lockme@example.com", password: "wrong-Pass1!" } })).status).toBe(401);
      }
      const locked = await call("POST", "/auth/login", { body: { email: "lockme@example.com", password: PASSWORD } });
      expect(locked.status).toBe(429);
    });

    it("rate-limits login per ip + email (PRD 13.2)", async () => {
      const headers = { "x-forwarded-for": "203.0.113.7" };
      const attempt = (email: string) => call("POST", "/auth/login", { body: { email, password: "nope" }, headers });
      const statuses = [];
      for (let i = 0; i < 11; i++) statuses.push((await attempt("ratelimit@example.com")).status);
      expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(statuses[10]).toBe(429);
      expect((await attempt("someone-else@example.com")).status).toBe(401); // other email, same ip
    });

    it("logout-all revokes other sessions but keeps this one", async () => {
      const a = await login("new-client@example.com", PASSWORD);
      const b = await login("new-client@example.com", PASSWORD);
      expect((await call("POST", "/auth/logout-all", { sid: a })).status).toBe(204);
      expect((await call("GET", "/auth/me", { sid: a })).status).toBe(200);
      expect((await call("GET", "/auth/me", { sid: b })).status).toBe(401);
    });
  });

  // ── SEL-02 ──────────────────────────────────────────────────────────────────

  describe("SEL-02 verification gate", () => {
    it("hides an unverified seller's gig until an admin approves the ID", async () => {
      const newSeller = await signUp("fresh-seller@example.com", "FREELANCER");
      const created = await call("POST", "/gigs", {
        sid: newSeller,
        body: {
          title: "I will test the verification gate", category: "programming-tech", subcategory: "QA",
          description: "Gate test", priceCents: 1500, turnaroundHours: 24, revisionsIncluded: 1, tags: [], faqs: [],
          requirementsPrompt: ["What should I test?"],
        },
      });
      expect(created.status).toBe(201);
      const { id, slug } = created.json;

      const listed = async () => (await call("GET", "/gigs?search=verification%20gate")).json.gigs.some((g: { id: string }) => g.id === id);
      expect(await listed()).toBe(false);
      expect((await call("GET", `/gigs/${slug}`)).status).toBe(404);
      expect((await call("GET", `/gigs/${slug}`, { sid: newSeller })).status).toBe(200);
      expect((await call("POST", "/orders", { sid: client, body: { gigId: id } })).status).toBe(404);

      expect((await call("POST", "/me/seller-profile/submit", { sid: newSeller, body: { idDocumentType: "PASSPORT", documentReference: "X1234567" } })).status).toBe(200);
      const pending = (await call("GET", "/admin/verifications", { sid: admin })).json;
      const mine = pending.find((v: { email: string }) => v.email === "fresh-seller@example.com");
      expect((await call("PATCH", `/admin/verifications/${mine.id}`, { sid: admin, body: { status: "APPROVED" } })).status).toBe(200);
      expect(await listed()).toBe(true);
    });

    it("lets the owner edit the whole gig with PUT /gigs/:id", async () => {
      const own = (await call("GET", "/me/dashboard", { sid: seller })).json.gigs[0];
      const r = await call("PUT", `/gigs/${own.id}`, { sid: seller, body: { description: "Updated description", faqs: [{ question: "Q?", answer: "A." }] } });
      expect(r.status).toBe(200);
      expect((await call("GET", `/gigs/${own.slug}`)).json.description).toBe("Updated description");
      expect((await call("PUT", `/gigs/${own.id}`, { sid: client, body: { status: "PAUSED" } })).status).toBe(403);
    });
  });

  // ── Orders, deliveries (#9), idempotency, state machine (#13) ──────────────

  async function placeOrder(key = crypto.randomUUID()) {
    const r = await call("POST", "/orders", { sid: client, body: { gigId: gig.id }, headers: { "Idempotency-Key": key } });
    expect(r.status).toBe(201);
    const id = r.json.order.id as string;
    expect((await call("POST", `/orders/${id}/requirements`, { sid: client, body: { answers: ["Do it well"] } })).status).toBe(200);
    return id;
  }
  async function upload(orderId: string, name: string, contentType: string, body: Buffer) {
    const p = await call("POST", "/deliveries/presign-upload", { sid: seller, body: { filename: name, contentType, fileSize: body.length, orderId } });
    expect(p.status).toBe(200);
    expect(p.json.uploadUrl).not.toContain("x-amz-checksum");
    const put = await fetch(p.json.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body });
    expect(put.ok).toBe(true);
    return p.json.fileKey as string;
  }
  async function deliver(orderId: string, name: string, contentType: string, body: Buffer, hash = sha(body)) {
    const key = await upload(orderId, name, contentType, body);
    return call("POST", `/orders/${orderId}/deliveries`, { sid: seller, body: { fileName: name, fileSize: body.length, sha256: hash, storageKey: key, notes: "Here you go" } });
  }
  const balance = async (sid: string) => (await call("GET", "/wallet", { sid })).json.summary.available as number;

  describe("order lifecycle", () => {
    let orderId = "";
    let png: Buffer;

    it("places an order once per Idempotency-Key", async () => {
      const before = await balance(client);
      const key = crypto.randomUUID();
      const first = await call("POST", "/orders", { sid: client, body: { gigId: gig.id }, headers: { "Idempotency-Key": key } });
      const again = await call("POST", "/orders", { sid: client, body: { gigId: gig.id }, headers: { "Idempotency-Key": key } });
      expect(first.status).toBe(201);
      expect(again.status).toBe(201);
      expect(again.res.headers["idempotent-replayed"]).toBe("true");
      expect(again.json.order.id).toBe(first.json.order.id);
      expect(await balance(client)).toBe(before - gig.priceCents);

      const other = await call("POST", "/orders", { sid: client, body: { gigId: "different" }, headers: { "Idempotency-Key": key } });
      expect(other.status).toBe(422);
      orderId = first.json.order.id;
      expect(first.json.order.feeRateBps).toBe(2000);
      expect((await call("POST", `/orders/${orderId}/requirements`, { sid: client, body: { answers: ["Do it well"] } })).status).toBe(200);
    });

    it("verifies deliveries on the server: hash, type and existence", async () => {
      const sharp = (await import("sharp")).default;
      png = await sharp({ create: { width: 640, height: 400, channels: 3, background: "#3366cc" } }).png().toBuffer();

      const badHash = await deliver(orderId, "art.png", "image/png", png, "0".repeat(64));
      expect(badHash.status).toBe(422);
      expect(badHash.json.error.message).toMatch(/SHA-256/);

      const fake = Buffer.from("this is not really a png");
      const badType = await deliver(orderId, "fake.png", "image/png", fake);
      expect(badType.status).toBe(422);
      expect(badType.json.error.message).toMatch(/don't match its type/);

      const missing = await call("POST", `/orders/${orderId}/deliveries`, { sid: seller, body: { fileName: "x.png", fileSize: 10, sha256: "a".repeat(64), storageKey: `deliveries/${orderId}/nope/x.png`, notes: "" } });
      expect(missing.status).toBe(422);

      const ok = await deliver(orderId, "art.png", "image/png", png);
      expect(ok.status).toBe(201);
      expect(ok.json.order.status).toBe("DELIVERED");
    });

    it("locks the original for the buyer until completion but serves a watermarked preview", async () => {
      const ws = (await call("GET", `/orders/${orderId}`, { sid: client })).json.order;
      const d = ws.deliveries[0];
      expect(d.storageKey).toBeNull();
      expect(d.previewUrl).toBe(`/api/v1/deliveries/${d.id}/preview`);

      const preview = await call("GET", `/deliveries/${d.id}/preview`, { sid: client });
      expect(preview.status).toBe(200);
      expect(preview.res.headers["content-type"]).toBe("image/webp");
      expect(sha(preview.res.rawPayload)).not.toBe(sha(png));
      expect((await call("GET", `/deliveries/${d.id}/preview`, { sid: admin })).status).toBe(200);

      const sellerWs = (await call("GET", `/orders/${orderId}`, { sid: seller })).json.order;
      const key = sellerWs.deliveries[0].storageKey as string;
      expect(key).toMatch(/^deliveries\//);
      expect((await call("GET", `/deliveries/${encodeURIComponent(key)}/download`, { sid: client })).status).toBe(403);
      expect((await call("GET", `/deliveries/${encodeURIComponent(key)}/download`, { sid: seller })).status).toBe(200);
    });

    it("can't be mutually cancelled once delivered", async () => {
      expect((await call("POST", `/orders/${orderId}/cancel`, { sid: client })).status).toBe(409);
    });

    it("counts revisions atomically: two quick requests can't both pass", async () => {
      const body = { feedback: "Please make the blue a little darker overall." };
      const [a, b] = await Promise.all([
        call("POST", `/orders/${orderId}/revision`, { sid: client, body }),
        call("POST", `/orders/${orderId}/revision`, { sid: client, body }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const ws = (await call("GET", `/orders/${orderId}`, { sid: client })).json.order;
      expect(ws.revisionsUsed).toBe(1);
    });

    it("reads a ZIP's file tree on the server", async () => {
      const zip = makeZip({ "src/index.js": "console.log(1)", "README.md": "# hi" });
      const r = await deliver(orderId, "source.zip", "application/zip", zip);
      expect(r.status).toBe(201);
      expect(r.json.order.deliveries[1].fileTree).toEqual(["README.md", "src/index.js"]);
      expect(r.json.order.deliveries[1].kind).toBe("archive");
    });

    it("completes once per Idempotency-Key, then unlocks the download", async () => {
      const key = crypto.randomUUID();
      const sellerPendingBefore = (await call("GET", "/wallet", { sid: seller })).json.summary.pending;
      const a = await call("POST", `/orders/${orderId}/complete`, { sid: client, headers: { "Idempotency-Key": key } });
      const b = await call("POST", `/orders/${orderId}/complete`, { sid: client, headers: { "Idempotency-Key": key } });
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(b.res.headers["idempotent-replayed"]).toBe("true");
      const sellerPendingAfter = (await call("GET", "/wallet", { sid: seller })).json.summary.pending;
      expect(sellerPendingAfter - sellerPendingBefore).toBe(gig.priceCents - Math.floor((gig.priceCents * 2000 + 5000) / 10000));

      const ws = (await call("GET", `/orders/${orderId}`, { sid: client })).json.order;
      expect(ws.deliveries[0].storageKey).toMatch(/^deliveries\//);
      const dl = await call("GET", `/deliveries/${encodeURIComponent(ws.deliveries[0].storageKey)}/download`, { sid: client });
      expect(dl.status).toBe(200);
      expect(dl.json.downloadUrl).toContain("response-content-disposition=attachment");
    });

    it("accepts one review, within 14 days", async () => {
      expect((await call("POST", `/orders/${orderId}/review`, { sid: client, body: { rating: 5, body: "Great" } })).status).toBe(200);
      expect((await call("POST", `/orders/${orderId}/review`, { sid: client, body: { rating: 4 } })).status).toBe(409);

      const old = await placeOrder();
      await mod.db.db.update(mod.schema.orders).set({ status: "COMPLETED", completedAt: new Date(Date.now() - 15 * 86400_000) }).where(mod.orm.eq(mod.schema.orders.id, old));
      const late = await call("POST", `/orders/${old}/review`, { sid: client, body: { rating: 5 } });
      expect(late.status).toBe(409);
      expect(late.json.error.message).toMatch(/14 days/);
      // Put the ledger back in line with the status we forced (escrow -> seller).
      await mod.db.db.update(mod.schema.orders).set({ status: "CANCELLED" }).where(mod.orm.eq(mod.schema.orders.id, old));
      const { getOrCreateLedgerAccount } = mod.cron;
      await mod.db.db.transaction(async (tx) => {
        const escrow = await getOrCreateLedgerAccount(tx, "PLATFORM", "ESCROW");
        const buyer = await getOrCreateLedgerAccount(tx, (await tx.select().from(mod.schema.users).where(mod.orm.eq(mod.schema.users.email, "client@microgig.dev")))[0].id, "USER_AVAILABLE");
        const txnId = crypto.randomUUID();
        await tx.insert(mod.schema.ledgerEntries).values([
          { txnId, accountId: escrow.id, orderId: old, entryType: "ORDER_REFUNDED", amountCents: -gig.priceCents, description: "test cleanup" },
          { txnId, accountId: buyer.id, orderId: old, entryType: "ORDER_REFUNDED", amountCents: gig.priceCents, description: "test cleanup" },
        ]);
        await tx.update(mod.schema.ledgerAccounts).set({ balanceCents: mod.orm.sql`balance_cents - ${gig.priceCents}` }).where(mod.orm.eq(mod.schema.ledgerAccounts.id, escrow.id));
        await tx.update(mod.schema.ledgerAccounts).set({ balanceCents: mod.orm.sql`balance_cents + ${gig.priceCents}` }).where(mod.orm.eq(mod.schema.ledgerAccounts.id, buyer.id));
      });
    });
  });

  describe("cancellation and disputes", () => {
    it("mutual cancel works from IN_PROGRESS and refunds in full", async () => {
      const before = await balance(client);
      const id = await placeOrder();
      expect((await call("POST", `/orders/${id}/cancel`, { sid: client })).json.order.mutualCancelRequestedBy).toBe("buyer");
      expect((await call("POST", `/orders/${id}/cancel`, { sid: client })).status).toBe(409);
      const done = await call("POST", `/orders/${id}/cancel`, { sid: seller });
      expect(done.json.order.status).toBe("CANCELLED");
      expect(await balance(client)).toBe(before);
    });

    it("resolves a dispute exactly once and tells both parties", async () => {
      const id = await placeOrder();
      const reason = "The seller has not responded to any of my messages for two days now.";
      expect((await call("POST", `/orders/${id}/dispute`, { sid: client, body: { reason }, headers: { "Idempotency-Key": crypto.randomUUID() } })).status).toBe(200);

      const listed = (await call("GET", "/admin/disputes", { sid: admin })).json;
      expect(listed.find((d: { id: string }) => d.id === id)?.events.length).toBeGreaterThan(0);

      const ruling = { ruling: "SPLIT", buyerRefundBps: 5000, resolutionNotes: "Half each" };
      const [a, b] = await Promise.all([
        call("POST", `/admin/disputes/${id}/resolve`, { sid: admin, body: ruling }),
        call("POST", `/admin/disputes/${id}/resolve`, { sid: admin, body: ruling }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);

      const notes = await mod.db.db.select().from(mod.schema.notifications).where(mod.orm.and(mod.orm.eq(mod.schema.notifications.orderId, id), mod.orm.eq(mod.schema.notifications.type, "DISPUTE_RESOLVED")));
      expect(notes).toHaveLength(2);
    });
  });

  // ── Background jobs ────────────────────────────────────────────────────────

  describe("background jobs", () => {
    it("sends the 50% and 90% SLA warnings once each", async () => {
      const id = await placeOrder();
      // 24h order with 2h left: 91.7% elapsed.
      await mod.db.db.update(mod.schema.orders).set({ deadline: new Date(Date.now() + 2 * 3600_000) }).where(mod.orm.eq(mod.schema.orders.id, id));
      await mod.cron.sendSlaWarnings();
      await mod.cron.sendSlaWarnings();
      const warnings = await mod.db.db.select().from(mod.schema.notifications).where(mod.orm.and(mod.orm.eq(mod.schema.notifications.orderId, id), mod.orm.eq(mod.schema.notifications.type, "LATE_WARNING")));
      expect(warnings.map((w) => w.message.slice(0, 3)).sort()).toEqual(["50%", "90%"]);
    });

    it("sends one review reminder", async () => {
      await mod.cron.sendReviewReminders();
      await mod.cron.sendReviewReminders();
      const all = await mod.db.db.select().from(mod.schema.notifications).where(mod.orm.eq(mod.schema.notifications.type, "REVIEW_REMINDER"));
      const perOrder = new Map<string, number>();
      for (const n of all) perOrder.set(n.orderId!, (perOrder.get(n.orderId!) ?? 0) + 1);
      expect([...perOrder.values()].every((n) => n === 1)).toBe(true);
    });

    it("drains the email outbox (skipped without a provider)", async () => {
      let total = 0;
      for (let i = 0; i < 20; i++) {
        const r = await mod.notifications.dispatchPendingEmails();
        total += r.sent + r.failed + r.skipped;
        if (r.sent + r.failed + r.skipped === 0) break;
      }
      expect(total).toBeGreaterThan(0);
      const left = await mod.db.db.select().from(mod.schema.notifications).where(mod.orm.inArray(mod.schema.notifications.emailStatus, ["PENDING", "SENDING"]));
      expect(left).toHaveLength(0);
    });

    it("never runs the same job twice at once", async () => {
      let runs = 0;
      const job = async () => { runs++; await new Promise((r) => setTimeout(r, 300)); };
      const log = { error: () => {}, info: () => {} } as never;
      await Promise.all([mod.cron.withJobLock("test-job", log, job), mod.cron.withJobLock("test-job", log, job)]);
      expect(runs).toBe(1);
      await mod.cron.withJobLock("test-job", log, job); // the lock was released
      expect(runs).toBe(2);
    });

    it("keeps the ledger balanced", async () => {
      const audit = await mod.cron.runLedgerAudit();
      expect(audit.discrepancies.systemNonZeroSum).toBe(0);
      expect(audit.discrepancies.accountBalanceMismatches).toHaveLength(0);
      expect(audit.passed).toBe(true);
    });
  });

  // ── Smaller endpoints ──────────────────────────────────────────────────────

  describe("misc endpoints", () => {
    it("exports wallet activity as CSV", async () => {
      const r = await call("GET", "/wallet/activity?format=csv", { sid: client });
      expect(r.status).toBe(200);
      expect(r.res.headers["content-type"]).toContain("text/csv");
      expect(r.res.body.split("\r\n")[0]).toBe("Date,Description,Type,Amount (USD),Balance (USD),Transaction ID");
    });

    it("rejects invalid notification preferences", async () => {
      expect((await call("PUT", "/notification-prefs", { sid: client, body: { orderEmail: "yes" } })).status).toBe(422);
      expect((await call("PUT", "/notification-prefs", { sid: client, body: { orderEmail: false } })).json.orderEmail).toBe(false);
    });

    it("shows real unread counts in the inbox", async () => {
      const id = await placeOrder();
      expect((await call("POST", `/orders/${id}/messages`, { sid: client, body: { body: "Hello there" } })).status).toBe(200);
      const thread = (await call("GET", "/inbox", { sid: seller })).json.find((t: { orderId: string }) => t.orderId === id);
      expect(thread.unreadCount).toBe(1);
    });

    it("rate-limits messages per user (30/min)", async () => {
      const id = await placeOrder();
      const statuses: number[] = [];
      for (let i = 0; i < 31; i++) statuses.push((await call("POST", `/orders/${id}/messages`, { sid: seller, body: { body: `msg ${i}` } })).status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(30);
      expect(statuses[30]).toBe(429);
    });

    it("computes seller stats from real data", async () => {
      const { stats } = (await call("GET", "/me/dashboard", { sid: seller })).json;
      expect(stats.netEarningsCents).toBeGreaterThan(0);
      expect(stats.avgSellingPriceCents).toBe(gig.priceCents);
      expect(stats.completionRate).toBeGreaterThan(0);
      expect(stats.onTimeDeliveryRate).toBe(100);
    });
  });
});

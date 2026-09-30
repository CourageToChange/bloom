"use strict";

const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const ALLOWED_ALGORITHMS = Object.freeze(["RS256"]);
const CLOCK_TOLERANCE_SECONDS = 5;
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
const JWKS_COOLDOWN_MS = 30 * 1000;
const JWKS_TIMEOUT_MS = 5 * 1000;
const MAX_ASSERTION_LENGTH = 32 * 1024;

function accessConfigFromEnv(env = process.env) {
  const rawTeamDomain = String(env.ACCESS_TEAM_DOMAIN || "").trim();
  const audience = String(env.ACCESS_AUD || "").trim();

  if (!rawTeamDomain) throw new Error("ACCESS_TEAM_DOMAIN is required");
  if (!audience) throw new Error("ACCESS_AUD is required");
  if (audience.length > 1024) throw new Error("ACCESS_AUD is invalid");

  const candidate = rawTeamDomain.includes("://")
    ? rawTeamDomain
    : `https://${rawTeamDomain}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("ACCESS_TEAM_DOMAIN must be a Cloudflare Access team domain");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !parsed.hostname.endsWith(".cloudflareaccess.com") ||
    parsed.hostname === "cloudflareaccess.com"
  ) {
    throw new Error("ACCESS_TEAM_DOMAIN must be a Cloudflare Access team domain");
  }

  const issuer = parsed.origin;
  return Object.freeze({
    issuer,
    audience,
    jwksUrl: `${issuer}/cdn-cgi/access/certs`
  });
}

function createAccessJwtVerifier(config, options = {}) {
  if (!config || typeof config.issuer !== "string" || typeof config.audience !== "string") {
    throw new TypeError("A valid Access JWT configuration is required");
  }

  const josePromise = import("jose");
  let remoteJwks;

  async function getVerifierState() {
    const jose = await josePromise;
    if (!remoteJwks) {
      const remoteOptions = {
        cacheMaxAge: options.cacheMaxAgeMs ?? JWKS_CACHE_TTL_MS,
        cooldownDuration: options.cooldownDurationMs ?? JWKS_COOLDOWN_MS,
        timeoutDuration: options.timeoutDurationMs ?? JWKS_TIMEOUT_MS
      };
      if (options.fetch) remoteOptions[jose.customFetch] = options.fetch;
      remoteJwks = jose.createRemoteJWKSet(new URL(config.jwksUrl), remoteOptions);
    }
    return { jose, remoteJwks };
  }

  return async function verifyAccessJwt(assertion) {
    if (
      typeof assertion !== "string" ||
      assertion.length === 0 ||
      assertion.length > MAX_ASSERTION_LENGTH
    ) {
      throw new Error("Invalid Access JWT");
    }

    const { jose, remoteJwks: jwks } = await getVerifierState();
    let unverifiedHeader;
    try {
      unverifiedHeader = jose.decodeProtectedHeader(assertion);
    } catch {
      throw new Error("Invalid Access JWT");
    }
    if (
      !ALLOWED_ALGORITHMS.includes(unverifiedHeader.alg) ||
      typeof unverifiedHeader.kid !== "string" ||
      unverifiedHeader.kid.length === 0
    ) {
      throw new Error("Invalid Access JWT");
    }

    const { payload, protectedHeader } = await jose.jwtVerify(assertion, jwks, {
      algorithms: ALLOWED_ALGORITHMS,
      issuer: config.issuer,
      audience: config.audience,
      requiredClaims: ["exp", "nbf", "iat", "email"],
      clockTolerance: CLOCK_TOLERANCE_SECONDS
    });

    if (protectedHeader.alg !== "RS256") throw new Error("Invalid Access JWT");
    for (const claim of ["exp", "nbf", "iat"]) {
      if (typeof payload[claim] !== "number" || !Number.isFinite(payload[claim])) {
        throw new Error("Invalid Access JWT");
      }
    }

    const now = Date.now() / 1000;
    if (
      payload.iat > now + CLOCK_TOLERANCE_SECONDS ||
      payload.iat > payload.exp + CLOCK_TOLERANCE_SECONDS ||
      payload.nbf > payload.exp + CLOCK_TOLERANCE_SECONDS
    ) {
      throw new Error("Invalid Access JWT");
    }

    const email = normalizeEmail(payload.email);
    if (!email) throw new Error("Invalid Access JWT");

    return Object.freeze({ email, payload });
  };
}

function createAccessJwtMiddleware(verifyAccessJwt) {
  if (typeof verifyAccessJwt !== "function") {
    throw new TypeError("An Access JWT verifier is required");
  }

  return async function requireAccessJwt(req, res, next) {
    const assertion = req.headers[ACCESS_JWT_HEADER];
    if (typeof assertion !== "string" || assertion.length === 0) {
      return unauthorized(res);
    }

    try {
      req.accessUser = await verifyAccessJwt(assertion);
      return next();
    } catch {
      return unauthorized(res);
    }
  };
}

function unauthorized(res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(401).json({ ok: false, error: "Unauthorized." });
}

function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length < 3 || email.length > 254) return "";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
}

module.exports = {
  accessConfigFromEnv,
  createAccessJwtMiddleware,
  createAccessJwtVerifier
};

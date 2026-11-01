/** Parsed user-agent data the backend attaches to each session. */
export type SessionUserAgent = {
  browser?: { name?: string | null; version?: string | null } | null;
  os?: { name?: string | null; version?: string | null } | null;
  device?: {
    vendor?: string | null;
    model?: string | null;
    type?: string | null;
  } | null;
};

/**
 * A login session. `_id` is the backend's MD5 digest of the session token and
 * is the only handle the sign-out operation accepts.
 */
export type SecuritySession = {
  _id: string;
  isCurrent?: boolean;
  createAt?: string;
  updateAt?: string;
  createHost?: string | null;
  createIp?: string | null;
  updateIp?: string | null;
  updateGeoip?: { display?: string | null } | null;
  updateUa?: string | null;
  createUa?: string | null;
  updateUaInfo?: SessionUserAgent | null;
};

/** A registered WebAuthn authenticator, as serialized by `/home/security`. */
export type SecurityAuthenticator = {
  /** BSON `Binary` (or a string in some serialization paths). */
  credentialID: unknown;
  name?: string | null;
  credentialType?: string | null;
  credentialDeviceType?: string | null;
  authenticatorAttachment?: string | null;
  fmt?: string | null;
  regat?: number | null;
};

/** Body of `GET /home/security` with `Accept: application/json`. */
export type SecurityData = {
  sudoUid?: number | null;
  sessions: SecuritySession[];
  authenticators?: SecurityAuthenticator[];
  geoipProvider?: string | null;
};

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DEFAULT_PORT = 8787;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.split("=");
    return [key, value.join("=")];
  }),
);

if (args.has("--help") || args.has("-h")) {
  printHelp();
  process.exit(0);
}

const clientId = process.env.GOOGLE_CLIENT_ID ?? args.get("--client-id");
const clientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? args.get("--client-secret");
const port = parsePort(args.get("--port"));

if (!clientId || !clientSecret) {
  console.error(
    "Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or pass --client-id and --client-secret.",
  );
  process.exit(1);
}

const redirectUri = `http://127.0.0.1:${port}`;
const state = randomUUID();

const authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", DRIVE_SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");
authUrl.searchParams.set("state", state);

console.log(
  "Open this URL in your browser and complete the Google sign-in flow:\n",
);
console.log(authUrl.toString());
console.log(`\nListening for the OAuth callback on ${redirectUri} ...`);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", redirectUri);
    const returnedState = requestUrl.searchParams.get("state");
    const code = requestUrl.searchParams.get("code");
    const error = requestUrl.searchParams.get("error");

    if (error) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Google returned an error: ${error}\n`);
      throw new Error(`Google returned an error: ${error}`);
    }

    if (returnedState !== state) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("State mismatch. Aborting.\n");
      throw new Error("State mismatch. Aborting.");
    }

    if (!code) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Missing authorization code.\n");
      throw new Error("Missing authorization code.");
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.refresh_token) {
      const reason = [tokenPayload.error, tokenPayload.error_description]
        .filter(Boolean)
        .join(": ");
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Token exchange failed. Check your terminal for details.\n");
      throw new Error(
        `Token exchange failed (${tokenResponse.status}): ${reason || tokenResponse.statusText}`,
      );
    }

    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(
      "Authorization complete. You can close this tab and return to the terminal.\n",
    );

    console.log(
      "\nRefresh token minted successfully. Set these values in your API environment:\n",
    );
    console.log(`GOOGLE_CLIENT_ID="${clientId}"`);
    console.log(`GOOGLE_CLIENT_SECRET="${clientSecret}"`);
    console.log(`GOOGLE_REFRESH_TOKEN="${tokenPayload.refresh_token}"`);
    if (tokenPayload.expiry_date) {
      console.log(
        `GOOGLE_ACCESS_TOKEN_EXPIRES_AT="${tokenPayload.expiry_date}"`,
      );
    }
    console.log("\nRestart the API after updating the environment.");

    server.close(() => process.exit(0));
  } catch (error) {
    console.error(
      `\n${error instanceof Error ? error.message : String(error)}`,
    );
    server.close(() => process.exit(1));
  }
});

server.listen(port, "127.0.0.1");

function parsePort(value) {
  if (!value) return DEFAULT_PORT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.error(`Invalid port: ${value}`);
    process.exit(1);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  pnpm gdrive:token
  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... pnpm gdrive:token
  pnpm gdrive:token --client-id=... --client-secret=... --port=8787

This script starts a local loopback server for a Google Desktop App OAuth flow
and prints a fresh GOOGLE_REFRESH_TOKEN for the configured client.

Options:
  --client-id       Override GOOGLE_CLIENT_ID
  --client-secret   Override GOOGLE_CLIENT_SECRET
  --port            Loopback port to listen on (default: 8787)
  --help, -h        Show this help text
`);
}

import { Client, Account, Users } from "node-appwrite";

// Server-only client using the project API key (scopes: project, auth,
// storage, functions, messaging, proxy). Never import this file from a
// "use client" component — the API key must never reach the browser.
function createServerClient() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY environment variables"
    );
  }

  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
}

export function createServerUsers() {
  return new Users(createServerClient());
}

function createPublicClient() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;

  if (!endpoint || !projectId) {
    throw new Error(
      "Missing APPWRITE_ENDPOINT or APPWRITE_PROJECT_ID environment variables"
    );
  }

  return new Client().setEndpoint(endpoint).setProject(projectId);
}

// For creating a session during login/signup (email+password), before any
// session cookie exists yet.
export function createPublicAccount() {
  return new Account(createPublicClient());
}

// For validating a session token sent from the client (e.g. a cookie),
// use a client scoped to that session rather than the API-key client above.
export function createSessionClient(sessionSecret: string) {
  const client = createPublicClient().setSession(sessionSecret);
  return new Account(client);
}

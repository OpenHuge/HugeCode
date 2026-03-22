import { generateKeyPairSync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Generate RSA keypair for JWT signing
 * Run with: pnpm generate:keys
 */
async function generateKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  // Create .keys directory if it doesn't exist
  const keysDir = join(process.cwd(), ".keys");
  await mkdir(keysDir, { recursive: true });

  // Write keys to files
  const privatePath = join(keysDir, "private.pem");
  const publicPath = join(keysDir, "public.pem");

  await writeFile(privatePath, privateKey, "utf8");
  await writeFile(publicPath, publicKey, "utf8");
}

generateKeys().catch((error) => {
  process.exit(1);
});

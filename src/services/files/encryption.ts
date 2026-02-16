import "dotenv/config";
import { createMessage, encrypt, readKey } from "openpgp";
import { readFile, writeFile, rename } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { logger } from "../log";

const { ENCRYPTION_ENABLED, ENCRYPTION_PUBLIC_KEY_PATH } = process.env;

const ENCRYPTION_ENABLED_BOOL = ENCRYPTION_ENABLED === 'true';

export function IsEncryptionEnabled(): boolean {
	return ENCRYPTION_ENABLED_BOOL;
}

export async function EncryptFile(filePath: string): Promise<void> {
	const publicKeyContent = await readFile(ENCRYPTION_PUBLIC_KEY_PATH, 'utf-8');
	
	const publicKey = await readKey({ armoredKey: publicKeyContent });

	logger.debug(`Encrypting file ${filePath}...`);	

	// Use streaming to handle large files without loading them entirely into memory
	const nodeReadStream = createReadStream(filePath);
	// Convert Node.js stream to WebStream (required by openpgp v6+)
	const webReadStream = Readable.toWeb(nodeReadStream) as ReadableStream<Uint8Array>;
	const tempFilePath = `${filePath}.tmp`;
	const writeStream = createWriteStream(tempFilePath);

	const encryptedStream = await encrypt({
		message: await createMessage({ binary: webReadStream }),
		encryptionKeys: publicKey,
		format: 'armored'
	});

	logger.debug(`File ${filePath} encrypted successfully, writing to temporary file...`);

	// Convert WebStream back to Node.js stream for pipeline
	const nodeEncryptedStream = Readable.fromWeb(encryptedStream as import("stream/web").ReadableStream);

	// Pipe the encrypted stream to the output file
	await pipeline(nodeEncryptedStream, writeStream);

	// Replace the original file with the encrypted one
	await rename(tempFilePath, filePath);

	logger.debug(`File ${filePath} overwritten with encrypted content.`);
}
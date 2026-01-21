import "dotenv/config";
import { createMessage, encrypt, readKey } from "openpgp";
import { readFile, writeFile, rename } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
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
	const readStream = createReadStream(filePath);
	const tempFilePath = `${filePath}.tmp`;
	const writeStream = createWriteStream(tempFilePath);

	const encryptedStream = await encrypt({
		message: await createMessage({ binary: readStream }),
		encryptionKeys: publicKey,
		format: 'armored'
	});

	logger.debug(`File ${filePath} encrypted successfully, writing to temporary file...`);

	// Pipe the encrypted stream to the output file
	await pipeline(encryptedStream, writeStream);

	// Replace the original file with the encrypted one
	await rename(tempFilePath, filePath);

	logger.debug(`File ${filePath} overwritten with encrypted content.`);
}
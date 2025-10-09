import "dotenv/config";
import { createMessage, encrypt, readKey } from "openpgp";
import { readFile, writeFile } from "node:fs/promises";
import { logger } from "../log";

const { ENCRYPTION_ENABLED, ENCRYPTION_PUBLIC_KEY_PATH, ENCRYPTION_PRIVATE_KEY_PATH, ENCRYPTION_PRIVATE_KEY_PASSPHRASE } = process.env;

const ENCRYPTION_ENABLED_BOOL = ENCRYPTION_ENABLED === 'true';

export function IsEncryptionEnabled(): boolean {
	return ENCRYPTION_ENABLED_BOOL;
}

export async function EncryptFile(filePath: string): Promise<void> {
	const publicKeyContent = await readFile(ENCRYPTION_PUBLIC_KEY_PATH, 'utf-8');
	
	const publicKey = await readKey({ armoredKey: publicKeyContent });

	logger.debug(`Encrypting file ${filePath}...`);	

	const encrypted = await encrypt({
		message: await createMessage({ binary: await readFile(filePath) }),
		encryptionKeys: publicKey,
		format: 'armored'
	});

	logger.debug(`File ${filePath} encrypted successfully, overwriting original file...`);
	
	await writeFile(filePath, encrypted, 'utf-8');

	logger.debug(`File ${filePath} overwritten with encrypted content.`);
}
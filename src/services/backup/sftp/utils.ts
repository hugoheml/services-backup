import "dotenv/config";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";
import SftpClient from "ssh2-sftp-client";
import * as fs from "fs";
import { logger } from "../../log";

const TMP_DIR = process.env.TMP_DIR || "/tmp";

export const SFTP_BACKUP_TMP_ROOT = join(TMP_DIR, "sftp-backup");
mkdirSync(SFTP_BACKUP_TMP_ROOT, { recursive: true });

const {
	SFTP_BACKUP_NAME,
	SFTP_BACKUP_HOST,
	SFTP_BACKUP_PORT,
	SFTP_BACKUP_USER,
	SFTP_BACKUP_PASSWORD,
	SFTP_BACKUP_PRIVATE_KEY_PATH,
	SFTP_BACKUP_PASSPHRASE,
	SFTP_BACKUP_PATH,
	SFTP_BACKUP_FOLDERS,
	SFTP_BACKUP_CONCURRENCY
} = process.env;

const DEFAULT_CONCURRENCY = 4;

export type SftpBackupTarget = {
	name: string;
	host: string;
	port: number;
	user: string;
	path: string;
	folders?: string[];
	auth:
		| { type: "key"; privateKeyPath: string; passphrase?: string }
		| { type: "password"; password: string };
};

export function loadSftpBackupTarget(): SftpBackupTarget | undefined {
	if (!SFTP_BACKUP_HOST || !SFTP_BACKUP_PATH || !SFTP_BACKUP_USER) {
		return undefined;
	}

	let auth: SftpBackupTarget["auth"];
	if (SFTP_BACKUP_PRIVATE_KEY_PATH) {
		auth = {
			type: "key",
			privateKeyPath: SFTP_BACKUP_PRIVATE_KEY_PATH.trim(),
			passphrase: SFTP_BACKUP_PASSPHRASE?.trim() || undefined
		};
	} else if (SFTP_BACKUP_PASSWORD) {
		auth = { type: "password", password: SFTP_BACKUP_PASSWORD };
	} else {
		throw new Error("SFTP backup auth not configured: set SFTP_BACKUP_PASSWORD or SFTP_BACKUP_PRIVATE_KEY_PATH");
	}

	const port = SFTP_BACKUP_PORT ? Number(SFTP_BACKUP_PORT) : 22;

	const folders = SFTP_BACKUP_FOLDERS
		? SFTP_BACKUP_FOLDERS.split(",").map((f) => f.trim()).filter(Boolean)
		: undefined;

	return {
		name: SFTP_BACKUP_NAME?.trim() || SFTP_BACKUP_HOST.trim(),
		host: SFTP_BACKUP_HOST.trim(),
		port: Number.isFinite(port) && port > 0 ? port : 22,
		user: SFTP_BACKUP_USER.trim(),
		path: SFTP_BACKUP_PATH.trim(),
		folders,
		auth
	};
}

export function sanitizeName(value: string) {
	return value
		.trim()
		.replace(/[^a-zA-Z0-9-_]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "") || "sftp-backup";
}

export function buildTimestamp(date: Date) {
	return date.toISOString().replace(/:/g, "-").split(".")[0].replace("T", "-");
}

async function createSftpClient(target: SftpBackupTarget): Promise<SftpClient> {
	const client = new SftpClient();

	const config: any = {
		host: target.host,
		port: target.port,
		username: target.user
	};

	if (target.auth.type === "key") {
		try {
			config.privateKey = fs.readFileSync(target.auth.privateKeyPath, "utf8");
			if (target.auth.passphrase) {
				config.passphrase = target.auth.passphrase;
			}
		} catch (error) {
			throw new Error(`Failed to read SSH private key from ${target.auth.privateKeyPath}: ${error}`);
		}
	} else {
		config.password = target.auth.password;
	}

	await client.connect(config);
	return client;
}

function safeRemove(pathToRemove: string, options: { recursive?: boolean } = {}) {
	try {
		rmSync(pathToRemove, { force: true, ...options });
	} catch {
		// Ignore cleanup errors
	}
}

async function createTarArchive(workingDirectory: string, archivePath: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const child = spawn("tar", ["-czf", archivePath, "-C", workingDirectory, "."], {
			stdio: ["ignore", "pipe", "pipe"]
		});

		let stderr = "";
		child.stderr?.on("data", (data) => { stderr += data.toString(); });

		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`tar exited with code ${code}. ${stderr.trim()}`));
			}
		});

		child.on("error", reject);
	});
}

export async function listRemoteItems(target: SftpBackupTarget, remotePath: string): Promise<string[]> {
	const client = await createSftpClient(target);
	try {
		const items = await client.list(remotePath);
		return items.map((item) => item.name);
	} finally {
		await client.end();
	}
}

async function listRemoteFilesRecursive(
	client: SftpClient,
	remotePath: string,
	baseRemotePath: string
): Promise<Array<{ remotePath: string; relativePath: string }>> {
	const items = await client.list(remotePath);

	const files = items
		.filter((item) => item.type !== "d")
		.map((item) => {
			const itemRemotePath = `${remotePath}/${item.name}`;
			return { remotePath: itemRemotePath, relativePath: itemRemotePath.slice(baseRemotePath.length + 1) };
		});

	const subResults = await Promise.all(
		items
			.filter((item) => item.type === "d")
			.map((dir) => listRemoteFilesRecursive(client, `${remotePath}/${dir.name}`, baseRemotePath))
	);

	return [...files, ...subResults.flat()];
}

async function downloadDirParallel(
	target: SftpBackupTarget,
	remotePath: string,
	localPath: string,
	concurrency: number
): Promise<void> {
	const listClient = await createSftpClient(target);
	let files: Array<{ remotePath: string; relativePath: string }>;
	try {
		files = await listRemoteFilesRecursive(listClient, remotePath, remotePath);
	} finally {
		await listClient.end();
	}

	if (files.length === 0) return;

	for (const file of files) {
		mkdirSync(dirname(join(localPath, file.relativePath)), { recursive: true });
	}

	logger.info(`[sftp-backup] Downloading ${files.length} files with concurrency=${concurrency}`);

	const actualConcurrency = Math.min(concurrency, files.length);
	const clients = await Promise.all(
		Array.from({ length: actualConcurrency }, () => createSftpClient(target))
	);

	let index = 0;
	try {
		await Promise.all(
			clients.map(async (client) => {
				while (true) {
					const fileIndex = index++;
					if (fileIndex >= files.length) break;
					const file = files[fileIndex];
					await client.fastGet(file.remotePath, join(localPath, file.relativePath));
				}
			})
		);
	} finally {
		await Promise.all(clients.map((c) => c.end().catch(() => {})));
	}
}

export async function downloadAndArchive(
	target: SftpBackupTarget,
	remotePath: string,
	itemName?: string
) {
	const sanitizedName = itemName ? sanitizeName(itemName) : sanitizeName(target.name);
	const date = new Date();
	const timestamp = buildTimestamp(date);

	const workingDirectory = join(SFTP_BACKUP_TMP_ROOT, `${sanitizedName}-${timestamp}`);
	const archiveName = `${sanitizedName}-${timestamp}.tar.gz`;
	const archivePath = join(SFTP_BACKUP_TMP_ROOT, archiveName);

	mkdirSync(workingDirectory, { recursive: true });

	const concurrency = SFTP_BACKUP_CONCURRENCY ? Number(SFTP_BACKUP_CONCURRENCY) : DEFAULT_CONCURRENCY;

	const client = await createSftpClient(target);
	let isDirectory = false;
	try {
		logger.info(`[sftp-backup] Downloading "${remotePath}" from ${target.host}.`);
		const stat = await client.stat(remotePath);
		isDirectory = stat.isDirectory;

		if (!isDirectory) {
			const localFilePath = join(workingDirectory, itemName || remotePath.split("/").pop() || "file");
			await client.fastGet(remotePath, localFilePath);
		}
	} finally {
		await client.end();
	}

	if (isDirectory) {
		await downloadDirParallel(target, remotePath, workingDirectory, concurrency);
	}

	try {
		logger.info(`[sftp-backup] Creating archive for "${sanitizedName}".`);
		await createTarArchive(workingDirectory, archivePath);

		const size = statSync(archivePath).size;
		logger.info(`[sftp-backup] Backup for "${sanitizedName}" completed.`);

		return { archivePath, archiveName, sanitizedName, timestamp, size, date };
	} catch (error) {
		safeRemove(archivePath);
		throw error;
	} finally {
		safeRemove(workingDirectory, { recursive: true });
	}
}

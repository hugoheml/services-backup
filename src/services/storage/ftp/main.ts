import { Client } from "basic-ftp";
import { statSync } from "node:fs";
import { StorageClass } from "../StorageClass";
import { logger } from "../../log";
import { convertToIP } from '../../../utils/ip';
import { ConvertToNumber } from '../../../utils/ConvertToNumber';

const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD } = process.env;

// 0 disables the inactivity timeout entirely
const FTP_TIMEOUT = ConvertToNumber(process.env.FTP_TIMEOUT, 120_000);
const FTP_KEEPALIVE = ConvertToNumber(process.env.FTP_KEEPALIVE, 15_000);
const FTP_RETRIES = ConvertToNumber(process.env.FTP_RETRIES, 2);
const FTP_RETRY_DELAY = ConvertToNumber(process.env.FTP_RETRY_DELAY, 5_000);

const CONNECTION_ERROR_PATTERNS = [
	"client is closed",
	"fin packet",
	"socket hang up",
	"timeout",
	"econnreset",
	"econnaborted",
	"econnrefused",
	"epipe",
	"etimedout",
	"ehostunreach",
	"enetunreach",
	"data connection"
];

class RetryableError extends Error { }

function isRetryable(error: any) {
	if (error instanceof RetryableError) {
		return true;
	}

	const message = String(error?.message ?? error).toLowerCase();
	return CONNECTION_ERROR_PATTERNS.some(pattern => message.includes(pattern));
}

function wait(ms: number) {
	return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export class FTPStorage extends StorageClass {
	private client: Client;

	constructor() {
		super();
		this.client = new Client(FTP_TIMEOUT);
	}

	async connect() {
		// Convert FTP_HOST to IP (https://github.com/patrickjuchli/basic-ftp/issues/123)
		const hostIp = await convertToIP(FTP_HOST);

		await this.client.access({
			host: hostIp,
			port: +FTP_PORT,
			user: FTP_USER,
			password: FTP_PASSWORD,
		});

		if (FTP_KEEPALIVE > 0) {
			this.client.ftp.socket.setKeepAlive(true, FTP_KEEPALIVE);
		}

		logger.info(`Connected to FTP server: ${hostIp}:${FTP_PORT}`);
	}

	private async reconnect() {
		try {
			this.client.close();
		} catch (error) {
			logger.debug(`Failed to close the previous FTP client: ${error}`);
		}

		this.client = new Client(FTP_TIMEOUT);
		await this.connect();
	}

	private async ensureConnected() {
		if (this.client.closed) {
			logger.warn(`FTP connection lost, reconnecting...`);
			await this.reconnect();
		}
	}

	private async run<T>(label: string, operation: () => Promise<T>): Promise<T> {
		for (let attempt = 1; ; attempt++) {
			try {
				await this.ensureConnected();
				await this.client.cd('/');
				return await operation();
			} catch (error) {
				if (attempt > FTP_RETRIES || !isRetryable(error)) {
					logger.error(`Failed to ${label}: ${error}`);
					throw error;
				}

				logger.warn(`Failed to ${label} (attempt ${attempt}/${FTP_RETRIES + 1}): ${error}, reconnecting and retrying...`);
				await wait(FTP_RETRY_DELAY);

				try {
					await this.reconnect();
				} catch (reconnectError) {
					logger.warn(`Failed to reconnect to the FTP server: ${reconnectError}`);
				}
			}
		}
	}

	private async removeQuietly(filePath: string) {
		try {
			await this.ensureConnected();
			await this.client.cd('/');
			await this.client.remove(filePath, true);
		} catch (error) {
			logger.debug(`Could not remove ${filePath}: ${error}`);
		}
	}

	private async assertUploadedSize(destination: string, expectedSize: number) {
		let uploadedSize: number;

		try {
			uploadedSize = await this.client.size(destination);
		} catch (error) {
			if (isRetryable(error)) {
				throw error;
			}

			logger.warn(`Could not verify the size of ${destination}: ${error}`);
			return;
		}

		if (uploadedSize !== expectedSize) {
			throw new RetryableError(`Incomplete upload of ${destination}: ${uploadedSize} bytes stored out of ${expectedSize}`);
		}
	}

	async deleteFile(filePath: string) {
		await this.run(`delete file ${filePath}`, async () => {
			await this.client.remove(filePath);
			logger.debug(`Deleted file: ${filePath}`);
		});
	}

	async uploadFile(filePath: string, destination: string) {
		const localSize = statSync(filePath).size;

		try {
			await this.run(`upload file ${filePath} to ${destination}`, async () => {
				await this.removeQuietly(destination);
				await this.client.uploadFrom(filePath, destination);
				await this.assertUploadedSize(destination, localSize);
				logger.debug(`Uploaded file: ${filePath}, to: ${destination}`);
			});
		} catch (error) {
			await this.removeQuietly(destination);
			throw error;
		}
	}

	async createFolder(folderPath: string) {
		await this.run(`create folder ${folderPath}`, async () => {
			await this.client.ensureDir(folderPath);
			logger.debug(`Created folder: ${folderPath}`);
		});
	}

	async deleteFolder(folderPath: string) {
		await this.run(`delete folder ${folderPath}`, async () => {
			await this.client.removeDir(folderPath);
			logger.debug(`Deleted folder: ${folderPath}`);
		});
	}

	async folderExists(folderPath: string): Promise<boolean> {
		return this.run(`check if folder ${folderPath} exists`, async () => {
			try {
				const list = await this.client.list(folderPath);
				return list.some(file => file.name === folderPath && file.isDirectory);
			} catch (error) {
				if (error.code === 550) { // 550 means "not found"
					return false;
				}
				throw error; // rethrow other errors
			}
		});
	}

	async folderSizeBytes(folderPath: string) {
		return this.run(`get the size of folder ${folderPath}`, async () => {
			const list = await this.client.list(folderPath);
			return list.reduce((total, file) => total + (file.size || 0), 0);
		});
	}

	async listFiles(folderPath: string) {
		return this.run(`list files in folder ${folderPath}`, async () => {
			const list = await this.client.list(folderPath);

			return list.map(file => ({
				fileName: file.name,
				filePath: `${folderPath}/${file.name}`,
				size: file.size || 0,
				lastModified: file.modifiedAt || new Date(),
				isDirectory: file.isDirectory
			}));
		});
	}

	async close() {
		this.client.close();
	}
	async init() {
		await this.connect();
	}
}

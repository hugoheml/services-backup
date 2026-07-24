import { Client } from "basic-ftp";
import { StorageClass } from "../StorageClass";
import { logger } from "../../log";
import { convertToIP } from '../../../utils/ip';
import { ConvertToNumber } from '../../../utils/ConvertToNumber';

const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD } = process.env;

// 0 disables the inactivity timeout entirely
const FTP_TIMEOUT = ConvertToNumber(process.env.FTP_TIMEOUT, 120_000);
const UPLOAD_RETRIES = 2;

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

		logger.info(`Connected to FTP server: ${hostIp}:${FTP_PORT}`);
	}

	// basic-ftp closes the client for good after a timeout; reconnect instead of
	// letting every following operation fail with "Client is closed"
	private async ensureConnected() {
		if (this.client.closed) {
			logger.warn(`FTP connection lost, reconnecting...`);
			this.client = new Client(FTP_TIMEOUT);
			await this.connect();
		}
	}

	async deleteFile(filePath: string) {
		await this.ensureConnected();
		await this.client.cd('/');

		try {
			await this.client.remove(filePath);
			logger.debug(`Deleted file: ${filePath}`);
		} catch (error) {
			logger.error(`Failed to delete file ${filePath}: ${error}`);
			throw error;
		}
	}

	async uploadFile(filePath: string, destination: string) {
		for (let attempt = 1; attempt <= UPLOAD_RETRIES + 1; attempt++) {
			await this.ensureConnected();
			await this.client.cd('/');

			try {
				await this.client.uploadFrom(filePath, destination);
				logger.debug(`Uploaded file: ${filePath}, to: ${destination}`);
				return;
			} catch (error) {
				if (attempt <= UPLOAD_RETRIES) {
					logger.warn(`Failed to upload file ${filePath} to ${destination} (attempt ${attempt}/${UPLOAD_RETRIES + 1}): ${error}, retrying...`);
					continue;
				}

				logger.error(`Failed to upload file ${filePath} to ${destination}: ${error}`);
				throw error;
			}
		}
	}

	async createFolder(folderPath: string) {
		await this.ensureConnected();
		await this.client.cd('/');

		try {
			await this.client.ensureDir(folderPath);
			logger.debug(`Created folder: ${folderPath}`);
		} catch (error) {
			logger.error(`Failed to create folder ${folderPath}: ${error}`);
			throw error;
		}
	}

	async deleteFolder(folderPath: string) {
		await this.ensureConnected();
		await this.client.cd('/');
		
		try {
			await this.client.removeDir(folderPath);
			logger.debug(`Deleted folder: ${folderPath}`);
		} catch (error) {
			logger.error(`Failed to delete folder ${folderPath}: ${error}`);
			throw error;
		}
	}

	async folderExists(folderPath: string): Promise<boolean> {
		await this.ensureConnected();
		await this.client.cd('/');

		try {
			const list = await this.client.list(folderPath);
			return list.some(file => file.name === folderPath && file.isDirectory);
		} catch (error) {
			if (error.code === 550) { // 550 means "not found"
				return false;
			}
			throw error; // rethrow other errors
		}
	}

	async folderSizeBytes(folderPath: string) {
		await this.ensureConnected();
		const list = await this.client.list(folderPath);
		return list.reduce((total, file) => total + (file.size || 0), 0);
	}

	async listFiles(folderPath: string) {
		await this.ensureConnected();
		await this.client.cd('/');

		try {
			const list = await this.client.list(folderPath);

			const result = [];
			for await (const file of list) {
				result.push({
					fileName: file.name,
					filePath: `${folderPath}/${file.name}`,
					size: file.size || 0,
					lastModified: file.modifiedAt || new Date(),
					isDirectory: file.isDirectory
				});
			}
			return result;
		} catch (error) {
			logger.error(`Failed to list files in folder ${folderPath}: ${error}`);
			throw error;
		}
	}
	
	async close() {
		await this.client.close();
	}
	async init() {
		await this.connect();
	}	
}
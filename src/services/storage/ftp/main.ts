import { Client } from "basic-ftp";
import { StorageClass } from "../StorageClass";
import { FileResult } from "../types/FileResult";
import { logger } from "../../log";

const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD } = process.env;

export class FTPStorage extends StorageClass {
	private client: Client;

	constructor() {
		super();
		this.client = new Client();
	}

	async connect() {
		await this.client.access({
			host: FTP_HOST,
			port: +FTP_PORT,
			user: FTP_USER,
			password: FTP_PASSWORD
		});

		logger.info("Connected to FTP server:", FTP_HOST);
	}

	async deleteFile(filePath: string): Promise<void> {
		await this.client.remove(filePath);
		logger.info("Deleted file:", filePath);
	}

	async uploadFile(filePath: string, destination: string): Promise<void> {
		await this.client.uploadFrom(filePath, destination);
		logger.info("Uploaded file:", filePath, "to:", destination);
	}

	async createFolder(folderPath: string): Promise<void> {
		await this.client.ensureDir(folderPath);
		logger.info("Created folder:", folderPath);
	}

	async folderExists(folderPath: string): Promise<boolean> {
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

	async folderSizeBytes(folderPath: string): Promise<number> {
		const list = await this.client.list(folderPath);
		return list.reduce((total, file) => total + (file.size || 0), 0);
	}
	
	async listFiles(folderPath: string): Promise<FileResult[]> {
		const list = await this.client.list(folderPath);
		return list.map(file => ({
			filePath: file.name,
			size: file.size || 0,
			lastModified: file.modifiedAt || new Date(),
			isDirectory: file.isDirectory
		}));
	}
	
	async close() {
		await this.client.close();
	}
	async init() {
		await this.connect();
	}	
}
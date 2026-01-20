import SftpClient from "ssh2-sftp-client";
import { StorageClass } from "../StorageClass";
import { logger } from "../../log";
import { convertToIP } from '../../../utils/ip';
import * as fs from 'fs';

const {
	SFTP_HOST,
	SFTP_PORT,
	SFTP_USER,
	SFTP_PASSWORD,
	SFTP_PRIVATE_KEY_PATH,
	SFTP_PASSPHRASE
} = process.env;

export class SFTPStorage extends StorageClass {
	private client: SftpClient;

	constructor() {
		super();
		this.client = new SftpClient();
	}

	async connect() {
		// Convert SFTP_HOST to IP
		const hostIp = await convertToIP(SFTP_HOST);

		// Prepare connection config
		const config: any = {
			host: hostIp,
			port: SFTP_PORT ? +SFTP_PORT : 22,
			username: SFTP_USER,
		};

		// Authentication: prefer SSH key over password
		if (SFTP_PRIVATE_KEY_PATH) {
			try {
				config.privateKey = fs.readFileSync(SFTP_PRIVATE_KEY_PATH, 'utf8');
				if (SFTP_PASSPHRASE) {
					config.passphrase = SFTP_PASSPHRASE;
				}
				logger.info(`Using SSH key authentication from: ${SFTP_PRIVATE_KEY_PATH}`);
			} catch (error) {
				logger.error(`Failed to read SSH private key from ${SFTP_PRIVATE_KEY_PATH}: ${error}`);
				throw error;
			}
		} else if (SFTP_PASSWORD) {
			config.password = SFTP_PASSWORD;
			logger.info(`Using password authentication`);
		} else {
			throw new Error('SFTP authentication failed: Either SFTP_PASSWORD or SFTP_PRIVATE_KEY_PATH must be provided');
		}

		await this.client.connect(config);
		logger.info(`Connected to SFTP server: ${hostIp}:${config.port}`);
	}

	async deleteFile(filePath: string) {
		try {
			await this.client.delete(filePath);
			logger.debug(`Deleted file: ${filePath}`);
		} catch (error) {
			logger.error(`Failed to delete file ${filePath}: ${error}`);
			throw error;
		}
	}

	async uploadFile(filePath: string, destination: string) {
		try {
			await this.client.put(filePath, destination);
			logger.debug(`Uploaded file: ${filePath}, to: ${destination}`);
		} catch (error) {
			logger.error(`Failed to upload file ${filePath} to ${destination}: ${error}`);
			throw error;
		}
	}

	async createFolder(folderPath: string) {
		try {
			await this.client.mkdir(folderPath, true); // recursive = true
			logger.debug(`Created folder: ${folderPath}`);
		} catch (error) {
			logger.error(`Failed to create folder ${folderPath}: ${error}`);
			throw error;
		}
	}

	async deleteFolder(folderPath: string) {
		try {
			await this.client.rmdir(folderPath, true); // recursive = true
			logger.debug(`Deleted folder: ${folderPath}`);
		} catch (error) {
			logger.error(`Failed to delete folder ${folderPath}: ${error}`);
			throw error;
		}
	}

	async folderExists(folderPath: string): Promise<boolean> {
		try {
			const stat = await this.client.stat(folderPath);
			return stat.isDirectory;
		} catch (error) {
			// If stat fails, the folder doesn't exist
			return false;
		}
	}

	async folderSizeBytes(folderPath: string) {
		try {
			const list = await this.client.list(folderPath);
			let totalSize = 0;

			for (const file of list) {
				if (file.type === 'd') {
					// Recursively calculate folder size
					const subFolderSize = await this.folderSizeBytes(`${folderPath}/${file.name}`);
					totalSize += subFolderSize;
				} else {
					totalSize += file.size || 0;
				}
			}

			return totalSize;
		} catch (error) {
			logger.error(`Failed to calculate folder size for ${folderPath}: ${error}`);
			throw error;
		}
	}

	async listFiles(folderPath: string) {
		try {
			const list = await this.client.list(folderPath);

			return list.map(file => ({
				fileName: file.name,
				filePath: `${folderPath}/${file.name}`,
				size: file.size || 0,
				lastModified: new Date(file.modifyTime),
				isDirectory: file.type === 'd'
			}));
		} catch (error) {
			logger.error(`Failed to list files in folder ${folderPath}: ${error}`);
			throw error;
		}
	}

	async close() {
		await this.client.end();
	}

	async init() {
		await this.connect();
	}
}

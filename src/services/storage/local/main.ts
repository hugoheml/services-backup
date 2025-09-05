import { StorageClass } from "../StorageClass";
import { logger } from "../../log";
import { promises as fs } from "fs";
import { join } from "path";
import { FileResult } from "../types/FileResult";

const { LOCAL_STORAGE_PATH } = process.env;

export class LocalStorage extends StorageClass {
	private basePath: string;

	constructor() {
		if (!LOCAL_STORAGE_PATH) {
			throw new Error("LOCAL_STORAGE_PATH is not defined in environment variables");
		}

		super();
		this.basePath = LOCAL_STORAGE_PATH;
	}

	async deleteFile(filePath: string) {
		const fullPath = join(this.basePath, filePath);
		try {
			await fs.unlink(fullPath);
			logger.debug(`Deleted file: ${fullPath}`);
		} catch (error) {
			logger.error(`Failed to delete file ${fullPath}: ${error}`);
			throw error;
		}
	}

	async uploadFile(filePath: string, destination: string) {
		const destPath = join(this.basePath, destination);
		const destDir = destPath.substring(0, destPath.lastIndexOf('/'));

		try {
			await fs.mkdir(destDir, { recursive: true });
			await fs.copyFile(filePath, destPath);
			logger.debug(`Uploaded file: ${filePath}, to: ${destPath}`);
		} catch (error) {
			logger.error(`Failed to upload file ${filePath} to ${destPath}: ${error}`);
			throw error;
		}
	}

	async createFolder(folderPath: string) {
		const fullPath = join(this.basePath, folderPath);
		try {
			await fs.mkdir(fullPath, { recursive: true });
			logger.debug(`Created folder: ${fullPath}`);
		} catch (error) {
			logger.error(`Failed to create folder ${fullPath}: ${error}`);
			throw error;
		}
	}

	async deleteFolder(folderPath: string) {
		const fullPath = join(this.basePath, folderPath);
		try {
			await fs.rmdir(fullPath, { recursive: true });
			logger.debug(`Deleted folder: ${fullPath}`);
		} catch (error) {
			logger.error(`Failed to delete folder ${fullPath}: ${error}`);
			throw error;
		}
	}

	async folderExists(folderPath: string) {
		const fullPath = join(this.basePath, folderPath);
		try {
			const stats = await fs.stat(fullPath);
			return stats.isDirectory();
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return false;
			}
			logger.error(`Error checking if folder exists ${fullPath}: ${error}`);
			throw error;
		}
	}

	async folderSizeBytes(folderPath: string) {
		const fullPath = join(this.basePath, folderPath);
		
		const calculateSize = async (path: string): Promise<number> => {
			const stats = await fs.stat(path);
			if (stats.isFile()) {
				return stats.size;
			} else if (stats.isDirectory()) {
				const files = await fs.readdir(path);
				const sizes = await Promise.all(files.map(file => calculateSize(join(path, file))));
				return sizes.reduce((acc, size) => acc + size, 0);
			}
			return 0;
		};

		try {
			return await calculateSize(fullPath);
		} catch (error) {
			logger.error(`Error calculating folder size for ${fullPath}: ${error}`);
			throw error;
		}
	}

	async listFiles(folderPath: string) {
		const fullPath = join(this.basePath, folderPath);

		// No recursion for simplicity
		try {
			const entries = await fs.readdir(fullPath, { withFileTypes: true });
			const result: FileResult[] = [];

			for (const entry of entries) {
				const entryPath = join(fullPath, entry.name);
				const stats = await fs.stat(entryPath);

				result.push({
					filePath: join(folderPath, entry.name),
					size: stats.size,
					lastModified: stats.mtime,
					isDirectory: entry.isDirectory()
				});
			}

			return result;
		} catch (error) {
			logger.error(`Failed to list files in folder ${fullPath}: ${error}`);
			throw error;
		}
	}

	async init() {
		try {
			await fs.mkdir(this.basePath, { recursive: true });
			logger.info(`Local storage initialized at ${this.basePath}`);
		} catch (error) {
			logger.error(`Failed to initialize local storage at ${this.basePath}: ${error}`);
			throw error;
		}
	}

	async close() {
		// No persistent connections to close for local storage
		logger.info("Local storage closed");
	}
}
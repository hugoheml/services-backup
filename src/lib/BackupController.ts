import { unlinkSync } from "fs";
import { BackupService } from "../services/backup/BackupService";
import { BackupFileMetadata } from "../services/backup/types/BackupFileMetadata";
import { logger } from "../services/log";
import { StorageClass } from "../services/storage/StorageClass";
import { FileResult } from "../services/storage/types/FileResult";
import { ConvertToNumber } from "../utils/ConvertToNumber";
import { AlertManager } from "../services/alerts/AlertManager";
import { AlertLevel } from "../services/alerts/types/AlertLevel";
import { GetBackupsPerDestinationFolder } from "../services/backup/utils";

const MAX_BACKUP_PER_ELEMENT = ConvertToNumber(process.env.MAX_BACKUP_PER_ELEMENT, 3); 
// const MAX_BACKUP_SIZE_PER_SERVER = 
const MAX_BACKUP_RETENTION_DAYS = ConvertToNumber(process.env.MAX_BACKUP_RETENTION_DAYS, 30);

export class BackupController {
	private backupService: BackupService;
	private storageClass: StorageClass;
	private alertManager: AlertManager;

	constructor(backupService: BackupService, storageClass: StorageClass, alertManager: AlertManager) {
		this.backupService = backupService;
		this.storageClass = storageClass;
		this.alertManager = alertManager;
	}

	async removeOldBackups(folderFiles: FileResult[]) {
		const now = new Date();
		const oldFiles = folderFiles.filter(file => {
			const fileDate = file.lastModified;
			const diffDays = Math.floor((now.getTime() - fileDate.getTime()) / (1000 * 3600 * 24));
			return diffDays > MAX_BACKUP_RETENTION_DAYS;
		})

		if (oldFiles.length === 0) {
			logger.debug(`No old backups to delete`);
			return [];
		}

		const promises = oldFiles.map(file => {
			return this.storageClass.deleteFile(file.filePath)
				.then(() => logger.info(`Deleted old backup file: ${file.filePath}`))
				.catch(err => logger.error(`Failed to delete old backup file ${file.filePath}:`, err));
		});
		
		await Promise.all(promises);

		return oldFiles;
	}

	async removeBackupsIfExceedsLimit(folderFiles: FileResult[]) {
		if (folderFiles.length <= MAX_BACKUP_PER_ELEMENT) {
			return;
		}

		logger.warn(`Maximum backup limit reached for folder ${folderFiles[0].filePath}, needing to delete the oldest backups.`);
		const sortedFiles = folderFiles.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());
		const filesToDelete = sortedFiles.slice(MAX_BACKUP_PER_ELEMENT);
		
		if (filesToDelete.length === 0) {
			logger.debug(`No backups to delete in folder ${folderFiles[0].filePath}.`);
			return;
		}

		const promises = filesToDelete.map(file => {
			return this.storageClass.deleteFile(file.filePath)
				.then(() => logger.info(`Deleted old backup file: ${file.filePath}`))
				.catch(err => logger.error(`Failed to delete old backup file ${file.filePath}: ${err}`));
		});
		
		await Promise.all(promises);

		logger.info(`Removed ${filesToDelete.length} old backups from folder.`);
	}

	async doRestrictionsCheck() {
		try {
			const mainFolderExists = await this.storageClass.folderExists(this.backupService.FOLDER_PATH);
			if (!mainFolderExists) {
				await this.storageClass.createFolder(this.backupService.FOLDER_PATH);
			}
	
			const folders = (await this.storageClass.listFiles(this.backupService.FOLDER_PATH))
				.filter(file => file.isDirectory)
	
			logger.info(`Checking for backups to delete due to retention policy...`);
			for await (const folder of folders) {
				const folderFiles = await this.storageClass.listFiles(folder.filePath);
				if (folderFiles.length === 0) {
					await this.storageClass.deleteFolder(folder.filePath);
					logger.info(`Deleted empty backup folder: ${folder.filePath}`);
					continue;
				}
	
				const deletedFolders = await this.removeOldBackups(folderFiles);
				if (deletedFolders.length > 0) {
					logger.info(`Removed ${deletedFolders.length} old backups from folder: ${folder.filePath}`);
				}
	
				const actualFolderFiles = await this.storageClass.listFiles(folder.filePath);
				await this.removeBackupsIfExceedsLimit(actualFolderFiles);
			}
		} catch (error) {
			logger.error(`Error occurred during backup restrictions check for ${this.backupService.SERVICE_NAME}: ${error}`);
			await this.alertManager.sendAlert({
				level: AlertLevel.ERROR,
				message: `Error occurred during backup restrictions check`,
				fields: [
					{
						name: `Affected service`,
						value: this.backupService.SERVICE_NAME
					}
				],
				error: error
			});
			throw error;
		}
	}

	async getTrimmedBackups(backupsToProcess: BackupFileMetadata[]) {
		// Get only the last MAX_BACKUP_PER_ELEMENT backups per .destinationFolder
		const backupFolders = GetBackupsPerDestinationFolder(backupsToProcess);

		for (const [folder, backups] of backupFolders.entries()) {
			if (backups.length > MAX_BACKUP_PER_ELEMENT) {
				// Sort by date and keep only the latest MAX_BACKUP_PER_ELEMENT backups
				backups.sort((a, b) => b.date.getTime() - a.date.getTime());

				if (backups.length > MAX_BACKUP_PER_ELEMENT) {
					logger.info(`Trimming backups in element ${folder} to the last ${MAX_BACKUP_PER_ELEMENT} backups.`);
					backupFolders.set(folder, backups.slice(0, MAX_BACKUP_PER_ELEMENT));
				}
			}
		}

		const trimmedBackups: BackupFileMetadata[] = [];
		for (const backups of backupFolders.values()) {
			trimmedBackups.push(...backups);
		}
		return trimmedBackups;
	}

	async process() {
		try {
			logger.info(`Starting backup process for service: ${this.backupService.SERVICE_NAME}`);
		
			await this.doRestrictionsCheck();

			let backups: BackupFileMetadata[];
			try {
				backups = await this.backupService.getElementsToBackup();
				if (backups.length === 0) {
					logger.info("No backups to process.");
					return;
				}
			} catch (error) {
				logger.error(`Failed to retrieve backups for service: ${this.backupService.SERVICE_NAME}: ${error}`);
				await this.alertManager.sendAlert({
					level: AlertLevel.ERROR,
					message: `Failed to retrieve backups`,
					fields: [
						{ name: `Affected service`, value: this.backupService.SERVICE_NAME },
						{ name: `Error`, value: String(error) }
					]
				});
				return;
			}

			const backupsToProcess = await this.getTrimmedBackups(backups);

			for await (const backupMetadata of backupsToProcess) {
				try {
					const targetFolderExists = await this.storageClass.folderExists(backupMetadata.destinationFolder);
					if (!targetFolderExists) {
						await this.storageClass.createFolder(backupMetadata.destinationFolder);
					}

					const targetFolderFiles = await this.storageClass.listFiles(backupMetadata.destinationFolder);

					const backupAlreadyExists = targetFolderFiles.some(file => file.filePath.split('/').pop() === backupMetadata.fileName);
					if (backupAlreadyExists) {
						logger.info(`Backup file ${backupMetadata.fileName} (${backupMetadata.uuid}) already exists for ${backupMetadata.parentElement}, skipping download.`);
						continue;
					}
					
					if (targetFolderFiles.length >= MAX_BACKUP_PER_ELEMENT) {
						logger.warn(`Maximum backup limit reached for ${backupMetadata.parentElement}, needing to delete the oldest backup.`);

						const sortedTargetFiles = targetFolderFiles.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());
						for (let i = 0; i < sortedTargetFiles.length - MAX_BACKUP_PER_ELEMENT + 1; i++) {
							const fileToDelete = sortedTargetFiles[i];
							await this.storageClass.deleteFile(fileToDelete.filePath);
							logger.info(`Deleted old backup file: ${fileToDelete.filePath}`);
						}
					}

					const destinationPath = `${backupMetadata.destinationFolder}/${backupMetadata.fileName}`;

					logger.info(`Downloading backup ${backupMetadata.uuid} for ${backupMetadata.parentElement}...`);
					const backupFilePath = await this.backupService.downloadBackup(backupMetadata);
					logger.info(`Downloaded backup file ${backupFilePath} (${backupMetadata.uuid}) to ${backupFilePath}`);
					if (!backupFilePath) {
						logger.error(`Failed to download backup ${backupMetadata.uuid} for ${backupMetadata.parentElement}`);
						continue;
					}

					logger.info(`Uploading backup ${backupMetadata.uuid} for ${backupMetadata.parentElement}...`);
					await this.storageClass.uploadFile(backupFilePath, destinationPath);
					logger.info(`Uploaded backup file ${backupFilePath} (${backupMetadata.uuid}) to ${destinationPath}`);

					unlinkSync(backupFilePath);

				} catch (error) {
					logger.error(`Error processing backup ${backupMetadata.uuid} for ${backupMetadata.parentElement}: ${error}`);
					await this.alertManager.sendAlert({
						level: AlertLevel.ERROR,
						message: `Error processing backup`,
						fields: [
							{ name: "Affected service", value: this.backupService.SERVICE_NAME },
							{ name: "Element", value: backupMetadata.parentElement },
							{ name: "Backup UUID", value: backupMetadata.uuid }
						],
						error: error
					});
					continue;
				}
			}

			logger.info(`Backup for service ${this.backupService.SERVICE_NAME} completed successfully.`);
			logger.info(`Total backups processed: ${backupsToProcess.length}`);
		} catch (error) {
			logger.error(`Error during backup process for service ${this.backupService.SERVICE_NAME}: ${error}`);
		}
	}
}
import "dotenv/config";
import { GetStorageClass } from "./services/storage/main";

import { PterodactylBackupService } from "./services/backup/pterodactyl/PterodactylBackupService";
import { BackupController } from "./lib/BackupController";
import { MysqlBackupService } from "./services/backup/mysql/MysqlBackupService";
import { PostgresqlBackupService } from "./services/backup/postgresql/PostgresqlBackupService";
import { RsyncBackupService } from "./services/backup/rsync/RsyncBackupService";
import { LocalFilesBackupService } from "./services/backup/localfiles/LocalFilesBackupService";
import { AlertManager } from "./services/alerts/AlertManager";
import { logger } from "./services/log";
import { BackupService } from "./services/backup/BackupService";
import { StorageClass } from "./services/storage/StorageClass";
import { AlertLevel } from "./services/alerts/types/AlertLevel";

const BACKUP_PTERODACTYL = process.env.BACKUP_PTERODACTYL === "true";
const BACKUP_MYSQL = process.env.BACKUP_MYSQL === "true";
const BACKUP_POSTGRESQL = process.env.BACKUP_POSTGRESQL === "true";
const BACKUP_RSYNC = process.env.BACKUP_RSYNC === "true";
const BACKUP_LOCAL_FILES = process.env.BACKUP_LOCAL_FILES === "true";
const ALERT_AFTER_PROCESS = process.env.ALERT_AFTER_PROCESS === "true";

async function processBackup(backupService: BackupService, storageClass: StorageClass, alertManager: AlertManager) {
	try {
		await backupService.init();
	} catch (error) {
		logger.error(`Failed to initialize backup service: ${backupService.constructor.name}, error: ${error}`);
		await alertManager.sendAlert({
			level: AlertLevel.ERROR,
			message: `Failed to initialize backup service`,
			fields: [
				{ name: `Affected service`, value: backupService.constructor.name }
			]
		});
		throw error;
	}

	const backupController = new BackupController(backupService, storageClass, alertManager);
	await backupController.process();

	if (ALERT_AFTER_PROCESS) {
		await alertManager.sendAlert({
			level: AlertLevel.INFO,
			message: `Backup script has been executed`,
			fields: [
				{ name: `Affected service`, value: backupService.constructor.name }
			]
		});
	}

	await backupService.close();
}

async function main() {
	const alertManager = new AlertManager();
	await alertManager.init();

	const storageClass = GetStorageClass();
	try {
		await storageClass.init();
	}
	catch (error) {
		logger.error(`Failed to initialize storage class: ${error}`);

		await alertManager.sendAlert({
			level: AlertLevel.ERROR,
			message: "Failed to initialize storage class",
			fields: [
				{ name: `Affected class storage`, value: storageClass.constructor.name }
			],
			error: error
		});

		throw error;
	}

	if (BACKUP_PTERODACTYL) {
		const pterodactylBackupService = new PterodactylBackupService();
		await processBackup(pterodactylBackupService, storageClass, alertManager);
	}

	if (BACKUP_MYSQL) {
		const mysqlBackupService = new MysqlBackupService();
		await processBackup(mysqlBackupService, storageClass, alertManager);
	}

	if (BACKUP_POSTGRESQL) {
		const postgresqlBackupService = new PostgresqlBackupService();
		await processBackup(postgresqlBackupService, storageClass, alertManager);
	}

	if (BACKUP_RSYNC) {
		const rsyncBackupService = new RsyncBackupService();
		await processBackup(rsyncBackupService, storageClass, alertManager);
	}

	if (BACKUP_LOCAL_FILES) {
		const localFilesBackupService = new LocalFilesBackupService();
		await processBackup(localFilesBackupService, storageClass, alertManager);
	}

	await storageClass.close();
}
main();
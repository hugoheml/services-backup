import "dotenv/config";
import { GetStorageClass } from "./services/storage/main";

import { PterodactylBackupService } from "./services/pterodactyl/PterodactylBackupService";
import { BackupController } from "./lib/BackupController";
import { MysqlBackupService } from "./services/mysql/MysqlBackupService";
import { AlertManager } from "./services/alerts/AlertManager";
import { logger } from "./services/log";
import { BackupService } from "./services/backup/BackupService";
import { StorageClass } from "./services/storage/StorageClass";
import { AlertLevel } from "./services/alerts/types/AlertLevel";

const BACKUP_PTERODACTYL = process.env.BACKUP_PTERODACTYL === "true";
const BACKUP_MYSQL = process.env.BACKUP_MYSQL === "true";
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

	backupService.close();
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

	await storageClass.close();
}
main();
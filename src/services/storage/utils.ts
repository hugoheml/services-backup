import "dotenv/config";
import { logger } from "../log";
import { FileResultWithRetention } from "./types/FileResultWithRetention";
import { FileResult } from "./types/FileResult";

const periodicBackupRetentionEnabled = process.env.PERIODIC_BACKUP_RETENTION_ENABLED === 'true';
const PERIODIC_BACKUP_RETENTION = process.env.PERIODIC_BACKUP_RETENTION;

// [key: time]: amount per time 
const formattedFilePerTime: Record<number, number> = {};

if (PERIODIC_BACKUP_RETENTION && periodicBackupRetentionEnabled) {
	PERIODIC_BACKUP_RETENTION.split(',').forEach((item) => {
		const [time, amount] = item.split(':');

		const timeInt = Number(time);
		const amountInt = Number(amount);

		if (isNaN(timeInt) || isNaN(amountInt)) {
			logger.error(`Invalid file configuration: ${item}`);
			throw new Error(`Invalid file configuration: ${item}`);
		}

		formattedFilePerTime[timeInt] = amountInt;
	});
}

export function FileFilesToFileFilesWithRetention(files: FileResult[]): FileResultWithRetention[] {
	const filesWithRetention: FileResultWithRetention[] = files.filter(file => !file.isDirectory).map((file) => ({
		...file,
		canBeDeleted: true,
		additionalForTimes: [],
	}));

	if (!periodicBackupRetentionEnabled) {
		return filesWithRetention;
	}

	if (Object.keys(formattedFilePerTime).length === 0) {
		logger.warn(`No additional files per time configured.`);
		return filesWithRetention;
	}

	const newestFirst = filesWithRetention.filter(file => Number.isFinite(file.lastModified.getTime()));
	newestFirst.sort((a, b) => {
		return b.lastModified.getTime() - a.lastModified.getTime() || a.filePath.localeCompare(b.filePath);
	});

	for (const [time, amount] of Object.entries(formattedFilePerTime)) {
		const intervalMinutes = Number(time);
		const intervalMs = intervalMinutes * 60_000;
		let nextEligibleTimestamp = Infinity;
		let kept = 0;

		for (const file of newestFirst) {
			if (kept >= amount) {
				break;
			}

			const timestamp = file.lastModified.getTime();
			if (timestamp > nextEligibleTimestamp) {
				continue;
			}

			file.canBeDeleted = false;
			file.additionalForTimes.push(intervalMinutes);
			nextEligibleTimestamp = timestamp - intervalMs;
			kept++;
		}
	}

	return filesWithRetention;
}

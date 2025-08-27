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
	const filesWithRetention: FileResultWithRetention[] = files.map((file) => ({
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

	const filesPerTime: {
		[time: number]: FileResultWithRetention[]
	} = {};

	for (const file of filesWithRetention) {
		for (const [time, amount] of Object.entries(formattedFilePerTime)) {
			const timeInt = Number(time);
			const amountInt = Number(amount);

			filesPerTime[timeInt] = filesPerTime[timeInt] || [];

			if (filesPerTime[timeInt].length == 0) {
				filesPerTime[timeInt].push(file);
				file.additionalForTimes.push(Number(time));
			} else {
				const lastFile = filesPerTime[timeInt][filesPerTime[timeInt].length - 1];

				// If the time between the last marked file and the current one is greater than the allowed interval, mark it
				if (lastFile && (file.lastModified.getTime() - lastFile.lastModified.getTime()) > (timeInt * 1000 * 60)) {
					file.additionalForTimes.push(Number(time));
					filesPerTime[timeInt].push(file);
				}
			}
		}
	}

	// Remove some marked files to keep only the X last marked files per time (X = amountInt)
	for (const [time, files] of Object.entries(filesPerTime)) {
		const timeInt = Number(time);
		const amountInt = formattedFilePerTime[timeInt];
	
		if (files.length > amountInt) {
			for (let i = 0; i < files.length - amountInt; i++) {
				files[i].additionalForTimes = files[i].additionalForTimes.filter(t => t !== timeInt);
			}
		}
	}

	const finalResult = filesWithRetention.map(f => {
		return {
			...f,
			canBeDeleted: f.additionalForTimes.length === 0,
		};
	});

	return finalResult;
}
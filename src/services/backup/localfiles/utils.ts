import { logger } from "../../log";
import { execSync } from "child_process";
import { statSync, existsSync, mkdirSync } from "fs";
import path from "path";

export type LocalFilesTarget = {
	name: string;
	path: string;
	excludePatterns?: string[];
};

export type LocalFilesArchive = {
	sanitizedName: string;
	archiveName: string;
	archivePath: string;
	timestamp: string;
	size: number;
	date: Date;
};

const TMP_DIR = process.env.LOCAL_FILES_TMP_DIR || "/tmp/local-files-backups";

export function loadLocalFilesTargets(): LocalFilesTarget[] {
	const sourcePath = process.env.LOCAL_FILES_PATH;

	if (!sourcePath) {
		return [];
	}

	if (!existsSync(sourcePath)) {
		logger.warn(`[local-files] Source path does not exist: ${sourcePath}`);
		return [];
	}

	// Parse ignore patterns from environment variable
	const ignoreEnv = process.env.LOCAL_FILES_IGNORE || "";
	const excludePatterns = ignoreEnv
		.split(",")
		.map((pattern) => pattern.trim())
		.filter((pattern) => pattern.length > 0);

	// Generate a name based on the path
	const name = path.basename(sourcePath);

	logger.info(
		`[local-files] Loaded backup target: ${name} (${sourcePath})` +
		(excludePatterns.length > 0 ? ` - Ignoring: ${excludePatterns.join(", ")}` : "")
	);

	return [
		{
			name,
			path: sourcePath,
			excludePatterns: excludePatterns.length > 0 ? excludePatterns : undefined
		}
	];
}

function sanitizeName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9-_]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export async function createArchiveForTarget(target: LocalFilesTarget): Promise<LocalFilesArchive> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const sanitizedName = sanitizeName(target.name);
	const archiveName = `${sanitizedName}-${timestamp}.tar.gz`;

	if (!existsSync(TMP_DIR)) {
		mkdirSync(TMP_DIR, { recursive: true });
	}

	const archivePath = path.join(TMP_DIR, archiveName);

	logger.info(`[local-files] Creating archive for target: ${target.name} (${target.path})`);

	try {
		let tarCommand = `tar -czf "${archivePath}"`;

		// Add exclude patterns if provided
		if (target.excludePatterns && target.excludePatterns.length > 0) {
			for (const pattern of target.excludePatterns) {
				tarCommand += ` --exclude="${pattern}"`;
			}
		}

		const parentDir = path.dirname(target.path);
		const basename = path.basename(target.path);

		tarCommand += ` -C "${parentDir}" "${basename}"`;

		logger.debug(`[local-files] Executing: ${tarCommand}`);

		execSync(tarCommand, { stdio: 'pipe' });

		const stats = statSync(archivePath);

		logger.info(`[local-files] Archive created successfully: ${archivePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

		return {
			sanitizedName,
			archiveName,
			archivePath,
			timestamp,
			size: stats.size,
			date: new Date()
		};
	} catch (error) {
		logger.error(`[local-files] Failed to create archive for ${target.name}: ${error}`);
		throw error;
	}
}

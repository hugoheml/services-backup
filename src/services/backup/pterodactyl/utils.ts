import "dotenv/config";
import { HTTPMethod } from "http-method-enum";
import { createWriteStream, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ServerListResult } from "./types/ServerListResult";
import { ServerResult } from "./types/ServerResult";
import { logger } from "../../log";
import { BackupListResult } from "./types/BackupListResult";
import { BackupResult } from "./types/BackupResult";
import { BackupDownloadResult } from "./types/BackupDownloadResult";
import { ServerWithBackup } from "./types/ServerWithBackup";

const { PTERODACTYL_URL, PTERODACTYL_API_KEY, PTERODACTYL_FETCH_AS_ADMIN, TMP_DIR } = process.env;
const PTERODACTYL_FETCH_AS_ADMIN_BOOL = PTERODACTYL_FETCH_AS_ADMIN === "true";

const PER_PAGE = 100;
const DOWNLOAD_DIRECTORY = `${TMP_DIR}/pterodactyl-backups`;

mkdirSync(DOWNLOAD_DIRECTORY, { recursive: true });

type PterodactylResponse<T> = {
	statusCode: number;
	data: T;
}

async function SendRequest<T>(path: string, method: HTTPMethod, body?: any): Promise<PterodactylResponse<T>> {
	try {
		const url = `${PTERODACTYL_URL}${path}`;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${PTERODACTYL_API_KEY}`
		}
	
		if (body) {
			headers["Content-Length"] = Buffer.byteLength(JSON.stringify(body)).toString();
		}
	
		logger.debug(`Sending request to ${url} with method ${method}`);

		const response = await fetch(url, {
			method: method,
			headers: headers,
			body: body ? JSON.stringify(body) : undefined
		});

		logger.debug(`Received response with status ${response.status} from ${url}`);

		const data = await response.json();
		
		return {
			statusCode: response.status,
			data: data as T
		}
	} catch (error) {
		throw error;
	}
}

async function FetchServersAtPage(page: number = 1, asAdmin?: boolean) {
	const path = asAdmin ? `/api/client?type=admin&page=${page}&per_page=${PER_PAGE}` : `/api/client?page=${page}&per_page=${PER_PAGE}`;

	const response = await SendRequest<ServerListResult>(path, HTTPMethod.GET);
	if (response.statusCode !== 200) {
		throw new Error(`Failed to fetch servers: ${response.statusCode}`);
	}

	return response.data;
}

async function FetchAllServerPages(asAdmin?: boolean) {
	const result: ServerResult[] = [];

	let currentPage = 1;
	while (true) {
		const servers = await FetchServersAtPage(currentPage, asAdmin);
		result.push(...servers.data);

		if (servers.meta.pagination.total_pages > currentPage) {
			currentPage++;
		} else {
			break;
		}
	}
	
	return result;
}

export async function FetchAllServers() {
	const result = await FetchAllServerPages();
	if (PTERODACTYL_FETCH_AS_ADMIN_BOOL) {
		const adminResult = await FetchAllServerPages(true);
		return [...result, ...adminResult];
	}

	return result;
}

export async function FetchServerBackupPage(server: ServerResult, page: number) {
	const path = `/api/client/servers/${server.attributes.identifier}/backups?page=${page}&per_page=${PER_PAGE}`;
	const response = await SendRequest<BackupListResult>(path, HTTPMethod.GET);
	if (response.statusCode !== 200) {
		throw new Error(`Failed to fetch backups for server ${server.attributes.name}: ${response.statusCode}`);
	}

	return response.data;
}

export async function FetchAllServerBackups(server: ServerResult) {
	const result: BackupResult[] = [];
	let currentPage = 1;
	while (true) {
		const backups = await FetchServerBackupPage(server, currentPage);
		result.push(...backups.data);

		if (backups.meta.pagination.total_pages > currentPage) {
			currentPage++;
		} else {
			break;
		}
	}
	return result;
}

export async function FetchAllServersBackups() {
	const servers = await FetchAllServers();
	const result: ServerWithBackup[] = [];
	
	for (const server of servers) {
		const backups = await FetchAllServerBackups(server);
		result.push({ server, backups });
	}
	logger.info(`Fetched backups for ${result.length} servers`);

	return result;
}

export function GetBackupFileName(server: ServerResult, backup: BackupResult): string {
	const sanitizedBackupName = backup.attributes.name.replace(/[^a-zA-Z0-9]/g, "-");

	return `${server.attributes.identifier}-${sanitizedBackupName}-${backup.attributes.uuid}.tar.gz`;
}

export async function DownloadServerBackup(server: ServerResult, backup: BackupResult) {
	const path = `/api/client/servers/${server.attributes.identifier}/backups/${backup.attributes.uuid}/download`;
	const response = await SendRequest<BackupDownloadResult>(path, HTTPMethod.GET);
	if (response.statusCode !== 200) {
		throw new Error(`Failed to get download URL for backup ${backup.attributes.name} of server ${server.attributes.name}: ${response.statusCode}`);
	}

	const downloadUrl = response.data.attributes.url;
	const downloadResponse = await fetch(downloadUrl);
	if (!downloadResponse.ok) {
		throw new Error(`Failed to download backup ${backup.attributes.name} of server ${server.attributes.name}: ${downloadResponse.status}`);
	}

	const filePath = `${DOWNLOAD_DIRECTORY}/${GetBackupFileName(server, backup)}`;
	const fileStream = createWriteStream(filePath);
	const readableStream = downloadResponse.body;
	if (!readableStream) {
		throw new Error(`Failed to get readable stream for backup ${backup.attributes.name} of server ${server.attributes.name}`);
	}

	const nodeReadable = Readable.fromWeb(readableStream as any);

	await pipeline(nodeReadable, fileStream);
	logger.info(`Backup ${backup.attributes.name} of server ${server.attributes.name} downloaded to ${filePath}`);
	return filePath;
}

export async function load() {
	const servers = await FetchAllServers();
	const backups = await FetchAllServerBackups(servers[4]);

	const backupFilePath = await DownloadServerBackup(servers[4], backups[0]);
	logger.info(`Backup downloaded to ${backupFilePath}`);
	logger.info(`Total servers fetched: ${servers.length}`);
}
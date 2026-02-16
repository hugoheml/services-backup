import "dotenv/config";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn, SpawnOptionsWithoutStdio } from "node:child_process";
import { logger } from "../../log";

const TMP_DIR = process.env.TMP_DIR || "/tmp";

export const RSYNC_TMP_ROOT = join(TMP_DIR, "rsync");
mkdirSync(RSYNC_TMP_ROOT, { recursive: true });

const {
	RSYNC_TARGET_NAME,
	RSYNC_TARGET_HOST,
	RSYNC_TARGET_PATH,
	RSYNC_TARGET_USER,
	RSYNC_TARGET_PORT,
	RSYNC_SSH_KEY_PATH,
	RSYNC_SSH_OPTIONS,
	RSYNC_EXCLUDES,
	RSYNC_EXTRA_ARGS
} = process.env;

type CommandOptions = SpawnOptionsWithoutStdio & {
	logPrefix?: string;
};

export type RsyncTarget = {
	name: string;
	host: string;
	path: string;
	user?: string;
	port?: number;
	sshKeyPath?: string;
	sshOptions: string[];
	excludes: string[];
	extraArgs: string[];
};

export function sanitizeName(value: string) {
	return value
		.trim()
		.replace(/[^a-zA-Z0-9-_]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "") || "rsync-target";
}

function parseList(value?: string) {
	return (value || "")
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parseExtraArgs(value?: string) {
	if (!value) return [];

	const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g);
	if (!matches) return [];

	return matches.map((arg) => {
		if (arg.startsWith('"') && arg.endsWith('"')) {
			return arg.slice(1, -1);
		}
		return arg;
	});
}

function parsePort(value?: string) {
	if (!value) return undefined;
	const port = Number(value);
	return Number.isFinite(port) && port > 0 ? port : undefined;
}

export function loadRsyncTarget(): RsyncTarget | undefined {
	if (!RSYNC_TARGET_HOST || !RSYNC_TARGET_PATH) {
		return undefined;
	}

	return {
		name: RSYNC_TARGET_NAME?.trim() || RSYNC_TARGET_HOST.trim(),
		host: RSYNC_TARGET_HOST.trim(),
		path: RSYNC_TARGET_PATH.trim(),
		user: RSYNC_TARGET_USER?.trim() || undefined,
		port: parsePort(RSYNC_TARGET_PORT),
		sshKeyPath: RSYNC_SSH_KEY_PATH?.trim() || undefined,
		sshOptions: parseExtraArgs(RSYNC_SSH_OPTIONS),
		excludes: parseList(RSYNC_EXCLUDES),
		extraArgs: parseExtraArgs(RSYNC_EXTRA_ARGS)
	};
}

export function buildTimestamp(date: Date) {
	return date.toISOString().replace(/:/g, "-").split(".")[0].replace("T", "-");
}

function safeRemove(pathToRemove: string, options: { recursive?: boolean } = {}) {
	try {
		rmSync(pathToRemove, { force: true, ...options });
	} catch {
		// Ignore cleanup errors
	}
}

function formatHost(host: string) {
	if (host.includes(":") && !host.startsWith("[") && !host.endsWith("]")) {
		return `[${host}]`;
	}
	return host;
}

async function runCommand(command: string, args: string[], options?: CommandOptions): Promise<void> {
	const logPrefix = options?.logPrefix || command;
	logger.debug(`[${logPrefix}] ${command} ${args.join(" ")}`);

	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
			...options
		});

		let stderr = "";
		let stdout = "";

		child.stdout?.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr?.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("error", (error) => {
			logger.error(`[${logPrefix}] Failed to start ${command}: ${error}`);
			reject(error);
		});

		child.on("close", (code) => {
			if (stdout.trim().length > 0) {
				logger.debug(`[${logPrefix}] ${stdout.trim()}`);
			}

			if (code === 0) {
				resolve();
				return;
			}

			logger.error(`[${logPrefix}] Command "${command}" exited with code ${code}. Stderr: ${stderr.trim()}`);
			reject(new Error(`${command} exited with code ${code}. ${stderr.trim()}`));
		});
	});
}

export function isArchiveFile(fileName: string) {
	const extensions = [".tar.gz", ".tgz", ".tar"];
	return extensions.some((ext) => fileName.endsWith(ext));
}

function buildSshCommand(target: RsyncTarget): string[] {
	const sshParts = ["ssh"];

	if (target.port) {
		sshParts.push("-p", String(target.port));
	}

	if (target.sshKeyPath) {
		sshParts.push("-i", target.sshKeyPath);
	}

	for (const option of target.sshOptions) {
		sshParts.push(option);
	}

	return sshParts;
}

function buildRsyncArgs(target: RsyncTarget, destination: string, specificPath?: string) {
	const args = ["-az"];

	const sshParts = buildSshCommand(target);

	for (const exclude of target.excludes) {
		args.push("--exclude", exclude);
	}

	args.push(...target.extraArgs);

	args.push("-e", sshParts.join(" "));

	const remotePath = specificPath || target.path;
	const remoteSpec = `${target.user ? `${target.user}@` : ""}${formatHost(target.host)}:${remotePath}`;
	args.push(remoteSpec, destination);

	return args;
}

export async function listRemoteFiles(target: RsyncTarget, remotePath: string): Promise<string[]> {
	const sshCommand = buildSshCommand(target);
	const host = formatHost(target.host);
	const remoteHost = target.user ? `${target.user}@${host}` : host;

	const findCommand = `find "${remotePath}" -mindepth 1 -maxdepth 1 -printf '%f\\n'`;

	const [bin, ...sshArgs] = sshCommand;
	const args = [...sshArgs, remoteHost, findCommand];

	return new Promise<string[]>((resolve, reject) => {
		const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (data) => stdout += data.toString());
		child.stderr?.on("data", (data) => stderr += data.toString());

		child.on("close", (code) => {
			if (code === 0) {
				const files = stdout.trim().split("\n").filter(l => l.length > 0);
				resolve(files);
			} else {
				reject(new Error(`SSH Exit ${code}: ${stdout} - ${stderr.trim()}`));
			}
		});
	});
}

export async function createArchiveForTarget(target: RsyncTarget, specificPath?: string, itemName?: string) {
	const sanitizedName = itemName ? sanitizeName(itemName) : sanitizeName(target.name);
	const date = new Date();
	const timestamp = buildTimestamp(date);

	const workingDirectory = join(RSYNC_TMP_ROOT, `${sanitizedName}-${timestamp}`);
	let archiveName = `${sanitizedName}-${timestamp}.tar.gz`;
	let archivePath = join(RSYNC_TMP_ROOT, archiveName);

	mkdirSync(workingDirectory, { recursive: true });

	const remotePath = specificPath || target.path;
	const displayPath = specificPath ? `${target.path}/${specificPath}` : target.path;

	try {
		logger.info(`[rsync] Starting sync for "${target.name}" (${target.host}:${displayPath}).`);
		const rsyncArgs = buildRsyncArgs(target, workingDirectory, remotePath);
		await runCommand("rsync", rsyncArgs, { logPrefix: "rsync" });

		if (!isArchiveFile(archiveName)) {
			archiveName += ".tar.gz";
			archivePath = join(RSYNC_TMP_ROOT, archiveName);

			return {
				archiveName,
				archivePath,
				sanitizedName: archiveName,
				timestamp,
				size: statSync(archivePath).size,
				date
			};
		}

		logger.info(`[rsync] Creating archive for "${target.name}".`);
		await runCommand("tar", ["-czf", archivePath, "-C", workingDirectory, "."], { logPrefix: "tar" });

		const size = statSync(archivePath).size;

		logger.info(`[rsync] Backup for "${target.name}" completed.`);

		return {
			archivePath,
			archiveName,
			sanitizedName,
			timestamp,
			size,
			date
		};
	} catch (error) {
		safeRemove(archivePath);
		throw error;
	} finally {
		safeRemove(workingDirectory, { recursive: true });
	}
}
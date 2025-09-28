import "dotenv/config";
import { Client } from "pg";
import { createWriteStream, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { logger } from "../../log";

const {
	POSTGRES_HOST,
	POSTGRES_PORT,
	POSTGRES_USER,
	POSTGRES_PASSWORD,
	POSTGRES_DB,
	POSTGRES_SSL_ENABLED,
	POSTGRES_SSL_REJECT_UNAUTHORIZED,
	TMP_DIR
} = process.env;

const POSTGRES_PORT_NUMBER = Number(POSTGRES_PORT) || 5432;
const POSTGRES_SSL_ENABLED_BOOL = POSTGRES_SSL_ENABLED === "true";
const POSTGRES_SSL_REJECT_UNAUTHORIZED_BOOL = POSTGRES_SSL_REJECT_UNAUTHORIZED !== "false";
const POSTGRES_DEFAULT_DATABASE = POSTGRES_DB || process.env.POSTGRES_DATABASE || "postgres";

const TMP_DIRECTORY = TMP_DIR || "/tmp";
const DUMP_DIRECTORY = `${TMP_DIRECTORY}/postgresql`;
mkdirSync(DUMP_DIRECTORY, { recursive: true });

export async function DumpDatabase(databaseName: string): Promise<string> {
	const dumpFilePath = `${DUMP_DIRECTORY}/${databaseName}.gz`;
	logger.info(`Dumping PostgreSQL database ${databaseName} to ${dumpFilePath}`);

	const args = ["-h", POSTGRES_HOST || "localhost", "-p", `${POSTGRES_PORT_NUMBER}`, "-d", databaseName, "--no-owner", "--no-privileges", "--format=plain", "--no-password"];

	if (POSTGRES_USER) {
		args.splice(2, 0, "-U", POSTGRES_USER);
	}

	const dumpEnv = {
		...process.env,
		PGPASSWORD: POSTGRES_PASSWORD || "",
		PGSSLMODE: POSTGRES_SSL_ENABLED_BOOL ? "require" : "disable"
	};

	if (!POSTGRES_SSL_ENABLED_BOOL) {
		delete dumpEnv.PGSSLMODE;
	}

	const dumpProcess = spawn("pg_dump", args, { env: dumpEnv, stdio: ["ignore", "pipe", "pipe"] });
	const gzipProcess = spawn("gzip", [], { stdio: ["pipe", "pipe", "pipe"] });

	dumpProcess.stdout.pipe(gzipProcess.stdin);

	const writeStream = createWriteStream(dumpFilePath);
	gzipProcess.stdout.pipe(writeStream);

	await new Promise<void>((resolve, reject) => {
		let dumpStderr = "";
		let gzipStderr = "";
		let resolved = false;

		const fail = (error: Error) => {
			if (resolved) return;
			resolved = true;
			reject(error);
		};

		dumpProcess.stderr.on("data", (data: Buffer) => {
			dumpStderr += data.toString();
		});

		gzipProcess.stderr.on("data", (data: Buffer) => {
			gzipStderr += data.toString();
		});

		dumpProcess.on("error", (error: any) => {
			logger.error(`Error dumping PostgreSQL database ${databaseName}: ${error.message}`);
			fail(new Error(`Failed to dump PostgreSQL database ${databaseName}. Stderr: ${dumpStderr}`));
		});

		gzipProcess.on("error", (error: any) => {
			logger.error(`Error compressing dump for PostgreSQL database ${databaseName}: ${error.message}`);
			fail(new Error(`Failed to compress dump for PostgreSQL database ${databaseName}. Stderr: ${gzipStderr}`));
		});

		writeStream.on("error", (error: any) => {
			logger.error(`Error writing dump file for PostgreSQL database ${databaseName}: ${error.message}`);
			fail(new Error(`Failed to write dump file for PostgreSQL database ${databaseName}.`));
		});

		writeStream.on("finish", () => {
			if (resolved) return;
			resolved = true;
			resolve();
		});

		dumpProcess.on("close", (code: number) => {
			if (code !== 0) {
				logger.error(`pg_dump process exited with code ${code}`);
				fail(new Error(`pg_dump failed with exit code ${code}. Stderr: ${dumpStderr}`));
			}
		});

		gzipProcess.on("close", (code: number) => {
			if (code !== 0) {
				logger.error(`gzip process exited with code ${code}`);
				fail(new Error(`gzip failed with exit code ${code}. Stderr: ${gzipStderr}`));
			}
		});
	});

	logger.info(`PostgreSQL database ${databaseName} dumped to ${dumpFilePath}`);

	return dumpFilePath;
}

export class PostgresConnection {
	private client: Client;

	private constructor(client: Client) {
		this.client = client;
	}

	static async create(): Promise<PostgresConnection> {
		const client = new Client({
			host: POSTGRES_HOST || "localhost",
			port: POSTGRES_PORT_NUMBER,
			user: POSTGRES_USER,
			password: POSTGRES_PASSWORD,
			database: POSTGRES_DEFAULT_DATABASE,
			ssl: POSTGRES_SSL_ENABLED_BOOL
				? {
					rejectUnauthorized: POSTGRES_SSL_REJECT_UNAUTHORIZED_BOOL
				}
				: undefined
		});

		await client.connect();
		return new PostgresConnection(client);
	}

	private async query<T>(query: string, params: any[] = []): Promise<T[]> {
		logger.debug(`Executing PostgreSQL query: ${query} with params: ${JSON.stringify(params)}`);
		const result = await this.client.query<T>(query, params);
		return result.rows;
	}

	async listDatabases(): Promise<string[]> {
		const rows = await this.query<{ datname: string }>(
			`SELECT datname FROM pg_database WHERE datallowconn = TRUE`
		);
		return rows.map((row) => row.datname);
	}

	async close() {
		await this.client.end();
	}
}

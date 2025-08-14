import "dotenv/config";
import mysql, { Connection, RowDataPacket } from "mysql2/promise";
import { createWriteStream, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { logger } from "../log";

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_PORT, MYSQL_POOL_SIZE, TMP_DIR, MYSQL_SSL_ENABLED } = process.env;

const MYSQL_PORT_NUMBER = Number(MYSQL_PORT);
const MYSQL_POOL_SIZE_NUMBER = Number(MYSQL_POOL_SIZE);
const MYSQL_SSL_ENABLED_BOOL = MYSQL_SSL_ENABLED === 'true';

const DUMP_DIRECTORY = `${TMP_DIR}/mysql`;
mkdirSync(DUMP_DIRECTORY, { recursive: true });

export async function DumpDatabase(databaseName: string): Promise<string> {
	const dumpFilePath = `${DUMP_DIRECTORY}/${databaseName}.gz`;
	logger.info(`Dumping MySQL database ${databaseName} to ${dumpFilePath}`);

	const args = [
		`--host=${MYSQL_HOST}`,
		`--user=${MYSQL_USER}`,
		`--password=${MYSQL_PASSWORD}`,
		`--port=${MYSQL_PORT_NUMBER}`,
		'--databases',
		databaseName,
		'--lock-tables=false'
	];

	if (!MYSQL_SSL_ENABLED_BOOL) {
		args.push('--skip-ssl');
	}

	const dumpProcess = spawn('mysqldump', args);
	const gzipProcess = spawn('gzip');

	dumpProcess.stdout.pipe(gzipProcess.stdin);

	const writeStream = createWriteStream(dumpFilePath);
	gzipProcess.stdout.pipe(writeStream);

	await new Promise<void>((resolve, reject) => {
		let dumpStderr = '';
		let gzipStderr = '';

		dumpProcess.stderr.on('data', (data: Buffer) => {
			dumpStderr += data.toString();
		});

		gzipProcess.stderr.on('data', (data: Buffer) => {
			gzipStderr += data.toString();
		});

		dumpProcess.on('error', (error: any) => {
			logger.error(`Error dumping MySQL database ${databaseName}: ${error.message}`);
			reject(new Error(`Failed to dump MySQL database ${databaseName}. Stderr: ${dumpStderr}`));
		});

		gzipProcess.on('error', (error: any) => {
			logger.error(`Error compressing dump for MySQL database ${databaseName}: ${error.message}`);
			reject(new Error(`Failed to compress dump for MySQL database ${databaseName}. Stderr: ${gzipStderr}`));
		});

		writeStream.on('error', (error: any) => {
			logger.error(`Error writing dump file for MySQL database ${databaseName}: ${error.message}`);
			reject(new Error(`Failed to write dump file for MySQL database ${databaseName}.`));
		});

		writeStream.on('finish', () => {
			resolve();
		});

		dumpProcess.on('close', (code: number) => {
			if (code !== 0) {
				logger.error(`mysqldump process exited with code ${code}`);
				reject(new Error(`mysqldump failed with exit code ${code}. Stderr: ${dumpStderr}`));
			}
		});

		gzipProcess.on('close', (code: number) => {
			if (code !== 0) {
				logger.error(`gzip process exited with code ${code}`);
				reject(new Error(`gzip failed with exit code ${code}. Stderr: ${gzipStderr}`));
			}
		});
	});

	logger.info(`MySQL database ${databaseName} dumped to ${dumpFilePath}`);

	return dumpFilePath;
}

export class MysqlConnection {
	private connection: Connection;

	constructor(connection: Connection) {
		this.connection = connection;
	}

	static async create(): Promise<MysqlConnection> {
		const connection = await mysql.createConnection({
			host: MYSQL_HOST,
			user: MYSQL_USER,
			password: MYSQL_PASSWORD,
			port: MYSQL_PORT_NUMBER,
			pool: MYSQL_POOL_SIZE_NUMBER
		});
		return new MysqlConnection(connection);
	}

	private async query<T = RowDataPacket[]>(query: string, params: any[] = []): Promise<T> {
		logger.debug(`Executing MySQL query: ${query} with params: ${JSON.stringify(params)}`);
		const [rows] = await this.connection.query<T & RowDataPacket[]>(query, params);
		return rows;
	}

	async listDatabases(): Promise<string[]> {
		const rows = await this.query<{ Database: string }[]>(`SHOW DATABASES;`);
		return rows.map((row) => row.Database);
	}

	async close() {
		await this.connection.end();
	}
}
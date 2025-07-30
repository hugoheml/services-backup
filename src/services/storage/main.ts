import "dotenv/config";
import { FTPStorage } from "./ftp/main";

const { STORAGE_TYPE } = process.env;

export function GetStorageClass() {
	switch (STORAGE_TYPE) {
		case "ftp": {
			return new FTPStorage();
		}

		default: {
			throw new Error(`Unsupported storage type: ${STORAGE_TYPE}`);
		}
	}
}
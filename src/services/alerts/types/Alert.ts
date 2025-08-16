import { AlertLevel } from "./AlertLevel";

export type Alert = {
	level: AlertLevel;
	message: string;
	fields?: {
		name: string,
		value: string | number | boolean
	}[]
	error?: Error | string;
}
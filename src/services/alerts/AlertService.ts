import { Alert } from "./types/Alert";

export abstract class AlertService {
	abstract init(): Promise<void>;
	abstract sendAlert(alert: Alert): Promise<void>;
}
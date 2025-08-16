import "dotenv/config";
import { AlertService } from "./AlertService";
import { DiscordAlertService } from "./providers/discord/DiscordAlertService";
import { Alert } from "./types/Alert";
import { logger } from "../log";

const ALERT_SERVICE_ENABLED = process.env.ALERT_SERVICE_ENABLED === "true";
const ALERT_DISCORD_ENABLED = process.env.ALERT_DISCORD_ENABLED === "true";

export class AlertManager {
	private alerts: AlertService[] = [];

	async init() {
		const alerts = await this.buildAlertsArray();
		this.alerts.push(...alerts);
	}

	private async buildAlertsArray(): Promise<AlertService[]> {
		const alerts: AlertService[] = [];
		if (!ALERT_SERVICE_ENABLED) { return alerts; }

		if (ALERT_DISCORD_ENABLED) {
			const discordAlertService = new DiscordAlertService();
			await discordAlertService.init();
			alerts.push(discordAlertService);
		}

		return alerts;
	}

	async sendAlert(alert: Alert) {
		logger.debug(`Sending alert: ${alert.message}`);

		if (alert.error) {
			alert.fields = alert.fields ?? [];
			alert.fields.push({
				name: "Error",
				value: alert.error instanceof Error ? alert.error.message : String(alert.error)
			});
		}

		for (const alertService of this.alerts) {
			try {
				await alertService.sendAlert(alert);
			} catch (error) {
				logger.error(`Failed to send alert via ${alertService.constructor.name}: ${error}`);
			}
		}
	}
}
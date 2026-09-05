import { registerPlugin } from '@capacitor/core';
import { isAndroidApp } from './runtime';

export interface ClientCertificateStatus {
	configured: boolean;
	available: boolean;
	alias?: string;
	origin?: string;
	subject?: string;
	issuer?: string;
	validFrom?: number;
	expiresAt?: number;
	validNow?: boolean;
}

interface ClientCertificatePlugin {
	getStatus(options?: { serverUrl?: string }): Promise<ClientCertificateStatus>;
	selectInstalledCertificate(options: {
		serverUrl: string;
	}): Promise<ClientCertificateStatus & { selected: boolean }>;
	stageRemoveConfiguration(options?: { serverUrl?: string }): Promise<ClientCertificateStatus>;
	commitConfiguration(options?: { serverUrl?: string }): Promise<ClientCertificateStatus>;
	rollbackConfiguration(): Promise<ClientCertificateStatus>;
	removeConfiguration(): Promise<ClientCertificateStatus>;
}

const plugin = registerPlugin<ClientCertificatePlugin>('ClientCertificate');

export async function getClientCertificateStatus(
	serverUrl?: string
): Promise<ClientCertificateStatus> {
	if (!isAndroidApp()) return { configured: false, available: false };
	return plugin.getStatus(serverUrl ? { serverUrl } : undefined);
}

export async function selectInstalledClientCertificate(
	serverUrl: string
): Promise<ClientCertificateStatus & { selected: boolean }> {
	if (!isAndroidApp()) return { configured: false, available: false, selected: false };
	return plugin.selectInstalledCertificate({ serverUrl });
}

export async function stageRemoveClientCertificate(
	serverUrl?: string
): Promise<ClientCertificateStatus> {
	if (!isAndroidApp()) return { configured: false, available: false };
	return plugin.stageRemoveConfiguration(serverUrl ? { serverUrl } : undefined);
}

export async function commitClientCertificateConfiguration(
	serverUrl?: string
): Promise<ClientCertificateStatus> {
	if (!isAndroidApp()) return { configured: false, available: false };
	return plugin.commitConfiguration(serverUrl ? { serverUrl } : undefined);
}

export async function rollbackClientCertificateConfiguration(): Promise<ClientCertificateStatus> {
	if (!isAndroidApp()) return { configured: false, available: false };
	return plugin.rollbackConfiguration();
}

export async function removeClientCertificateConfiguration(): Promise<ClientCertificateStatus> {
	if (!isAndroidApp()) return { configured: false, available: false };
	return plugin.removeConfiguration();
}

export async function clearClientCertificateForDifferentServer(serverUrl: string): Promise<void> {
	if (!isAndroidApp()) return;
	const expectedOrigin = new URL(serverUrl).origin;
	const status = await getClientCertificateStatus(serverUrl);
	if (status.configured && status.origin !== expectedOrigin) {
		await removeClientCertificateConfiguration();
	}
}

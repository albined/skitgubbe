import { platformRequest } from './http';
import { getApiUrl } from './urls';

export function apiRequest(path: string, init?: RequestInit): Promise<Response> {
	return platformRequest(getApiUrl(path), init);
}

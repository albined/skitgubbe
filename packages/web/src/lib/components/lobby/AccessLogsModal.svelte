<script lang="ts">
	import type { ApiAccessLog } from 'shared';
	import { clockTime, dayLabel } from '$lib/time';
	import LobbySheet from './LobbySheet.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		accessLogs: ApiAccessLog[];
	}

	let { isOpen, onClose, accessLogs }: Props = $props();
</script>

{#if isOpen}
	<LobbySheet title="Senaste inloggningarna" width={620} {onClose}>
		<div class="sheet-body">
			{#if accessLogs.length === 0}
				<p class="sheet-empty">Inga inloggningar än.</p>
			{:else}
				<table class="logins">
					<thead>
						<tr>
							<th scope="col">När</th>
							<th scope="col">Enhet</th>
							<th scope="col">Plats</th>
						</tr>
					</thead>
					<tbody>
						{#each accessLogs as log, i (log.id)}
							<tr>
								<td class="when">
									<span class="mark"
										>{#if i === 0}<span aria-label="Senast">◆</span>{/if}</span
									><span class="day">{dayLabel(log.accessed_at)}</span><span class="time"
										>{clockTime(log.accessed_at)}</span
									>
								</td>
								<td class="device" title={log.device_info ?? undefined}>
									{log.device_display || log.device_info}
								</td>
								<td class="place">
									{log.location_display || log.ip_address}
									{#if log.location_display && log.location_display !== 'Lokalt nätverk'}
										<span class="ip">{log.ip_address}</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</LobbySheet>
{/if}

<style>
	.logins {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	th {
		text-align: left;
		padding: 6px 8px;
		font:
			700 11.5px/1.15 'Cormorant Garamond',
			Georgia,
			serif;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #e3ba5a;
		border-bottom: 2px solid rgba(227, 186, 90, 0.3);
		white-space: nowrap;
	}

	td {
		height: 38px;
		padding: 5px 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		vertical-align: middle;
	}

	.when {
		width: 1%;
		padding-right: 16px;
		white-space: nowrap;
	}

	.mark {
		display: inline-block;
		width: 16px;
		color: #e3ba5a;
		font-size: 9px;
		vertical-align: 1px;
	}

	.day {
		font-weight: 600;
		color: #e2e8f0;
	}

	.time {
		margin-left: 5px;
		color: #94a3b8;
	}

	.device {
		font-weight: 500;
		color: #e2e8f0;
	}

	.place {
		font-size: 13px;
		color: #cbd5e1;
	}

	.ip {
		display: block;
		font:
			400 10.5px/1.2 'Courier New',
			Courier,
			monospace;
		color: #64748b;
	}

	@media (max-height: 360px) {
		td {
			height: 36px;
		}
	}
</style>

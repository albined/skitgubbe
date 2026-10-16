<script lang="ts">
	import type { ApiArchivedGame } from 'shared';
	import Avatar from '$lib/Avatar.svelte';
	import { shortDate } from '$lib/time';
	import LobbySheet from './LobbySheet.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		archivedGames: ApiArchivedGame[];
		restoreGame: (roomId: string) => void;
	}

	let { isOpen, onClose, archivedGames, restoreGame }: Props = $props();

	const possessive = (name: string) => (/s$/i.test(name) ? name : `${name}s`);
</script>

{#if isOpen}
	<LobbySheet title="Spelarkiv" width={780} tall {onClose}>
		<div class="sheet-body flush">
			{#if archivedGames.length === 0}
				<p class="sheet-empty">Du har inga arkiverade spel.</p>
			{:else}
				<ul class="games">
					{#each archivedGames as g (g.id)}
						{@const ended = g.status === 'ended'}
						<li class="game" class:is-open={!ended}>
							<div class="game-in">
								<span class="game-name">{g.name || g.id}</span>
								<span class="game-meta">
									{shortDate(g.updated_at)}
									{#if !ended && g.is_my_turn}
										<span>· <b>din tur</b></span>
									{:else if !ended && g.active_player_name}
										<span>· {possessive(g.active_player_name)} tur</span>
									{/if}
								</span>
								<span class="game-loser">
									{#if ended && g.loser_name}
										<Avatar
											avatarConfig={g.loser_avatar_config}
											fallbackColor={g.loser_color || '#ef4444'}
											fallbackName={g.loser_name}
											class="loser-av"
										/>
										<span class="loser-name">{g.loser_name}</span>
									{/if}
								</span>
								{#if ended}
									<a
										href={`/room/${g.id}`}
										class="premium-modal-btn premium-modal-btn-secondary game-btn"
									>
										<span class="premium-modal-btn-content">Visa</span>
									</a>
								{:else}
									<button
										type="button"
										onclick={() => restoreGame(g.id)}
										class="premium-modal-btn premium-modal-btn-secondary game-btn"
									>
										<span class="premium-modal-btn-content">Återställ</span>
									</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</LobbySheet>
{/if}

<style>
	.flush {
		padding: 0;
	}

	.games {
		list-style: none;
		margin: 0;
		padding: 10px 12px 8px;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}

	/* Same shape as the game rows in the lobby: silver edge when finished, gold when not. */
	.game {
		position: relative;
		transform: skewX(-15deg);
		background: linear-gradient(90deg, rgba(20, 20, 20, 0.85) 0%, rgba(28, 28, 28, 0.65) 100%);
		box-shadow: 0 4px 25px rgba(255, 255, 255, 0.03);
	}

	.game::before {
		content: '';
		position: absolute;
		inset: 0;
		border-left: 3.5px solid;
		border-image: linear-gradient(to bottom, #ffffff 0%, #cbd5e1 35%, #94a3b8 65%, #475569 100%) 1;
		pointer-events: none;
	}

	.game.is-open::before {
		border-image: linear-gradient(
				to bottom,
				#ffe89e 0%,
				#e3ba5a 25%,
				#b88728 45%,
				#fceeac 55%,
				#d19f33 70%,
				#875c12 100%
			)
			1;
	}

	.game::after {
		content: '';
		position: absolute;
		inset: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		border-right: 1px solid rgba(255, 255, 255, 0.03);
		pointer-events: none;
	}

	.game-in {
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.95fr) minmax(0, 1fr) 92px;
		align-items: center;
		gap: 12px;
		height: 42px;
		padding: 0 12px 0 20px;
		transform: skewX(15deg);
	}

	.game-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font:
			700 15px/1 'Cormorant Garamond',
			Georgia,
			serif;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
	}

	.game-meta {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font:
			italic 400 14.5px/1 'Cormorant Garamond',
			Georgia,
			serif;
		color: rgba(255, 255, 255, 0.5);
	}

	.game-meta b {
		font-weight: 600;
		color: #e3ba5a;
	}

	.game-loser {
		display: flex;
		align-items: center;
		gap: 7px;
		min-width: 0;
		white-space: nowrap;
	}

	.game-loser :global(.loser-av) {
		flex: none;
		width: 20px;
		height: 20px;
		border-radius: 3px;
		font-size: 8px;
	}

	.loser-name {
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: 'Nanum Brush Script', cursive;
		font-size: 21px;
		line-height: 1;
		color: #eadcbc;
	}

	.game-btn {
		justify-self: end;
		width: 92px;
		height: 26px;
		padding: 0 12px;
		font-size: 12px;
		letter-spacing: 0.08em;
		text-decoration: none;
		white-space: nowrap;
	}

	@media (max-height: 360px) {
		.game-in {
			height: 38px;
		}
	}

	@media (max-width: 720px) {
		.game-in {
			grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.9fr) minmax(0, 0.9fr) 86px;
			gap: 8px;
		}
		.game-btn {
			width: 86px;
		}
	}
</style>

<script lang="ts">
	import { tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	type Language = 'sv' | 'en';

	interface RulePage {
		heading: string;
		points: string[];
	}

	interface RulebookCopy {
		title: string;
		close: string;
		switchLanguage: string;
		languageName: string;
		previous: string;
		next: string;
		page: string;
		pages: RulePage[];
	}

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();
	let language: Language = $state('sv');
	let pageIndex = $state(0);
	let dialogElement: HTMLElement | null = $state(null);

	const rulebooks: Record<Language, RulebookCopy> = {
		sv: {
			title: 'Regler',
			close: 'Stäng regelboken',
			switchLanguage: 'Read in English',
			languageName: 'English',
			previous: 'Föregående',
			next: 'Nästa',
			page: 'Sida',
			pages: [
				{
					heading: 'Fas 1',
					points: [
						'Skitgubbe spelas i två faser, där man i första fasen samlar på sig kort och i andra fasen försöker bli av med alla kort på handen.',
						'I första fasen har alla spelare 3 kort på handen, där tvåor är lägst och ess är högst',
						'Varje runda turas alla spelare om med att lägga ett eller flera kort av samma valör, därefter plockar spelaren som la det högsta kortet hela sticket.',
						'Om flera spelare har lagt kort av den högsta valören spelar de en tur till, där högst kort vinner sticket.'
					]
				},
				{
					heading: 'Fas 1',
					points: [
						'Under en omgång kan man strö genom att lägga flera kort med samma valör som kortet man redan lagt.',
						'Om man inte är nöjd med korten man håller på sin hand kan man välja att chansa, där man istället lägger det översta kortet från högen utan att se vad det är.',
						'Det sista kortet i högen är trumfkortet och plockas inte under fas 1, den som drar kortet behåller det till fas 2 där dess färg är trumf.',
						'Fas 2 börjar när en spelare på tur har slut på kort, där om sticket inte är avslutat får alla spelare tillbaka sina kort att behålla till fas 2.'
					]
				},
				
				{
					heading: 'Fas 2',
					points: [
						'I fas 2 ska man bli av med alla sina kort. På ett tomt bord får man lägga valfritt kort eller stege i samma färg.',
						'Om det ligger kort ute måste man lägga högre kort eller trumf, där trumf är högre än alla andra färger.',
						'Då man inte kan eller inte vill lägga kan man välja att plocka upp det äldsta utlägget till sin hand.',
						'När det finns lika många utlägg som det fanns spelare vid början på rundan slängs hela högen och spelaren som la ut sist får börja på nytt.'
					]
				},
				{
					heading: 'Vinnare och förlorare',
					points: [
						'När en spelare lägger sitt sista kort går den ut och är säker. Den spelaren som är sist kvar med kort blir Skitgubbe. Men det finns även andra titlar!',
						'Om en spelare börjar fas 2 med en tom hand vinner den direkt och blir Sweetgubbe!',
						'Om det enda kortet man börjar fas 2 med är trumfkortet vinner man på sitt första drag och blir Trumfman!',
						'Om man börjar fas 2 med att ha plockat varenda stick under spelets gång är man förstoppad skitgubbe.',
						'Om man man börjar fas 2 med varenda kort i hela högen blir man MEGA förstoppad skitgubbe.'
					]
				},
			]
		},
		en: {
			title: 'Rules',
			close: 'Close rulebook',
			switchLanguage: 'Läs på svenska',
			languageName: 'Svenska',
			previous: 'Previous',
			next: 'Next',
			page: 'Page',
			pages: [
				{
					heading: 'Phase 1',
					points: [
						'Skitgubbe is played by 1–10 players with a standard deck without jokers. Everyone starts with three cards in hand and collects cards during Phase 1 to use in Phase 2.',
						'Cards rank from 2 to 10, followed by Jack, Queen, King and Ace. Ace is highest. Suits do not matter in Phase 1.'
					]
				},
				{
					heading: 'Phase 1',
					points: [
						'Each trick starts with the leader laying one or more cards of the same rank. The other players then lay one or more cards of the same rank in turn.',
						'While the draw pile has cards, immediately draw as many replacements as you laid.'
					]
				},
				{
					heading: 'Phase 1',
					points: [
						'The highest rank wins every card on the table for that player’s reserve. The winner starts the next trick.',
						'If players tie for the highest rank, only those players lay one more card each. The highest card wins everything; if they tie again, they continue in the same way.'
					]
				},
				{
					heading: 'Phase 1',
					points: [
						'During a trick, you may sprinkle by adding cards that exactly match the rank you already laid. Draw replacements immediately; turn order then resumes where it paused.',
						'Whoever draws the last card in the draw pile sets it aside face-down instead of adding it to their hand.'
					]
				},
				{
					heading: 'Phase 1',
					points: [
						'Phase 2 begins when the draw pile is empty and at least one player ends a trick with no cards in hand.',
						'Everyone picks up their reserve and keeps the cards in hand. The face-down card is revealed; its suit becomes trump. The player who held it adds it to their hand and starts Phase 2.'
					]
				},
				{
					heading: 'Phase 2',
					points: [
						'In Phase 2, your goal is to get rid of every card. Players follow turn order and can no longer sprinkle.',
						'On an empty table, lay any card or valid sequence.'
					]
				},
				{
					heading: 'Phase 2',
					points: [
						'Otherwise, lay a higher card of the same suit or a trump card. If trump is on top, you must lay a higher trump. Trump always beats every other suit.',
						'You may lay several cards together if they form an unbroken sequence in the same suit. The lowest card in the sequence must be a valid play.'
					]
				},
				{
					heading: 'Phase 2',
					points: [
						'If you cannot or choose not to play, pick up the oldest play from the table. The turn then passes left.',
						'Each turn, whether it contains one card or a sequence, counts as one play.'
					]
				},
				{
					heading: 'Phase 2',
					points: [
						'When the table holds as many plays as there are active players, discard the whole table pile. The player who laid the final play starts again on an empty table.',
						'As soon as you get rid of your final card, you are safe and leave the game. When only one player still holds cards, the game ends; that player is the Skitgubbe.'
					]
				}
			]
		}
	};

	let copy = $derived(rulebooks[language]);
	let currentPage = $derived(copy.pages[pageIndex]);

	$effect(() => {
		if (isOpen) {
			void tick().then(() => dialogElement?.focus());
		}
	});

	function switchLanguage() {
		language = language === 'sv' ? 'en' : 'sv';
	}

	function showPreviousPage() {
		showPage(pageIndex - 1);
	}

	function showNextPage() {
		showPage(pageIndex + 1);
	}

	function showPage(index: number) {
		pageIndex = Math.max(0, Math.min(copy.pages.length - 1, index));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		if (event.key === 'Escape') {
			onClose();
		} else if (event.key === 'ArrowLeft') {
			showPreviousPage();
		} else if (event.key === 'ArrowRight') {
			showNextPage();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
		transition:fade={{ duration: 150 }}
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-slate-950/85 backdrop-blur-md"
			onclick={onClose}
			aria-label={copy.close}
		></button>

		<div
			bind:this={dialogElement}
			class="premium-modal-container rulebook relative z-10 flex max-h-[calc(var(--app-height)*0.94)] w-full max-w-2xl flex-col overflow-hidden p-4 text-slate-100 outline-none sm:p-6"
			role="dialog"
			aria-modal="true"
			aria-labelledby="rulebook-title"
			tabindex="-1"
			transition:scale={{ duration: 180, start: 0.96 }}
		>
			<header
				class="grid flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-amber-200/15 pb-2"
			>
				<button
					type="button"
					onclick={switchLanguage}
					class="inline-flex w-fit cursor-pointer items-center gap-1.5 font-sans text-xs font-semibold tracking-wide text-amber-300 transition-colors hover:text-amber-100"
					aria-label={copy.switchLanguage}
					title={copy.switchLanguage}
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="9" />
						<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
					</svg>
					{copy.languageName}
				</button>

				<h2
					id="rulebook-title"
					class="font-sans text-xs font-bold tracking-[0.12em] text-[#ffe89e] uppercase"
				>
					{copy.title}
				</h2>

				<button
					type="button"
					onclick={onClose}
					class="flex h-7 w-7 cursor-pointer items-center justify-center justify-self-end text-slate-400 transition-colors hover:text-white"
					aria-label={copy.close}
					title={copy.close}
				>
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</header>

			<div class="rulebook-page flex-1 py-3 select-text sm:py-4">
				<h3 class="mb-3 font-sans text-xs font-bold tracking-[0.12em] text-[#ffe89e] uppercase">
					{currentPage.heading}
				</h3>

				<ul class="max-w-xl space-y-2 text-sm leading-relaxed text-slate-300">
					{#each currentPage.points as point}
						<li class="flex gap-2">
							<span
								class="mt-[0.55em] h-1 w-1 flex-none rotate-45 bg-amber-400/80"
								aria-hidden="true"
							></span>
							<span>{point}</span>
						</li>
					{/each}
				</ul>
			</div>

			<footer
				class="flex flex-none items-center justify-between gap-2 border-t border-amber-200/15 pt-2"
			>
				<button
					type="button"
					onclick={showPreviousPage}
					disabled={pageIndex === 0}
					class="rulebook-nav-button"
					aria-label={copy.previous}
					title={copy.previous}
				>
					<span aria-hidden="true">←</span>
				</button>

				<div class="flex gap-1">
					{#each copy.pages as _, index}
						<button
							type="button"
							onclick={() => showPage(index)}
							class="h-1.5 w-3 cursor-pointer transition-colors {index === pageIndex
								? 'bg-amber-300'
								: 'bg-slate-700 hover:bg-slate-500'}"
							aria-label={`${copy.page} ${index + 1}`}
							aria-current={index === pageIndex ? 'page' : undefined}
						></button>
					{/each}
				</div>

				<button
					type="button"
					onclick={showNextPage}
					disabled={pageIndex === copy.pages.length - 1}
					class="rulebook-nav-button"
					aria-label={copy.next}
					title={copy.next}
				>
					<span aria-hidden="true">→</span>
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.rulebook {
		height: min(28rem, calc(var(--app-height) - 2.5rem));
		background:
			linear-gradient(rgba(20, 20, 20, 0.94), rgba(31, 27, 22, 0.96)),
			radial-gradient(circle at top, rgba(212, 175, 55, 0.12), transparent 55%);
	}

	.rulebook-page {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.rulebook-nav-button {
		display: inline-flex;
		height: 1.75rem;
		width: 1.75rem;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(212, 175, 55, 0.35);
		padding: 0;
		font-family: 'Outfit', 'Inter', sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #ffe89e;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease,
			transform 0.1s ease;
	}

	.rulebook-nav-button:hover:not(:disabled) {
		border-color: rgba(255, 232, 158, 0.75);
		background: rgba(212, 175, 55, 0.1);
		color: #fff7d6;
	}

	.rulebook-nav-button:active:not(:disabled) {
		transform: scale(0.97);
	}

	.rulebook-nav-button:disabled {
		cursor: not-allowed;
		opacity: 0.3;
	}

	@media (max-height: 540px) {
		.rulebook {
			max-height: calc(var(--app-height) * 0.96);
			padding: 0.75rem;
		}
	}

	@media (max-height: 380px) {
		.rulebook {
			padding: 0.5rem;
		}

		.rulebook-page {
			padding-block: 0.5rem;
		}
	}
</style>

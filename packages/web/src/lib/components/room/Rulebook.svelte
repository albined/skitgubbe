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
						'I första fasen har alla spelare 3 kort på handen, där tvåor är lägst och ess är högst värde.',
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
						'Om det ligger kort ute måste man lägga högre kort av samma färg eller trumf, där trumf är högre än alla andra färger.',
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
						'Skitgubbe is played in two phases. In the first phase, you collect cards, and in the second phase, you try to get rid of all the cards in your hand.',
						'In the first phase, every player has 3 cards in their hand, with twos being the lowest and aces the highest value.',
						'Each round, all players take turns laying one or more cards of the same value. The player who laid the highest card then picks up the entire trick.',
						'If several players have laid cards of the highest value, they play one more turn, and the highest card wins the trick.'
					]
				},
				{
					heading: 'Phase 1',
					points: [
						'During a round, you can sprinkle by laying more cards of the same value as the card you have already laid.',
						'If you are not happy with the cards in your hand, you can choose to chance by playing the top card from the pile without knowing what it is.',
						'The final card in the pile is the trump card and is not picked up during Phase 1. The player who draws it keeps it until Phase 2, when its suit becomes trump.',
						'Phase 2 begins when the player whose turn it is has run out of cards. If the trick is not finished, all players take back their cards and keep them for Phase 2.'
					]
				},
				{
					heading: 'Phase 2',
					points: [
						'In Phase 2, you should get rid of all your cards. On an empty table, you may lay any card or a sequence in the same suit.',
						'If there are cards on the table, you must lay higher cards of the same suit or the trump suit. Trump is higher than every other suit.',
						'If you cannot or do not want to lay any cards, you can pick up the oldest play into your hand.',
						'When there are as many plays on the table as there were players at the beginning of the round, the entire pile is discarded and the player who laid the final play starts again.'
					]
				},
				{
					heading: 'Winners and losers',
					points: [
						'When a player lays their final card, they go out and are safe. The last player left with cards becomes the Skitgubbe. But there are other titles too!',
						'If a player starts Phase 2 with an empty hand, they win immediately and become a Sweetgubbe!',
						'If the only card you start Phase 2 with is the trump card, you win on your first move and become a Trumfman!',
						'If you start Phase 2 having picked up every trick during the game, you are a förstoppad Skitgubbe.',
						'If you start Phase 2 with every card in the entire deck, you become a MEGA förstoppad Skitgubbe.'
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

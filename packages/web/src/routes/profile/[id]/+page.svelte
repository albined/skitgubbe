<script lang="ts">
    import { invalidateAll } from '$app/navigation';

    let { data } = $props<{ data: { profileId: string, logins: any[] } }>();

    let isLoggingIn = $state(false);

    async function handleLogin() {
        isLoggingIn = true;
        try {
            await fetch(`/api/profiles/${data.profileId}/login`, {
                method: 'POST'
            });
            // Reload the data
            await invalidateAll();
        } catch (error) {
            console.error("Login failed:", error);
        } finally {
            isLoggingIn = false;
        }
    }
</script>

<div class="max-w-2xl mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Profile: {data.profileId}</h1>

    <div class="mb-6">
        <button
            onclick={handleLogin}
            disabled={isLoggingIn}
            class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
        >
            {isLoggingIn ? 'Logging in...' : 'Simulate Login'}
        </button>
    </div>

    <h2 class="text-xl font-semibold mb-3">Recent Login Activity</h2>
    {#if data.logins.length === 0}
        <p class="text-gray-500">No recent logins found.</p>
    {:else}
        <div class="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
            <ul class="divide-y divide-gray-200">
                {#each data.logins as login}
                    <li class="px-4 py-4 sm:px-6">
                        <div class="flex items-center justify-between">
                            <div class="text-sm font-medium text-blue-600 truncate">
                                {new Date(login.time).toLocaleString()}
                            </div>
                            <div class="ml-2 flex-shrink-0 flex">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    {login.location}
                                </span>
                            </div>
                        </div>
                        <div class="mt-2 sm:flex sm:justify-between">
                            <div class="sm:flex">
                                <p class="flex items-center text-sm text-gray-500">
                                    Device: {login.user_agent}
                                </p>
                            </div>
                            <div class="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                <p>IP: {login.ip}</p>
                            </div>
                        </div>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</div>

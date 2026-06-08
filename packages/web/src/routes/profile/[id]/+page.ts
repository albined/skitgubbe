export const load = async ({ fetch, params }) => {
    const { id } = params;

    try {
        const response = await fetch(`/api/profiles/${id}/logins`);
        if (response.ok) {
            const data = await response.json();
            return {
                profileId: id,
                logins: data.logins || []
            };
        }
    } catch (error) {
        console.error("Failed to fetch logins:", error);
    }

    return {
        profileId: id,
        logins: []
    };
};

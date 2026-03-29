const { SupabaseClient } = require('./src/infra/SupabaseClient');
const { AuthManager } = require('./src/core/identity/AuthManager');
const { UserManager } = require('./src/core/identity/UserManager');
const { FriendshipManager } = require('./src/core/identity/FriendshipManager');
const { UserController } = require('./src/controllers/UserController');

async function testProfileFetch() {
    try {
        console.log("Mocking dependencies...");
        const userManager = UserManager.getInstance();
        const friendshipManager = new FriendshipManager({} as any);
        const controller = new UserController(userManager, friendshipManager);
        
        console.log("Calling getMyProfile...");
        const res = await controller.getMyProfile();
        console.log("Response status:", res.status);
        if (res.data) {
            console.log("Data keys:", Object.keys(res.data));
            console.log("Profile Image:", res.data.profileImage);
        } else {
            console.log("Message:", res.message);
        }
    } catch (e) {
        console.error("Test failed with error:", e);
    }
}

// Note: This won't run directly without environment variables and proper TS support in node,
// but I'm checking the logic.
// testProfileFetch();

package com.sunday.spotter.domain

/**
 * Defines extension points for upcoming community and social-network integrations. Concrete
 * implementations can plug in SNS SDKs without touching UI code.
 */
interface CommunityBridge {
    suspend fun shareSpot(spotId: String)
    suspend fun inviteFriends()
}

class PlaceholderCommunityBridge : CommunityBridge {
    override suspend fun shareSpot(spotId: String) {
        // Placeholder hook for future SNS integration (KakaoTalk, Instagram, etc.)
    }

    override suspend fun inviteFriends() {
        // Placeholder hook for future invite flows.
    }
}

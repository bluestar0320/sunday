package com.sunday.spotter.data.repository

import com.sunday.spotter.data.cache.SpotDao
import com.sunday.spotter.data.cache.SpotEntity
import com.sunday.spotter.data.model.Spot
import com.sunday.spotter.domain.SystemTimeProvider
import com.sunday.spotter.domain.TimeProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

class SpotRepository(
    private val spotDao: SpotDao,
    private val seedProvider: SpotSeedProvider,
    private val timeProvider: TimeProvider = SystemTimeProvider
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val spots: Flow<List<Spot>> = spotDao.observeSpots().map { entities ->
        entities.map { it.toDomain() }
    }

    init {
        scope.launch { ensureSeedData() }
    }

    suspend fun ensureSeedData() {
        if (spotDao.count() == 0) {
            cacheSpots(seedProvider.loadSeedSpots())
        }
    }

    suspend fun cacheSpots(spots: List<Spot>) {
        val timestamp = timeProvider.now()
        spotDao.upsertAll(spots.map { it.toEntity(timestamp) })
    }

    suspend fun refreshFromNetworkPlaceholder() {
        // Intentionally left as a placeholder for future network sync.
        ensureSeedData()
    }

    private fun SpotEntity.toDomain() = Spot(
        id = id,
        title = title,
        latitude = latitude,
        longitude = longitude,
        scene = scene,
        heroBearing = heroBearing,
        heroTilt = heroTilt
    )

    private fun Spot.toEntity(updatedAt: Long) = SpotEntity(
        id = id,
        title = title,
        latitude = latitude,
        longitude = longitude,
        scene = scene,
        heroBearing = heroBearing,
        heroTilt = heroTilt,
        updatedAt = updatedAt
    )
}

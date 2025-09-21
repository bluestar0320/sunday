package com.sunday.spotter

import android.app.Application
import androidx.work.Configuration
import androidx.work.WorkManager
import com.sunday.spotter.data.cache.SpotDatabase
import com.sunday.spotter.data.repository.SettingsRepository
import com.sunday.spotter.data.repository.SpotRepository
import com.sunday.spotter.data.repository.SpotRepositoryProvider
import com.sunday.spotter.data.repository.SpotSeedProvider
import com.sunday.spotter.data.repository.SpotSyncManager
import com.sunday.spotter.domain.CommunityBridge
import com.sunday.spotter.domain.PlaceholderCommunityBridge

class SpotterApplication : Application(), SpotRepositoryProvider {

    lateinit var appContainer: AppContainer
        private set

    override val spotRepository: SpotRepository
        get() = appContainer.spotRepository

    override fun onCreate() {
        super.onCreate()
        appContainer = AppContainer(this)
        WorkManager.initialize(this, Configuration.Builder().build())
        appContainer.spotSyncManager.warmUpCache()
    }
}

class AppContainer(application: Application) {
    private val database = SpotDatabase.build(application)
    private val seedProvider = SpotSeedProvider(application)

    val spotRepository = SpotRepository(database.spotDao(), seedProvider)
    val settingsRepository = SettingsRepository(application)
    val spotSyncManager = SpotSyncManager(application, spotRepository)
    val communityBridge: CommunityBridge = PlaceholderCommunityBridge()
}

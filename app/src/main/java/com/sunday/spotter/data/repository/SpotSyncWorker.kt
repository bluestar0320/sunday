package com.sunday.spotter.data.repository

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * WorkManager job that keeps spot metadata fresh while respecting offline caching.
 * This worker currently reuses the seed dataset but is structured for future network integration.
 */
class SpotSyncWorker(
    private val appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        return@withContext try {
            // The repository is retrieved lazily from the application container to avoid heavy DI frameworks.
            val repository = (appContext.applicationContext as SpotRepositoryProvider).spotRepository
            repository.refreshFromNetworkPlaceholder()
            Result.success()
        } catch (t: Throwable) {
            Result.retry()
        }
    }
}

interface SpotRepositoryProvider {
    val spotRepository: SpotRepository
}

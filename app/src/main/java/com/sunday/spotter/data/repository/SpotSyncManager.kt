package com.sunday.spotter.data.repository

import android.content.Context
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class SpotSyncManager(private val context: Context, private val repository: SpotRepository) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun warmUpCache() {
        scope.launch {
            repository.ensureSeedData()
        }
    }

    fun scheduleOnDemandRefresh() {
        val request: WorkRequest = OneTimeWorkRequestBuilder<SpotSyncWorker>().build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "spot_sync",
            ExistingWorkPolicy.REPLACE,
            request
        )
    }
}

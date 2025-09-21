package com.sunday.spotter.data.repository

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore by preferencesDataStore(name = "settings")

object SettingsKeys {
    val LARGE_TEXT: Preferences.Key<Boolean> = booleanPreferencesKey("large_text")
    val OFFLINE_MODE: Preferences.Key<Boolean> = booleanPreferencesKey("offline_mode")
    val NOTIFICATIONS: Preferences.Key<Boolean> = booleanPreferencesKey("notifications")
    val LANGUAGE: Preferences.Key<String> = stringPreferencesKey("language")
    val ONBOARDING_COMPLETE: Preferences.Key<Boolean> = booleanPreferencesKey("onboarding_complete")
}

data class SettingsState(
    val largeText: Boolean = false,
    val offlineMode: Boolean = false,
    val notificationsEnabled: Boolean = true,
    val language: String = "system",
    val onboardingComplete: Boolean = false
)

class SettingsRepository(private val context: Context) {

    val settings: Flow<SettingsState> = context.settingsDataStore.data.map { prefs ->
        SettingsState(
            largeText = prefs[SettingsKeys.LARGE_TEXT] ?: false,
            offlineMode = prefs[SettingsKeys.OFFLINE_MODE] ?: false,
            notificationsEnabled = prefs[SettingsKeys.NOTIFICATIONS] ?: true,
            language = prefs[SettingsKeys.LANGUAGE] ?: "system",
            onboardingComplete = prefs[SettingsKeys.ONBOARDING_COMPLETE] ?: false
        )
    }

    suspend fun toggleLargeText(enabled: Boolean) {
        updatePreference(SettingsKeys.LARGE_TEXT, enabled)
    }

    suspend fun toggleOfflineMode(enabled: Boolean) {
        updatePreference(SettingsKeys.OFFLINE_MODE, enabled)
    }

    suspend fun toggleNotifications(enabled: Boolean) {
        updatePreference(SettingsKeys.NOTIFICATIONS, enabled)
    }

    suspend fun updateLanguage(languageCode: String) {
        updatePreference(SettingsKeys.LANGUAGE, languageCode)
    }

    suspend fun setOnboardingComplete() {
        updatePreference(SettingsKeys.ONBOARDING_COMPLETE, true)
    }

    private suspend fun <T> updatePreference(key: Preferences.Key<T>, value: T) {
        context.settingsDataStore.edit { prefs ->
            prefs[key] = value
        }
    }
}

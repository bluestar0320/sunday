package com.sunday.spotter.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.sunday.spotter.data.repository.SettingsRepository
import com.sunday.spotter.data.repository.SettingsState
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SettingsViewModel(private val repository: SettingsRepository) : ViewModel() {

    val settings: StateFlow<SettingsState> = repository.settings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SettingsState())

    fun setLargeText(enabled: Boolean) {
        viewModelScope.launch { repository.toggleLargeText(enabled) }
    }

    fun setOfflineMode(enabled: Boolean) {
        viewModelScope.launch { repository.toggleOfflineMode(enabled) }
    }

    fun setNotifications(enabled: Boolean) {
        viewModelScope.launch { repository.toggleNotifications(enabled) }
    }

    fun setLanguage(languageCode: String) {
        viewModelScope.launch { repository.updateLanguage(languageCode) }
    }

    fun completeOnboarding() {
        viewModelScope.launch { repository.setOnboardingComplete() }
    }

    companion object {
        fun factory(repository: SettingsRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return SettingsViewModel(repository) as T
                }
            }
    }
}

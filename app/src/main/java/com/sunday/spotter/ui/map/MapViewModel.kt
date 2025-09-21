package com.sunday.spotter.ui.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.sunday.spotter.data.repository.SettingsRepository
import com.sunday.spotter.data.repository.SpotRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class MapViewModel(
    private val spotRepository: SpotRepository,
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    private val _state = MutableStateFlow(MapUiState())
    val state: StateFlow<MapUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            combine(spotRepository.spots, settingsRepository.settings) { spots, settings ->
                MapUiState(
                    spots = spots,
                    isOfflineMode = settings.offlineMode,
                    isLoading = false
                )
            }.collect { newState ->
                _state.value = newState
            }
        }
    }

    fun refreshSpots() {
        viewModelScope.launch {
            spotRepository.refreshFromNetworkPlaceholder()
        }
    }

    companion object {
        fun factory(
            spotRepository: SpotRepository,
            settingsRepository: SettingsRepository
        ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return MapViewModel(spotRepository, settingsRepository) as T
            }
        }
    }
}

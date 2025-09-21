package com.sunday.spotter.ui.map

import com.sunday.spotter.data.model.Spot

data class MapUiState(
    val spots: List<Spot> = emptyList(),
    val isOfflineMode: Boolean = false,
    val isLoading: Boolean = true
)

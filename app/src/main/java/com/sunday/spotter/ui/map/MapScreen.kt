package com.sunday.spotter.ui.map

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberCameraPositionState
import com.sunday.spotter.R
import com.sunday.spotter.ui.components.OfflineBanner

@Composable
fun MapScreen(
    state: MapUiState,
    onRefresh: () -> Unit,
    onSettings: () -> Unit,
    onOpenCamera: () -> Unit,
    onShowTutorial: () -> Unit
) {
    val seoul = LatLng(37.5665, 126.9780)
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(seoul, 11f)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = stringResource(R.string.map_title)) },
                actions = {
                    IconButton(onClick = onShowTutorial) {
                        Icon(Icons.Outlined.Info, contentDescription = null)
                    }
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Outlined.Settings, contentDescription = null)
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onOpenCamera) {
                Icon(Icons.Outlined.CameraAlt, contentDescription = stringResource(R.string.camera_title))
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (state.isOfflineMode) {
                OfflineBanner(message = stringResource(R.string.map_offline_mode))
            }
            Box(modifier = Modifier.fillMaxSize()) {
                GoogleMap(
                    modifier = Modifier.fillMaxSize(),
                    cameraPositionState = cameraPositionState
                ) {
                    state.spots.forEach { spot ->
                        Marker(
                            position = LatLng(spot.latitude, spot.longitude),
                            title = spot.title,
                            snippet = spot.scene
                        )
                    }
                }

                if (state.isLoading) {
                    Text(
                        modifier = Modifier.align(Alignment.Center),
                        text = stringResource(R.string.map_loading),
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center
                    )
                } else if (state.spots.isEmpty()) {
                    Text(
                        modifier = Modifier.align(Alignment.Center),
                        text = stringResource(R.string.spots_empty_state),
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center
                    )
                }

                IconButton(
                    onClick = onRefresh,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(16.dp)
                ) {
                    Icon(Icons.Outlined.Refresh, contentDescription = null)
                }
            }
        }
    }
}

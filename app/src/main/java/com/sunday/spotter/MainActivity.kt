package com.sunday.spotter

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.compose.rememberNavController
import com.sunday.spotter.ui.SpotterNavHost
import com.sunday.spotter.ui.map.MapViewModel
import com.sunday.spotter.ui.settings.SettingsViewModel
import com.sunday.spotter.ui.theme.SpotterTheme

class MainActivity : ComponentActivity() {

    private val appContainer: AppContainer by lazy { (application as SpotterApplication).appContainer }

    private val settingsViewModel: SettingsViewModel by viewModels {
        SettingsViewModel.factory(appContainer.settingsRepository)
    }

    private val mapViewModel: MapViewModel by viewModels {
        MapViewModel.factory(appContainer.spotRepository, appContainer.settingsRepository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val settings by settingsViewModel.settings.collectAsState()
            SpotterTheme(largeText = settings.largeText) {
                val navController = rememberNavController()
                SpotterNavHost(
                    navController = navController,
                    settingsViewModel = settingsViewModel,
                    mapViewModel = mapViewModel,
                    onboardingComplete = settings.onboardingComplete,
                    onOpenCamera = {
                        startActivity(Intent(this, com.sunday.spotter.ui.camera.ARGuidedCameraActivity::class.java))
                    }
                )
            }
        }
    }
}

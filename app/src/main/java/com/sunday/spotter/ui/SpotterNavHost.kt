package com.sunday.spotter.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.sunday.spotter.ui.map.MapScreen
import com.sunday.spotter.ui.map.MapViewModel
import com.sunday.spotter.ui.onboarding.OnboardingScreen
import com.sunday.spotter.ui.onboarding.TutorialScreen
import com.sunday.spotter.ui.settings.SettingsScreen
import com.sunday.spotter.ui.settings.SettingsViewModel

object Routes {
    const val ONBOARDING = "onboarding"
    const val MAP = "map"
    const val SETTINGS = "settings"
    const val TUTORIAL = "tutorial"
}

@Composable
fun SpotterNavHost(
    navController: NavHostController,
    settingsViewModel: SettingsViewModel,
    mapViewModel: MapViewModel,
    onboardingComplete: Boolean,
    onOpenCamera: () -> Unit
) {
    val startDestination = if (onboardingComplete) Routes.MAP else Routes.ONBOARDING
    NavHost(navController = navController, startDestination = startDestination) {
        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                onSkip = {
                    settingsViewModel.completeOnboarding()
                    navController.navigate(Routes.MAP) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                },
                onDone = {
                    settingsViewModel.completeOnboarding()
                    navController.navigate(Routes.MAP) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }
        composable(Routes.MAP) {
            val mapState by mapViewModel.state.collectAsState()
            MapScreen(
                state = mapState,
                onRefresh = mapViewModel::refreshSpots,
                onSettings = { navController.navigate(Routes.SETTINGS) },
                onOpenCamera = onOpenCamera,
                onShowTutorial = { navController.navigate(Routes.TUTORIAL) }
            )
        }
        composable(Routes.SETTINGS) {
            val settings by settingsViewModel.settings.collectAsState()
            SettingsScreen(
                state = settings,
                onLargeTextChanged = settingsViewModel::setLargeText,
                onOfflineModeChanged = settingsViewModel::setOfflineMode,
                onNotificationsChanged = settingsViewModel::setNotifications,
                onLanguageSelected = settingsViewModel::setLanguage,
                onBack = { navController.popBackStack() }
            )
        }
        composable(Routes.TUTORIAL) {
            TutorialScreen(onBack = { navController.popBackStack() })
        }
    }
}

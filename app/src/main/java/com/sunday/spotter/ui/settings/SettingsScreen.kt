package com.sunday.spotter.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.sunday.spotter.R
import com.sunday.spotter.data.repository.SettingsState

@Composable
fun SettingsScreen(
    state: SettingsState,
    onLargeTextChanged: (Boolean) -> Unit,
    onOfflineModeChanged: (Boolean) -> Unit,
    onNotificationsChanged: (Boolean) -> Unit,
    onLanguageSelected: (String) -> Unit,
    onBack: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = stringResource(R.string.settings_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            SettingToggle(
                title = stringResource(R.string.settings_large_text),
                checked = state.largeText,
                onCheckedChanged = onLargeTextChanged
            )
            SettingToggle(
                title = stringResource(R.string.settings_offline_mode),
                checked = state.offlineMode,
                onCheckedChanged = onOfflineModeChanged
            )
            SettingToggle(
                title = stringResource(R.string.settings_notifications),
                checked = state.notificationsEnabled,
                onCheckedChanged = onNotificationsChanged
            )

            Divider()

            Text(
                text = stringResource(R.string.language_picker_label),
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
            )
            LanguageRow(
                selected = state.language,
                onLanguageSelected = onLanguageSelected
            )

            Text(
                text = stringResource(R.string.community_call_to_action),
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun SettingToggle(
    title: String,
    checked: Boolean,
    onCheckedChanged: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = title, style = MaterialTheme.typography.bodyLarge)
        Switch(checked = checked, onCheckedChange = onCheckedChanged)
    }
}

@Composable
private fun LanguageRow(
    selected: String,
    onLanguageSelected: (String) -> Unit
) {
    val languages = listOf(
        "system" to "System",
        "ko" to "한국어",
        "en" to "English",
        "zh" to "中文"
    )
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        languages.forEach { (code, label) ->
            OutlinedButton(onClick = { onLanguageSelected(code) }) {
                Text(
                    text = label,
                    fontWeight = if (selected == code) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }
}

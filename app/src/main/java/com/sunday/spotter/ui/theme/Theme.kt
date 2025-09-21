package com.sunday.spotter.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.isUnspecified

private val LightColors = lightColorScheme(
    primary = PrimaryLight,
    onPrimary = OnPrimaryLight,
    background = BackgroundLight
)

private val DarkColors = darkColorScheme(
    primary = PrimaryDark,
    onPrimary = OnPrimaryDark,
    background = BackgroundDark
)

@Composable
fun SpotterTheme(
    useDarkTheme: Boolean = isSystemInDarkTheme(),
    largeText: Boolean = false,
    content: @Composable () -> Unit
) {
    val typography = remember(largeText) {
        if (largeText) SpotterTypography.scale(1.2f) else SpotterTypography
    }

    MaterialTheme(
        colorScheme = if (useDarkTheme) DarkColors else LightColors,
        typography = typography,
        content = content
    )
}

private fun TextStyle.scale(factor: Float): TextStyle {
    val scaledSize = if (!fontSize.isUnspecified) fontSize * factor else fontSize
    val scaledLineHeight = if (!lineHeight.isUnspecified) lineHeight * factor else lineHeight
    return copy(fontSize = scaledSize, lineHeight = scaledLineHeight)
}

private fun androidx.compose.material3.Typography.scale(factor: Float): androidx.compose.material3.Typography {
    return androidx.compose.material3.Typography(
        displayLarge = displayLarge.scale(factor),
        displayMedium = displayMedium.scale(factor),
        displaySmall = displaySmall.scale(factor),
        headlineLarge = headlineLarge.scale(factor),
        headlineMedium = headlineMedium.scale(factor),
        headlineSmall = headlineSmall.scale(factor),
        titleLarge = titleLarge.scale(factor),
        titleMedium = titleMedium.scale(factor),
        titleSmall = titleSmall.scale(factor),
        bodyLarge = bodyLarge.scale(factor),
        bodyMedium = bodyMedium.scale(factor),
        bodySmall = bodySmall.scale(factor),
        labelLarge = labelLarge.scale(factor),
        labelMedium = labelMedium.scale(factor),
        labelSmall = labelSmall.scale(factor)
    )
}

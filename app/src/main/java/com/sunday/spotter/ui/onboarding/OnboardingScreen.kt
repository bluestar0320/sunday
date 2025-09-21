package com.sunday.spotter.ui.onboarding

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.sunday.spotter.R
import kotlinx.coroutines.launch

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(
    onSkip: () -> Unit,
    onDone: () -> Unit
) {
    val pages = listOf(
        OnboardingPage(stringResource(R.string.onboarding_headline_discover)),
        OnboardingPage(stringResource(R.string.onboarding_headline_capture)),
        OnboardingPage(stringResource(R.string.onboarding_headline_share))
    )
    val pagerState = rememberPagerState(pageCount = { pages.size })
    val coroutineScope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.SpaceBetween,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        OutlinedButton(
            onClick = onSkip,
            modifier = Modifier.align(Alignment.End)
        ) {
            Text(text = stringResource(R.string.onboarding_skip))
        }

        HorizontalPager(state = pagerState, modifier = Modifier.weight(1f)) { page ->
            OnboardingSlide(text = pages[page].headline)
        }

        Button(
            onClick = {
                if (pagerState.currentPage == pages.lastIndex) {
                    onDone()
                } else {
                    val next = pagerState.currentPage + 1
                    coroutineScope.launch {
                        pagerState.animateScrollToPage(next)
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = if (pagerState.currentPage == pages.lastIndex) {
                    stringResource(R.string.onboarding_finish)
                } else {
                    stringResource(R.string.onboarding_next)
                },
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun OnboardingSlide(text: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = text,
            style = androidx.compose.material3.MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold
        )
    }
}

data class OnboardingPage(val headline: String)

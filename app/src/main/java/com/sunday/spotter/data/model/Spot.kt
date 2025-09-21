package com.sunday.spotter.data.model

data class Spot(
    val id: String,
    val title: String,
    val latitude: Double,
    val longitude: Double,
    val scene: String,
    val heroBearing: Float,
    val heroTilt: Float
)
